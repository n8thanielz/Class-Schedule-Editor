window.ScheduleApp = window.ScheduleApp || {};

var _DAY_ORDER = ['M', 'T', 'W', 'Th', 'F'];

var _TYPE_NAMES = {
  LEC: 'Lecture', LAB: 'Laboratory', DIS: 'Discussion',
  SEM: 'Seminar',  REC: 'Recitation', ACT: 'Activity',
  IND: 'Independent Study', THE: 'Thesis Research',
  HON: 'Honors Thesis Project', TPC: 'Special Topics', CNT: 'Continuing Registration'
};

var _INST_METHOD_MAP = {
  'In Person': 'In Person', 'Online': 'Online',
  'Hybrid': 'Hybrid', 'Remote Real-Time': 'Remote Real-Time'
};

function _daysToStr(days) {
  return _DAY_ORDER.filter(function(d) { return days.indexOf(d) !== -1; }).join('');
}

function _iCalToCSVDate(iso) {
  // "20260825" → "8/25/26"
  var y = parseInt(iso.slice(2, 4));
  var m = parseInt(iso.slice(4, 6));
  var d = parseInt(iso.slice(6, 8));
  return m + '/' + d + '/' + y;
}

// Normalize time to "8:05am" format (no space, lowercase) so FULL_TIME_RE can re-parse
// the exported CSV. minutesToDisplay() produces "8:05 AM" which breaks round-trip import.
function _toCsvTime(t) {
  var m = String(t || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i);
  if (!m) return t || '';
  var mins = parseInt(m[2] || '0');
  return m[1] + ':' + (mins < 10 ? '0' : '') + mins + m[3].toLowerCase();
}

function _buildMeetingPattern(section) {
  if (!section.days || !section.days.length || !section.startTime || !section.endTime) return '';
  var dayStr = _daysToStr(section.days);
  return dayStr + ' ' + _toCsvTime(section.startTime) + '-' + _toCsvTime(section.endTime);
}

function _buildMeetingsStr(section) {
  var pat = _buildMeetingPattern(section);
  if (!pat) return '';
  if (section.iCalStart && section.iCalEnd) {
    return pat + ' (' + _iCalToCSVDate(section.iCalStart) + ' to ' + _iCalToCSVDate(section.iCalEnd) + ')';
  }
  return pat;
}

function _csvEscape(val) {
  var s = String(val == null ? '' : val);
  if (s.search(/[,"\n]/) !== -1) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function _rowToLine(row) {
  return row.map(_csvEscape).join(',');
}

function _setCol(row, colMap, name, val) {
  if (colMap[name] !== undefined) row[colMap[name]] = String(val == null ? '' : val);
}

function _applySection(row, colMap, section) {
  _setCol(row, colMap, 'Section #',    section.sectionNumber);
  _setCol(row, colMap, 'Course Title', section.courseName);
  _setCol(row, colMap, 'Section Type', _TYPE_NAMES[section.type] || section.type);
  _setCol(row, colMap, 'Instructor',   section.instructor);
  _setCol(row, colMap, 'Room',         section.room || '');

  if (!section.doesNotMeet && section.days && section.days.length) {
    _setCol(row, colMap, 'Meeting Pattern', _buildMeetingPattern(section));
    _setCol(row, colMap, 'Meetings',        _buildMeetingsStr(section));
  }

  if (section.session) {
    var sessionVal = section.session;
    if (section.session === 'Miscellaneous' && section.iCalStart && section.iCalEnd) {
      sessionVal += ' (' + _iCalToCSVDate(section.iCalStart) + ' to ' + _iCalToCSVDate(section.iCalEnd) + ')';
    }
    _setCol(row, colMap, 'Session', sessionVal);
  }

  if (section.roomCapRequest) {
    _setCol(row, colMap, 'Rm Cap Request', section.roomCapRequest);
  }

  var method = 'In Person';
  if (section.isOnline)                         method = 'Online';
  else if (/hybrid/i.test(section.notes))       method = 'Hybrid';
  else if (/remote real-time/i.test(section.notes)) method = 'Remote Real-Time';
  _setCol(row, colMap, 'Inst. Method', method);
}

var _BF_COLS = ['Term', 'Term Code', 'Department Code', 'Subject Code', 'Catalog Number'];

function _buildNewRow(section, colMap, rowWidth, refRow) {
  var row = new Array(rowWidth).fill('');
  // Copy cols B–F from an existing row of the same course using colMap for correct indices
  if (refRow) {
    _BF_COLS.forEach(function(name) {
      var idx = colMap[name];
      if (idx !== undefined && refRow[idx]) row[idx] = refRow[idx];
    });
  }
  _applySection(row, colMap, section);
  _setCol(row, colMap, 'Status', 'Active');
  return row;
}

function _sortBySecNum(a, b) {
  var an = parseInt(a.sectionNumber, 10);
  var bn = parseInt(b.sectionNumber, 10);
  if (!isNaN(an) && !isNaN(bn)) return an - bn;
  return a.sectionNumber < b.sectionNumber ? -1 : 1;
}

function _downloadCSV(filename, content) {
  var blob = new Blob([content], { type: 'text/csv' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export one CSV per loaded schedule (department).
ScheduleApp.exportCSVByDept = function(loadedSchedules, customPrefix) {
  for (var fi = 0; fi < loadedSchedules.length; fi++) {
    _exportOne(loadedSchedules[fi], fi, loadedSchedules, customPrefix);
  }
};

function _exportOne(sch, fileIndex, allSchedules, customPrefix) {
  if (!sch._rawRows || !sch._colMap) {
    alert('Cannot export "' + (sch.dept || 'this schedule') + '" — it was not loaded from a CSV.');
    return;
  }

  var colMap  = sch._colMap;
  var rawRows = sch._rawRows;
  var rowWidth = rawRows[0] ? rawRows[0].length : 25;

  // Build lookup: rowIndex → sections from this file
  // Also build refRows: courseNumber → first raw section row (to copy cols B–F onto new sections)
  var byRow   = {};
  var refRows = {};
  for (var fi2 = 0; fi2 < allSchedules.length; fi2++) {
    allSchedules[fi2].sections.forEach(function(s) {
      if (s._fileIndex !== fileIndex || s._rowIndex < 0) return;
      if (!byRow[s._rowIndex]) byRow[s._rowIndex] = [];
      byRow[s._rowIndex].push(s);
      if (!refRows[s.courseNumber]) refRows[s.courseNumber] = rawRows[s._rowIndex];
    });
  }

  // Collect new sections for this file, grouped by course
  var newByCourse = {};
  for (var fi2 = 0; fi2 < allSchedules.length; fi2++) {
    allSchedules[fi2].sections.forEach(function(s) {
      if (s._fileIndex !== fileIndex || !s._isNew) return;
      if (!newByCourse[s.courseNumber]) newByCourse[s.courseNumber] = [];
      newByCourse[s.courseNumber].push(s);
    });
  }

  // Track which new-course numbers already appeared in original rows
  var seenCourses = {};
  var outputLines = [];
  var pendingNew  = null; // new sections buffered for the current course

  for (var ri = 0; ri < rawRows.length; ri++) {
    var row = rawRows[ri].slice();

    // Keep row-0 semester header in sync with any title edits the user made
    if (ri === 0 && sch.semPrefix && row.length > 0) {
      row[0] = sch.semPrefix.trim();
    }

    var c0  = (row[0] || '').trim();
    var c1  = (row[1] || '').trim();

    // Course header row — flush pending new sections from previous course first
    if (c0 && !c1) {
      var cm = c0.match(/^([A-Z]{2,8}\s*\d+)\s*[-–]/i);
      if (cm) {
        if (pendingNew) {
          pendingNew.forEach(function(ns) {
            outputLines.push(_rowToLine(_buildNewRow(ns, colMap, rowWidth, refRows[ns.courseNumber])));
          });
          pendingNew = null;
        }
        var courseNum = cm[1].replace(/\s+/, ' ').trim().toUpperCase();
        seenCourses[courseNum] = true;
        pendingNew = newByCourse[courseNum]
          ? newByCourse[courseNum].slice().sort(_sortBySecNum)
          : null;
      }
    }

    // Output the row (with any modifications applied)
    if (byRow[ri]) {
      var sec = byRow[ri][0];
      if (sec._deleted) {
        _setCol(row, colMap, 'Status', 'Cancelled');
      } else if (sec._modified) {
        _applySection(row, colMap, sec);
      }
    }
    outputLines.push(_rowToLine(row));
  }

  // Flush new sections for the last course
  if (pendingNew) {
    pendingNew.forEach(function(ns) {
      outputLines.push(_rowToLine(_buildNewRow(ns, colMap, rowWidth, refRows[ns.courseNumber])));
    });
  }

  // Append entirely new courses not in original rows
  for (var courseNum in newByCourse) {
    if (seenCourses[courseNum]) continue;
    var secs = newByCourse[courseNum];
    var headerRow = new Array(rowWidth).fill('');
    headerRow[0] = secs[0].courseNumber + ' - ' + (secs[0].courseName || secs[0].courseNumber);
    outputLines.push(_rowToLine(headerRow));
    secs.forEach(function(ns) {
      outputLines.push(_rowToLine(_buildNewRow(ns, colMap, rowWidth, refRows[ns.courseNumber])));
    });
  }

  var semPart  = customPrefix || (sch.semPrefix ? sch.semPrefix.replace(/\s+/g, '_') : 'schedule');
  var deptPart = sch.dept || 'dept';
  _downloadCSV(semPart + '_' + deptPart + '_export.csv', outputLines.join('\r\n'));
}

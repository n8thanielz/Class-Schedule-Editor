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

function _buildMeetingPattern(section) {
  if (!section.days || !section.days.length || !section.startTime || !section.endTime) return '';
  var dayStr = _daysToStr(section.days);
  var start  = ScheduleApp.minutesToDisplay(ScheduleApp.timeToMinutes(section.startTime));
  var end    = ScheduleApp.minutesToDisplay(ScheduleApp.timeToMinutes(section.endTime));
  return dayStr + ' ' + start + '-' + end;
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

  var method = 'In Person';
  if (section.isOnline)                         method = 'Online';
  else if (/hybrid/i.test(section.notes))       method = 'Hybrid';
  else if (/remote real-time/i.test(section.notes)) method = 'Remote Real-Time';
  _setCol(row, colMap, 'Inst. Method', method);
}

function _buildNewRow(section, colMap, rowWidth) {
  var row = new Array(rowWidth).fill('');
  _applySection(row, colMap, section);
  _setCol(row, colMap, 'Status', 'Active');
  return row;
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
ScheduleApp.exportCSVByDept = function(loadedSchedules) {
  for (var fi = 0; fi < loadedSchedules.length; fi++) {
    _exportOne(loadedSchedules[fi], fi, loadedSchedules);
  }
};

function _exportOne(sch, fileIndex, allSchedules) {
  if (!sch._rawRows || !sch._colMap) {
    alert('Cannot export "' + (sch.dept || 'this schedule') + '" — it was not loaded from a CSV.');
    return;
  }

  var colMap  = sch._colMap;
  var rawRows = sch._rawRows;
  var rowWidth = rawRows[0] ? rawRows[0].length : 25;

  // Build lookup: rowIndex → sections from this file
  var byRow = {};
  for (var fi2 = 0; fi2 < allSchedules.length; fi2++) {
    allSchedules[fi2].sections.forEach(function(s) {
      if (s._fileIndex !== fileIndex || s._rowIndex < 0) return;
      if (!byRow[s._rowIndex]) byRow[s._rowIndex] = [];
      byRow[s._rowIndex].push(s);
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

  for (var ri = 0; ri < rawRows.length; ri++) {
    var row = rawRows[ri].slice();
    var c0  = (row[0] || '').trim();
    var c1  = (row[1] || '').trim();

    if (byRow[ri]) {
      // Section row — apply modifications
      var sec = byRow[ri][0]; // primary section for this row
      if (sec._deleted) {
        _setCol(row, colMap, 'Status', 'Cancelled');
      } else if (sec._modified) {
        _applySection(row, colMap, sec);
      }
      outputLines.push(_rowToLine(row));
    } else {
      outputLines.push(_rowToLine(row));
    }

    // After a course header row, insert new sections for that course
    if (c0 && !c1) {
      var cm = c0.match(/^([A-Z]{2,8}\s*\d+)\s*[-–]/i);
      if (cm) {
        var courseNum = cm[1].replace(/\s+/, ' ').trim().toUpperCase();
        seenCourses[courseNum] = true;
        if (newByCourse[courseNum]) {
          newByCourse[courseNum].forEach(function(ns) {
            outputLines.push(_rowToLine(_buildNewRow(ns, colMap, rowWidth)));
          });
        }
      }
    }
  }

  // Append entirely new courses not in original rows
  for (var courseNum in newByCourse) {
    if (seenCourses[courseNum]) continue;
    var secs = newByCourse[courseNum];
    var headerRow = new Array(rowWidth).fill('');
    headerRow[0] = secs[0].courseNumber + ' - ' + (secs[0].courseName || secs[0].courseNumber);
    outputLines.push(_rowToLine(headerRow));
    secs.forEach(function(ns) {
      outputLines.push(_rowToLine(_buildNewRow(ns, colMap, rowWidth)));
    });
  }

  var semPart  = sch.semPrefix ? sch.semPrefix.replace(/\s+/g, '_') : 'schedule';
  var deptPart = sch.dept || 'dept';
  _downloadCSV(semPart + '_' + deptPart + '_export.csv', outputLines.join('\r\n'));
}

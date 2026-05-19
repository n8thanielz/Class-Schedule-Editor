window.ScheduleApp = window.ScheduleApp || {};

var _EXPORT_COLS = [
  'Changes',
  'Term', 'Term Code', 'Department Code', 'Subject Code', 'Catalog Number',
  'Course', 'Section #', 'Course Title', 'Section Type', 'Meeting Pattern',
  'Meetings', 'Instructor', 'Room', 'Status', 'Session', 'Inst. Method', 'Rm Cap Request'
];

var _COL_WIDTHS = [28, 20, 10, 16, 12, 14, 12, 10, 32, 14, 22, 30, 24, 14, 12, 26, 16, 14];

var _TYPE_NAMES_XL = {
  LEC: 'Lecture', LAB: 'Laboratory', DIS: 'Discussion', SEM: 'Seminar',
  REC: 'Recitation', ACT: 'Activity', IND: 'Independent Study',
  THE: 'Thesis Research', HON: 'Honors Thesis Project',
  TPC: 'Special Topics', CNT: 'Continuing Registration'
};

var _DAY_ORDER_XL = ['M', 'T', 'W', 'Th', 'F'];

// ── Styles ────────────────────────────────────────────────────────────────────

var _S_HEADER = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: '374151' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true }
};

var _S_COURSE = {
  font: { bold: true, color: { rgb: '1F2937' }, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } }
};

var _S_CANCELLED = {
  font: { color: { rgb: 'DC2626' }, strike: true, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: 'FEF2F2' } }
};
var _S_CANCELLED_BOLD = {
  font: { bold: true, color: { rgb: 'DC2626' }, strike: true, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: 'FEF2F2' } }
};

var _S_MODIFIED = {
  font: { sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: 'FEF08A' } }
};
var _S_MODIFIED_BOLD = {
  font: { bold: true, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: 'FEF08A' } }
};

var _S_NEW = {
  font: { sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: 'BBF7D0' } }
};
var _S_NEW_BOLD = {
  font: { bold: true, sz: 11 },
  fill: { patternType: 'solid', fgColor: { rgb: 'BBF7D0' } }
};

var _S_NORMAL = { font: { sz: 11 } };

// ── Helpers ───────────────────────────────────────────────────────────────────

function _setXLCol(row, name, val) {
  var idx = _EXPORT_COLS.indexOf(name);
  if (idx >= 0) row[idx] = val == null ? '' : String(val);
}

function _daysStrXL(days) {
  return _DAY_ORDER_XL.filter(function(d) { return days.indexOf(d) !== -1; }).join('');
}

function _meetingPatternXL(sec) {
  if (!sec.days || !sec.days.length || !sec.startTime || !sec.endTime) return '';
  return _daysStrXL(sec.days) + ' ' +
    ScheduleApp.minutesToDisplay(ScheduleApp.timeToMinutes(sec.startTime)) + '-' +
    ScheduleApp.minutesToDisplay(ScheduleApp.timeToMinutes(sec.endTime));
}

function _instMethodXL(sec) {
  if (sec.isOnline)                        return 'Online';
  if (/hybrid/i.test(sec.notes))           return 'Hybrid';
  if (/remote real-time/i.test(sec.notes)) return 'Remote Real-Time';
  return 'In Person';
}

function _applySecFields(row, sec) {
  _setXLCol(row, 'Section #',       sec.sectionNumber);
  _setXLCol(row, 'Course',          sec.courseNumber);
  _setXLCol(row, 'Course Title',    sec.courseName);
  _setXLCol(row, 'Section Type',    _TYPE_NAMES_XL[sec.type] || sec.type);
  _setXLCol(row, 'Instructor',      sec.instructor);
  _setXLCol(row, 'Room',            sec.room || '');
  _setXLCol(row, 'Meeting Pattern', _meetingPatternXL(sec));
  _setXLCol(row, 'Inst. Method',    _instMethodXL(sec));
  if (sec.session) _setXLCol(row, 'Session', sec.session);
  if (sec.roomCapRequest) _setXLCol(row, 'Rm Cap Request', sec.roomCapRequest);
}

// Compare modified section against original raw row; return short change summary.
function _computeChanges(raw, sec, colMap) {
  if (sec._deleted)  return 'Cancelled';
  if (sec._isNew)    return 'New Section';
  if (!sec._modified) return '';

  function orig(name) {
    var idx = colMap[name];
    return idx !== undefined ? (raw[idx] || '').trim() : '';
  }

  var changed = [];

  if (orig('Section #')    !== sec.sectionNumber)                              changed.push('Section #');
  if (orig('Course Title') !== sec.courseName)                                 changed.push('Course Title');
  if (orig('Section Type') !== (_TYPE_NAMES_XL[sec.type] || sec.type))        changed.push('Type');
  if (orig('Instructor')   !== sec.instructor)                                 changed.push('Instructor');
  if (orig('Room')         !== (sec.room || ''))                               changed.push('Room');
  if (orig('Meeting Pattern') !== _meetingPatternXL(sec))                      changed.push('Meeting Pattern');
  if (orig('Inst. Method') !== _instMethodXL(sec))                             changed.push('Delivery');
  if (sec.session && orig('Session').indexOf(sec.session) === -1)              changed.push('Session');

  return changed.length ? changed.join(', ') : 'Modified';
}

// ── Sheet builder ─────────────────────────────────────────────────────────────

function _buildSheet(sch, fileIndex, allSchedules) {
  var colMap  = sch._colMap;
  var rawRows = sch._rawRows;
  var numCols = _EXPORT_COLS.length;

  // Section lookup: rowIndex → section
  // Also refRows: courseNumber → first raw section row (for copying cols B–F onto new sections)
  var byRow   = {};
  var refRows = {};
  allSchedules.forEach(function(s2) {
    s2.sections.forEach(function(s) {
      if (s._fileIndex !== fileIndex || s._rowIndex < 0) return;
      if (!byRow[s._rowIndex]) byRow[s._rowIndex] = s;
      if (!refRows[s.courseNumber]) refRows[s.courseNumber] = rawRows[s._rowIndex];
    });
  });

  // New sections grouped by course
  var newByCourse = {};
  allSchedules.forEach(function(s2) {
    s2.sections.forEach(function(s) {
      if (s._fileIndex !== fileIndex || !s._isNew) return;
      if (!newByCourse[s.courseNumber]) newByCourse[s.courseNumber] = [];
      newByCourse[s.courseNumber].push(s);
    });
  });

  // Map export column names → raw CSV column indices (-1 if absent)
  var colIndices = _EXPORT_COLS.map(function(name) {
    return colMap[name] !== undefined ? colMap[name] : -1;
  });

  var cells  = [];
  var merges = [];
  var rowOut = 0;
  var seenCourses = {};

  function pushRow(values, rowStyle, changesStyle) {
    values.forEach(function(v, c) {
      var style = (c === 0 && changesStyle) ? changesStyle : rowStyle;
      cells.push({ r: rowOut, c: c, v: v == null ? '' : String(v), s: style });
    });
    rowOut++;
  }

  function pushCourseHeader(text) {
    cells.push({ r: rowOut, c: 0, v: text, s: _S_COURSE });
    for (var c = 1; c < numCols; c++) cells.push({ r: rowOut, c: c, v: '', s: _S_COURSE });
    merges.push({ s: { r: rowOut, c: 0 }, e: { r: rowOut, c: numCols - 1 } });
    rowOut++;
  }

  function pushNewSection(sec) {
    var row    = new Array(numCols).fill('');
    var refRow = refRows[sec.courseNumber];
    if (refRow) {
      var bfCols = ['Term', 'Term Code', 'Department Code', 'Subject Code', 'Catalog Number'];
      bfCols.forEach(function(colName) {
        var rawIdx = colMap[colName];
        if (rawIdx !== undefined && refRow[rawIdx]) _setXLCol(row, colName, refRow[rawIdx]);
      });
    }
    _applySecFields(row, sec);
    _setXLCol(row, 'Status',  'Active');
    _setXLCol(row, 'Changes', 'New Section');
    pushRow(row, _S_NEW, _S_NEW_BOLD);
  }

  function _sortBySecNumXL(a, b) {
    var an = parseInt(a.sectionNumber, 10);
    var bn = parseInt(b.sectionNumber, 10);
    if (!isNaN(an) && !isNaN(bn)) return an - bn;
    return a.sectionNumber < b.sectionNumber ? -1 : 1;
  }

  // Header row
  pushRow(_EXPORT_COLS, _S_HEADER, _S_HEADER);

  var pendingNew = null;

  for (var ri = 0; ri < rawRows.length; ri++) {
    var raw = rawRows[ri];
    var c0  = (raw[0] || '').trim();
    var c1  = (raw[1] || '').trim();

    if (!c0 && !c1) continue;

    // Skip the CSV column header row
    var isColHdr = false;
    for (var ci = 0; ci < raw.length; ci++) {
      if ((raw[ci] || '').trim() === 'Section #') { isColHdr = true; break; }
    }
    if (isColHdr) continue;

    // Course header row — flush pending new sections from previous course first
    if (c0 && !c1) {
      if (pendingNew) {
        pendingNew.forEach(pushNewSection);
        pendingNew = null;
      }
      pushCourseHeader(c0);
      var cm = c0.match(/^([A-Z]{2,8}\s*\d+)\s*[-–]/i);
      if (cm) {
        var courseNum = cm[1].replace(/\s+/, ' ').trim().toUpperCase();
        seenCourses[courseNum] = true;
        pendingNew = newByCourse[courseNum]
          ? newByCourse[courseNum].slice().sort(_sortBySecNumXL)
          : null;
      }
      continue;
    }

    // Section row — extract EXPORT_COLS values from raw row
    var outRow = colIndices.map(function(idx) {
      return idx >= 0 ? (raw[idx] || '') : '';
    });

    var sec     = byRow[ri] || null;
    var style   = _S_NORMAL;
    var changes = '';

    if (sec) {
      changes = _computeChanges(raw, sec, colMap);
      if (sec._deleted) {
        _setXLCol(outRow, 'Status', 'Cancelled');
        style = _S_CANCELLED;
      } else if (sec._modified) {
        _applySecFields(outRow, sec);
        style = _S_MODIFIED;
      }
    }

    _setXLCol(outRow, 'Changes', changes);

    var boldStyle = sec && sec._deleted  ? _S_CANCELLED_BOLD
                  : sec && sec._modified ? _S_MODIFIED_BOLD
                  : null;
    pushRow(outRow, style, boldStyle);
  }

  // Flush new sections for the last course
  if (pendingNew) {
    pendingNew.forEach(pushNewSection);
  }

  // Append new sections whose course wasn't in the original rows
  for (var courseNum in newByCourse) {
    if (seenCourses[courseNum]) continue;
    var secs = newByCourse[courseNum];
    pushCourseHeader(secs[0].courseNumber + ' - ' + (secs[0].courseName || secs[0].courseNumber));
    secs.forEach(pushNewSection);
  }

  // Build worksheet object
  var ws = {};
  cells.forEach(function(cell) {
    var addr = XLSX.utils.encode_cell({ r: cell.r, c: cell.c });
    ws[addr] = { v: cell.v, t: 's', s: cell.s };
  });
  ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowOut - 1, c: numCols - 1 } });
  ws['!merges'] = merges;
  ws['!cols']   = _COL_WIDTHS.map(function(w) { return { wch: w }; });
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', state: 'frozen' };

  return ws;
}

// ── Public export ─────────────────────────────────────────────────────────────

ScheduleApp.exportXLSX = function(loadedSchedules) {
  if (!window.XLSX) {
    alert('Excel export library not loaded.');
    return;
  }

  var wb = XLSX.utils.book_new();
  var exported = false;

  loadedSchedules.forEach(function(sch, fi) {
    if (!sch._rawRows || !sch._colMap) return;
    var ws        = _buildSheet(sch, fi, loadedSchedules);
    var sheetName = (sch.dept || ('Dept' + (fi + 1))).slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    exported = true;
  });

  if (!exported) {
    alert('No CSV-loaded schedules to export.');
    return;
  }

  var prefix = loadedSchedules[0] && loadedSchedules[0].semPrefix
    ? loadedSchedules[0].semPrefix.replace(/\s+/g, '_') + '_' : '';
  XLSX.writeFile(wb, prefix + 'schedule_changes.xlsx');
};

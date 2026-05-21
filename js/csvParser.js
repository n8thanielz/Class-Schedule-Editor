window.ScheduleApp = window.ScheduleApp || {};

// ── Shared parsing helpers (day/time/room/instructor) ─────────────────────────

var DAY_COMBOS = ['MTWThF','MWThF','MTWTh','MWTh','MTTh','TWTh','MWF','TTh','MW','MT','MF','TF','WF','FSa','Th','Sa','M','T','W','F'];
var DAY_PATTERN = '(' + DAY_COMBOS.join('|') + ')';
var TIME_PART   = '(\\d{1,2}(?::\\d{2})?[ap]m)';
var FULL_TIME_RE = new RegExp(DAY_PATTERN + '\\s+' + TIME_PART + '-' + TIME_PART, 'gi');

function parseDays(dayStr) {
  var result = [], s = dayStr;
  if (s.indexOf('Th') !== -1) { result.push('Th'); s = s.replace(/Th/g, ''); }
  if (s.indexOf('Sa') !== -1) { result.push('Sa'); s = s.replace(/Sa/g, ''); }
  if (s.indexOf('M')  !== -1) result.push('M');
  if (s.indexOf('T')  !== -1) result.push('T');
  if (s.indexOf('W')  !== -1) result.push('W');
  if (s.indexOf('F')  !== -1) result.push('F');
  return result;
}

function _toTitleCase(s) {
  return s.replace(/\w\S*/g, function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}

function parseInstructor(raw) {
  if (!raw) return 'Staff';
  var clean = raw
    .replace(/\s*\(\d{5,9}\)\s*/g, ' ')
    .replace(/\[Primary\s*Instructor\]/gi, '')
    .replace(/\[.*?\]/g, '')
    .trim();
  var entry = clean.split(';')[0].trim();
  if (!entry) return 'Staff';
  var parts = entry.split(',');
  var lastName  = _toTitleCase(parts[0].trim());
  if (parts.length < 2 || !parts[1].trim()) return lastName;
  var firstName = _toTitleCase(parts[1].trim());
  return firstName + ' ' + lastName;
}

function parseRoom(raw) {
  if (!raw) return '';
  var s = raw.trim()
    .replace(/\[Primary\s+Instructor\]/gi, '')
    .replace(/Instructor\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  if (/^(CANVAS|ONLINE)$/i.test(s)) return s.toUpperCase();
  var stripped = s.replace(/^[0-9]{6,12}[A-Za-z]?\s*-\s*/, '').trim();
  if (!stripped) return '';
  if (/^(CANVAS|ONLINE)$/i.test(stripped)) return stripped.toUpperCase();
  if (/garff.*executive|executive.*garff|Request.*(?:GARFF|SFEBB|CRCC)/i.test(stripped)) {
    var bm = stripped.match(/(GARFF|SFEBB|CRCC)/i);
    return bm ? bm[1].toUpperCase() : 'GARFF';
  }
  var m = stripped.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)?\s+[\w]+)/);
  if (m) return m[1].trim();
  if (/garff/i.test(stripped))  return 'GARFF';
  if (/canvas/i.test(stripped)) return 'CANVAS';
  return stripped;
}

// ── Section type map ──────────────────────────────────────────────────────────

var CSV_SEC_TYPE = {
  'lecture':                 'LEC',
  'seminar':                 'SEM',
  'honors thesis project':   'HON',
  'honors':                  'HON',
  'independent study':       'IND',
  'thesis research':         'THE',
  'special topics':          'TPC',
  'continuing registration': 'CNT',
  'laboratory':              'LAB',
  'discussion':              'DIS',
  'recitation':              'REC',
  'activity':                'ACT'
};

function csvSplitLine(line) {
  var out = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Parse "(MM/DD/YYYY to MM/DD/YYYY)" → "M/D–M/D"
function csvDateRange(str) {
  var m = str.match(/\((\d{1,2})\/(\d{1,2})\/\d{4}\s+to\s+(\d{1,2})\/(\d{1,2})\/\d{4}\)/);
  if (!m) return '';
  return (+m[1]) + '/' + (+m[2]) + '–' + (+m[3]) + '/' + (+m[4]);
}

// Parse "(MM/DD/YY to MM/DD/YY)" or "(MM/DD/YYYY to MM/DD/YYYY)" → { start: 'YYYYMMDD', end: 'YYYYMMDD' }
function csvICalDates(str) {
  if (!str) return null;
  var m = str.match(/\((\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+to\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\)/);
  if (!m) return null;
  function p(n) { var i = parseInt(n); return i < 10 ? '0' + i : '' + i; }
  function y4(yr) { var n = parseInt(yr); return '' + (n < 100 ? 2000 + n : n); }
  return { start: y4(m[3]) + p(m[1]) + p(m[2]), end: y4(m[6]) + p(m[4]) + p(m[5]) };
}

function csvSecType(raw) {
  return CSV_SEC_TYPE[(raw || '').toLowerCase().trim()] || (raw || 'LEC').slice(0, 3).toUpperCase();
}

ScheduleApp.parseCSV = function(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onerror = function() { reject(new Error('Failed to read CSV')); };
    reader.onload = function(e) {
      try {
        var rows = e.target.result
          .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
          .split('\n')
          .map(csvSplitLine);

        // Row 0: "Fall 2026" → semester prefix
        var semRaw = rows[0] && rows[0][0] ? rows[0][0] : '';
        var semMatch = semRaw.match(/(FALL|SPRING|SUMMER)\s+(\d{4})/i);
        var semPrefix = '';
        if (semMatch) {
          semPrefix = { fall: 'FA', spring: 'SP', summer: 'SU' }[semMatch[1].toLowerCase()]
            + ' ' + semMatch[2].slice(2) + ' ';
        }

        var sections = [];
        var currentCourse = null;
        var dept = null;

        // colMap is built dynamically from whichever header row is present.
        // Fallback indices cover the original (wider) CSV format.
        var colMap = null;
        var FALLBACK = {
          'Section #':       9,
          'Course Title':    10,
          'Section Type':    12,
          'Meeting Pattern': 14,
          'Meetings':        15,
          'Instructor':      16,
          'Room':            17,
          'Status':          18,
          'Inst. Method':    21
        };

        function col(row, name) {
          var idx = colMap ? colMap[name] : FALLBACK[name];
          return (row[idx] || '').trim();
        }

        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          var c0 = (row[0] || '').trim();
          var c1 = (row[1] || '').trim();

          if (!c0 && !c1) continue;

          // Detect header row: scan for "Section #" in any cell.
          // Works for both the full export (col 9) and the shorter export (col 7).
          if (!colMap) {
            for (var ci = 0; ci < row.length; ci++) {
              if ((row[ci] || '').trim() === 'Section #') {
                colMap = {};
                for (var cj = 0; cj < row.length; cj++) {
                  colMap[(row[cj] || '').trim()] = cj;
                }
                break;
              }
            }
            if (colMap) continue;       // skip the header row itself
            if (c1 === 'CLSS ID') continue;  // legacy fallback
          }

          // Course header row: value in col 0, empty col 1
          if (c0 && !c1) {
            var cm = c0.match(/^([A-Z]{2,8}\s*\d+)\s*[-–]\s*(.+)/i);
            if (cm) {
              currentCourse = {
                number: cm[1].replace(/\s+/, ' ').trim().toUpperCase(),
                name:   cm[2].trim()
              };
              if (!dept) {
                var dm = currentCourse.number.match(/^([A-Z]{2,8})/);
                if (dm) dept = dm[1];
              }
            }
            continue;
          }

          if (!currentCourse) continue;

          // Skip cancelled sections
          if (/^cancelled$/i.test(col(row, 'Status'))) continue;

          var secNum      = col(row, 'Section #');
          var courseTitle = col(row, 'Course Title');
          var type        = csvSecType(col(row, 'Section Type'));
          var meetPat     = col(row, 'Meeting Pattern');
          var meetingsStr = col(row, 'Meetings');
          var instRaw     = col(row, 'Instructor');
          var roomRaw     = col(row, 'Room');
          var instMethod  = col(row, 'Inst. Method');
          var iCalDates   = csvICalDates(col(row, 'Session')) || csvICalDates(meetingsStr);

          var instructor  = parseInstructor(instRaw);
          var doesNotMeet = /^Does Not Meet/i.test(meetPat);
          var isOnline    = doesNotMeet &&
            (/^online$/i.test(instMethod) || /^ONLINE$/i.test(roomRaw));

          if (doesNotMeet) {
            sections.push({
              id:            currentCourse.number + '-' + secNum,
              courseNumber:  currentCourse.number,
              courseName:    courseTitle || currentCourse.name,
              sectionNumber: secNum,
              type:          type,
              instructor:    instructor,
              days: [], startTime: '', endTime: '',
              room:          isOnline ? 'ONLINE' : parseRoom(roomRaw),
              isOnline:      isOnline,
              doesNotMeet:   true,
              dateRange:     csvDateRange(meetingsStr),
              iCalStart:     iCalDates ? iCalDates.start : null,
              iCalEnd:       iCalDates ? iCalDates.end   : null,
              notes:         '',
              _rowIndex: i, _fileIndex: 0, _modified: false, _deleted: false, _isNew: false
            });
            continue;
          }

          // Parse each session from the Meetings column (includes date ranges)
          var sessionStrs = meetingsStr.split(/\s*;\s*/);
          var roomParts   = roomRaw.split(/\s*;\s*/);
          var parsed = [];

          for (var s = 0; s < sessionStrs.length; s++) {
            var ss = sessionStrs[s].trim();
            if (!ss || /^Does Not Meet/i.test(ss)) continue;

            var dr    = csvDateRange(ss);
            var clean = ss.replace(/\([^)]+\)/g, '').trim();

            FULL_TIME_RE.lastIndex = 0;
            var tm = FULL_TIME_RE.exec(clean);
            if (!tm) continue;

            var days = parseDays(tm[1]);
            var room = parseRoom(
              (s < roomParts.length ? roomParts[s] : roomParts[roomParts.length - 1]).trim()
            );

            // Merge sessions with same time, room, and date range
            var merged = false;
            for (var p = 0; p < parsed.length; p++) {
              var ps = parsed[p];
              if (ps.start === tm[2] && ps.end === tm[3] && ps.dateRange === dr) {
                for (var d = 0; d < days.length; d++)
                  if (ps.days.indexOf(days[d]) === -1) ps.days.push(days[d]);
                merged = true;
                break;
              }
            }
            if (!merged) {
              parsed.push({ days: days, start: tm[2], end: tm[3], room: room, dateRange: dr });
            }
          }

          if (!parsed.length) {
            sections.push({
              id: currentCourse.number + '-' + secNum,
              courseNumber: currentCourse.number,
              courseName:   courseTitle || currentCourse.name,
              sectionNumber: secNum, type: type, instructor: instructor,
              days: [], startTime: '', endTime: '',
              room: parseRoom(roomRaw), isOnline: false, doesNotMeet: true,
              dateRange: '', iCalStart: null, iCalEnd: null, notes: '',
              _rowIndex: i, _fileIndex: 0, _modified: false, _deleted: false, _isNew: false
            });
            continue;
          }

          for (var p = 0; p < parsed.length; p++) {
            var sess  = parsed[p];
            var notes = [];
            if (/^hybrid$/i.test(instMethod))           notes.push('Hybrid');
            if (/^remote real-time$/i.test(instMethod)) notes.push('Remote Real-Time');
            if (/^CANVAS$/i.test(sess.room))            notes.push('Canvas');

            sections.push({
              id:            currentCourse.number + '-' + secNum + (parsed.length > 1 ? '-s' + p : ''),
              courseNumber:  currentCourse.number,
              courseName:    courseTitle || currentCourse.name,
              sectionNumber: secNum,
              type:          type,
              instructor:    instructor,
              days:          sess.days,
              startTime:     sess.start,
              endTime:       sess.end,
              room:          sess.room,
              isOnline:      /^ONLINE$/i.test(sess.room),
              doesNotMeet:   false,
              dateRange:     sess.dateRange,
              iCalStart:     iCalDates ? iCalDates.start : null,
              iCalEnd:       iCalDates ? iCalDates.end   : null,
              notes:         notes.join(', '),
              _rowIndex: i, _fileIndex: 0, _modified: false, _deleted: false, _isNew: false,
              _multiSession: parsed.length > 1
            });
          }
        }

        resolve({
          semester:  semPrefix + (dept || 'Course') + ' All Class Schedule',
          sections:  sections,
          dept:      dept || null,
          semPrefix: semPrefix.trim(),
          _rawRows:  rows,
          _colMap:   colMap || FALLBACK
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
};

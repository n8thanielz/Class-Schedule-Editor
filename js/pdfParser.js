window.ScheduleApp = window.ScheduleApp || {};

// Constants
var SEC_TYPES = 'LEC|SEM|HON|IND|THE|TPC|CNT|LAB|DIS|REC|ACT';
var SEC_TYPES_RE = new RegExp('\\b(' + SEC_TYPES + ')\\b');

var DAY_COMBOS = ['MTWThF','MWThF','MTWTh','MWTh','MTTh','TWTh','MWF','TTh','MW','MT','MF','TF','WF','FSa','Th','Sa','M','T','W','F'];
var DAY_PATTERN = '(' + DAY_COMBOS.join('|') + ')';
var TIME_PART   = '(\\d{1,2}(?::\\d{2})?[ap]m)';
var TIME_RE_SRC = DAY_PATTERN + '\\s+' + TIME_PART + '-' + TIME_PART;
var FULL_TIME_RE = new RegExp(TIME_RE_SRC, 'gi');

var SEC_LINE_RE     = new RegExp('^(\\d{3})\\s+(' + SEC_TYPES + ')\\s+(.*)', 'i');
var SEC_BREAK_RE    = new RegExp('^\\d{3}\\s+(' + SEC_TYPES + ')\\s', 'i');
var COURSE_LINE_RE  = /^([A-Z]{2,8}\s*\d+)\s*[-–]\s*(.+)/i;

// Helpers
function parseDays(dayStr) {
  var result = [];
  var s = dayStr;
  if (s.indexOf('Th') !== -1) { result.push('Th'); s = s.replace(/Th/g, ''); }
  if (s.indexOf('Sa') !== -1) { result.push('Sa'); s = s.replace(/Sa/g, ''); }
  if (s.indexOf('M') !== -1) result.push('M');
  if (s.indexOf('T') !== -1) result.push('T');
  if (s.indexOf('W') !== -1) result.push('W');
  if (s.indexOf('F') !== -1) result.push('F');
  return result;
}

function toTitleCase(s) {
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
  var lastName = clean.split(',')[0].split(';')[0].trim();
  return toTitleCase(lastName);
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
  // Strip leading room-code prefix: 6-12 digits with optional trailing letter, e.g. "0079001100 - " or "007905160A - "
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

function parseSemesterTitle(lines) {
  var semLabel = null;
  var dept = null;
  for (var i = 0; i < lines.length; i++) {
    var text = lines[i].split('\x01')[0];
    if (!semLabel) {
      var sm = text.match(/^(FALL|SPRING|SUMMER)\s+(\d{4})/i);
      if (sm) {
        var abbr = { fall: 'FA', spring: 'SP', summer: 'SU' }[sm[1].toLowerCase()];
        semLabel = abbr + ' ' + sm[2].slice(2);
      }
    }
    if (!dept) {
      var dm = text.match(/^([A-Z]{2,8})\s+\d+\s*[-–]/);
      if (dm) dept = dm[1];
    }
    if (semLabel && dept) break;
  }
  var prefix = semLabel ? semLabel + ' ' : '';
  return prefix + (dept || 'Course') + ' All Class Schedule';
}

// PDF text extraction — outputs "leftText\x01rightText" per line
// where leftText = non-location columns, rightText = location column
ScheduleApp.extractLines = async function(file) {
  var buffer = await file.arrayBuffer();
  var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  var allLines = [];

  for (var p = 1; p <= pdf.numPages; p++) {
    var page = await pdf.getPage(p);
    var content = await page.getTextContent();

    var items = [];
    for (var k = 0; k < content.items.length; k++) {
      var item = content.items[k];
      if (item.str && item.str.trim()) {
        items.push({ str: item.str.trim(), x: item.transform[4], y: item.transform[5] });
      }
    }

    // Detect x-position of location column: leftmost x of room-code items (9+ digit strings)
    var xLoc = Infinity;
    for (var k = 0; k < items.length; k++) {
      if (/^[0-9]{9,}/.test(items[k].str)) {
        if (items[k].x < xLoc) xLoc = items[k].x;
      }
    }
    if (!isFinite(xLoc)) xLoc = Infinity;

    items.sort(function(a, b) {
      return Math.abs(a.y - b.y) > 4 ? b.y - a.y : a.x - b.x;
    });

    var rows = [];
    var curRow = null;
    for (var k = 0; k < items.length; k++) {
      var item = items[k];
      if (!curRow || Math.abs(item.y - curRow.y) > 4) {
        curRow = { y: item.y, leftParts: [], rightParts: [] };
        rows.push(curRow);
      }
      if (item.x >= xLoc) {
        curRow.rightParts.push(item.str);
      } else {
        curRow.leftParts.push(item.str);
      }
    }

    for (var k = 0; k < rows.length; k++) {
      var left  = rows[k].leftParts.join(' ').replace(/\s+/g, ' ').trim();
      var right = rows[k].rightParts.join(' ').replace(/\s+/g, ' ').trim();
      if (left || right) {
        allLines.push(left + '\x01' + right);
      }
    }
  }

  return allLines;
};

// Line parser
ScheduleApp.parseLines = function(lines) {
  var semester = parseSemesterTitle(lines);
  var sections = [];
  var currentCourse = null;
  var i = 0;

  while (i < lines.length) {
    var parts = lines[i].split('\x01');
    var line  = parts[0];

    var courseMatch = line.match(COURSE_LINE_RE);
    if (courseMatch) {
      currentCourse = {
        number: courseMatch[1].replace(/\s+/, ' ').trim().toUpperCase(),
        name: courseMatch[2].trim()
      };
      i++;
      continue;
    }

    if (!currentCourse) { i++; continue; }

    var secMatch = line.match(SEC_LINE_RE);
    if (!secMatch) { i++; continue; }

    var sectionNum = secMatch[1];
    var type = secMatch[2].toUpperCase();
    var body = secMatch[3];
    var locs = [parts[1] || ''];

    // Accumulate continuation lines
    var j = i + 1;
    while (j < lines.length) {
      var nextParts = lines[j].split('\x01');
      var next = nextParts[0];
      if (SEC_BREAK_RE.test(next)) break;
      if (COURSE_LINE_RE.test(next)) break;
      body += ' ' + next;
      locs.push(nextParts[1] || '');
      j++;
      FULL_TIME_RE.lastIndex = 0;
      var hasTime = FULL_TIME_RE.test(body);
      FULL_TIME_RE.lastIndex = 0;
      var doesNotMeet = /Does Not Meet/i.test(body);
      var gotInstructor = /Instructor\]/i.test(body);
      if (hasTime || (doesNotMeet && gotInstructor)) break;
    }

    // Peek at next line: grab room suffix in left OR right column
    // (handles cases like "SFEBB\n110" where "110" lands in right col of next row)
    if (j < lines.length) {
      var peekParts = lines[j].split('\x01');
      var peek     = peekParts[0].trim();
      var peekRight = (peekParts[1] || '').trim();
      var roomNumRE = /^\d{3,5}[A-Za-z]?$/;
      var roomSufRE = /^(Executive Education|Bldg)$/i;
      var isRoomSuffix =
        (!SEC_BREAK_RE.test(peek) && !COURSE_LINE_RE.test(peek)) &&
        (roomNumRE.test(peek) || roomSufRE.test(peek) ||
         (peek === '' && (roomNumRE.test(peekRight) || roomSufRE.test(peekRight))));
      if (isRoomSuffix) {
        if (peek) body += ' ' + peek;
        locs.push(peekRight);
        j++;
        // "Executive Education\nBldg" continuation
        if (/^Executive Education$/i.test(peek || peekRight) && j < lines.length) {
          var nextP2 = lines[j].split('\x01');
          if (/^Bldg$/i.test(nextP2[0].trim()) || /^Bldg$/i.test((nextP2[1] || '').trim())) {
            if (nextP2[0].trim()) body += ' ' + nextP2[0].trim();
            locs.push(nextP2[1] || '');
            j++;
          }
        }
      }
    }
    i = j;

    var doesNotMeet = /Does Not Meet/i.test(body);

    var instMatch = body.match(/^(.*?)\s*(?:\(\d{5,9}\)|\[Primary)/i);
    var instructor = instMatch ? parseInstructor(instMatch[1]) : 'Staff';

    var locStr = locs.join(' ');
    var isOnlineOnly = doesNotMeet && (/\bONLINE\b/i.test(body) || /\bONLINE\b/i.test(locStr));

    FULL_TIME_RE.lastIndex = 0;
    var timeMatches = [];
    var tmExec;
    while ((tmExec = FULL_TIME_RE.exec(body)) !== null) {
      timeMatches.push({ full: tmExec[0], dayStr: tmExec[1], start: tmExec[2], end: tmExec[3] });
    }

    if (doesNotMeet || timeMatches.length === 0) {
      sections.push({
        id: currentCourse.number + '-' + sectionNum,
        courseNumber: currentCourse.number,
        courseName: currentCourse.name,
        sectionNumber: sectionNum,
        type: type,
        instructor: instructor,
        days: [],
        startTime: '',
        endTime: '',
        room: isOnlineOnly ? 'ONLINE' : '',
        isOnline: isOnlineOnly,
        doesNotMeet: true,
        notes: ''
      });
      continue;
    }

    // Build room list from the location column (locs[])
    var locText = locs.join(' ').replace(/\s+/g, ' ').trim();

    // Fallback: extract from body text after first time match
    if (!locText) {
      var firstTmIdx = body.indexOf(timeMatches[0].full);
      locText = body.slice(firstTmIdx + timeMatches[0].full.length);
      for (var t = 1; t < timeMatches.length; t++) {
        locText = locText.replace(timeMatches[t].full, '');
      }
    }

    locText = locText
      .replace(/\(\d{5,9}\)\s*\[Primary\s*/gi, ' ')
      .replace(/\[Primary\s*Instructor\]/gi, ' ')
      .replace(/Instructor\]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    var parsedRooms = [];
    var roomParts = locText.split(';');
    for (var r = 0; r < roomParts.length; r++) {
      var pr = parseRoom(roomParts[r].trim());
      if (pr) parsedRooms.push(pr);
    }
    if (!parsedRooms.length) parsedRooms.push('');

    // Match timeMatch[i] → parsedRooms[i]; fall back to last room
    var sessions = [];
    for (var t = 0; t < timeMatches.length; t++) {
      var tmItem = timeMatches[t];
      var room = t < parsedRooms.length ? parsedRooms[t] : parsedRooms[parsedRooms.length - 1];
      var days = parseDays(tmItem.dayStr);
      var merged = false;
      for (var si = 0; si < sessions.length; si++) {
        var sess = sessions[si];
        if (sess.start === tmItem.start && sess.end === tmItem.end &&
            (!sess.room || !room || sess.room === room)) {
          for (var d = 0; d < days.length; d++) {
            if (sess.days.indexOf(days[d]) === -1) sess.days.push(days[d]);
          }
          if (!sess.room) sess.room = room;
          merged = true;
          break;
        }
      }
      if (!merged) {
        sessions.push({ days: days.slice(), start: tmItem.start, end: tmItem.end, room: room });
      }
    }

    // More rooms than time matches → dangling day tokens create extra sessions
    if (parsedRooms.length > sessions.length) {
      var dangRE = new RegExp('(?:;\\s*)(' + DAY_COMBOS.join('|') + ')(?=\\s|$|;)', 'gi');
      var dm;
      while ((dm = dangRE.exec(body)) !== null && sessions.length < parsedRooms.length) {
        var extraDays = parseDays(dm[1]);
        var lastSess = sessions[sessions.length - 1];
        sessions.push({ days: extraDays, start: lastSess.start, end: lastSess.end,
                        room: parsedRooms[sessions.length] });
      }
    }

    // Dangling day fix for same-room multi-day: "; DAY" not followed by time → merge into session 0
    if (parsedRooms.length <= sessions.length) {
      var danglingDayRE = new RegExp('(?:;\\s*)(' + DAY_COMBOS.join('|') + ')\\s+(?!\\d{1,2}(?::\\d{2})?[ap]m)', 'gi');
      var bareTimeRE = /(\d{1,2}(?::\d{2})?[ap]m)-(\d{1,2}(?::\d{2})?[ap]m)/i;
      var dangMatch;
      while (sessions.length > 0 && (dangMatch = danglingDayRE.exec(body)) !== null) {
        if (bareTimeRE.test(body.slice(dangMatch.index + dangMatch[0].length))) {
          var extraDays = parseDays(dangMatch[1]);
          for (var d = 0; d < extraDays.length; d++) {
            if (sessions[0].days.indexOf(extraDays[d]) === -1) sessions[0].days.push(extraDays[d]);
          }
        }
      }
    }

    // Emit one section entry per session
    for (var si = 0; si < sessions.length; si++) {
      var sess = sessions[si];
      var notes = [];
      if (/hybrid/i.test(body)) notes.push('Hybrid');
      if (/webinar/i.test(body)) notes.push('Webinar');
      if (/\bcanvas\b/i.test(sess.room)) notes.push('Canvas');

      sections.push({
        id: currentCourse.number + '-' + sectionNum + (sessions.length > 1 ? '-s' + si : ''),
        courseNumber: currentCourse.number,
        courseName: currentCourse.name,
        sectionNumber: sectionNum,
        type: type,
        instructor: instructor,
        days: sess.days,
        startTime: sess.start,
        endTime: sess.end,
        room: sess.room,
        isOnline: /^ONLINE$/i.test(sess.room),
        doesNotMeet: false,
        notes: notes.join(', ')
      });
    }
  }

  return { semester: semester, sections: sections };
};

// Public API
ScheduleApp.parsePDF = async function(file) {
  var lines = await ScheduleApp.extractLines(file);
  return ScheduleApp.parseLines(lines);
};

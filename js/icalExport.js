window.ScheduleApp = window.ScheduleApp || {};

var _ICAL_DAY_MAP = { M: 'MO', T: 'TU', W: 'WE', Th: 'TH', F: 'FR' };
var _ICAL_DAY_NUM = { M: 1, T: 2, W: 3, Th: 4, F: 5 }; // matches Date.getDay()

// Generate and download a .ics file for one instructor.
// sections  : array of all active section objects
// semId     : semester identifier string for the filename, e.g. "FA26"
ScheduleApp.exportInstructorICal = function(instructor, sections, semId) {
  var instSections = sections.filter(function(s) {
    return s.instructor === instructor &&
           s.days && s.days.length > 0 &&
           s.startTime && s.endTime &&
           s.iCalStart && s.iCalEnd;
  });

  if (!instSections.length) {
    alert('No date information found for ' + instructor + '.\nThis feature requires a CSV export with a Session column.');
    return;
  }

  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedule Visualizer//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:America/Denver',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0600',
    'TZNAME:MDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0700',
    'TZNAME:MST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  for (var i = 0; i < instSections.length; i++) {
    var s      = instSections[i];
    var byDay  = s.days.map(function(d) { return _ICAL_DAY_MAP[d]; }).filter(Boolean).join(',');
    if (!byDay) continue;

    var firstDate = _firstOccurrence(s.iCalStart, s.days);
    if (!firstDate) continue;

    var dateStr  = _iCalDateStr(firstDate);
    var startT   = _timeToICalStr(s.startTime);
    var endT     = _timeToICalStr(s.endTime);
    var untilStr = _untilStr(s.iCalEnd);

    var uid = (s.courseNumber + '-' + s.sectionNumber + '-' + s.iCalStart)
                .replace(/\s+/g, '') + '@schedule-visualizer';

    var desc = [
      s.courseName,
      'Section ' + s.sectionNumber + ' (' + s.type + ')',
      'Instructor: ' + s.instructor,
      s.room ? 'Room: ' + s.room : ''
    ].filter(Boolean).join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTART;TZID=America/Denver:' + dateStr + 'T' + startT,
      'DTEND;TZID=America/Denver:'   + dateStr + 'T' + endT,
      'RRULE:FREQ=WEEKLY;BYDAY=' + byDay + ';UNTIL=' + untilStr,
      'SUMMARY:' + s.courseNumber + '-' + s.sectionNumber,
      'LOCATION:' + (s.room || ''),
      'DESCRIPTION:' + desc,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  var lastName = instructor.split(/\s+/).pop();
  var filename = lastName + '_' + (semId || 'schedule') + '.ics';
  _downloadText(filename, lines.join('\r\n'), 'text/calendar');
};

// Export the full current grid view as a single .ics file.
// sections: pre-filtered array of visible sections (with iCalStart/iCalEnd set).
// semId   : e.g. "FA26"
// title   : schedule title for the filename
ScheduleApp.exportGridICal = function(sections, semId, title) {
  if (!sections.length) {
    alert('Nothing to export — no sections with date information are currently visible.');
    return;
  }

  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedule Visualizer//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:America/Denver',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0600',
    'TZNAME:MDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0700',
    'TZNAME:MST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  for (var i = 0; i < sections.length; i++) {
    var s     = sections[i];
    var byDay = s.days.map(function(d) { return _ICAL_DAY_MAP[d]; }).filter(Boolean).join(',');
    if (!byDay) continue;

    var firstDate = _firstOccurrence(s.iCalStart, s.days);
    if (!firstDate) continue;

    var dateStr  = _iCalDateStr(firstDate);
    var startT   = _timeToICalStr(s.startTime);
    var endT     = _timeToICalStr(s.endTime);
    var untilStr = _untilStr(s.iCalEnd);
    var uid      = (s.courseNumber + '-' + s.sectionNumber + '-' + s.iCalStart)
                     .replace(/\s+/g, '') + '@schedule-visualizer';
    var desc     = [
      s.courseName,
      'Section ' + s.sectionNumber + ' (' + s.type + ')',
      'Instructor: ' + s.instructor,
      s.room ? 'Room: ' + s.room : ''
    ].filter(Boolean).join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTART;TZID=America/Denver:' + dateStr + 'T' + startT,
      'DTEND;TZID=America/Denver:'   + dateStr + 'T' + endT,
      'RRULE:FREQ=WEEKLY;BYDAY=' + byDay + ';UNTIL=' + untilStr,
      'SUMMARY:' + s.courseNumber + '-' + s.sectionNumber + ' (' + s.instructor + ')',
      'LOCATION:' + (s.room || ''),
      'DESCRIPTION:' + desc,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  var filename = (title || semId || 'schedule').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') + '.ics';
  _downloadText(filename, lines.join('\r\n'), 'text/calendar');
};

// Returns the first calendar date on or after isoDate (YYYYMMDD) that falls
// on one of the section's meeting days.
function _firstOccurrence(isoDate, days) {
  var y    = parseInt(isoDate.slice(0, 4));
  var mo   = parseInt(isoDate.slice(4, 6)) - 1;
  var d    = parseInt(isoDate.slice(6, 8));
  var date = new Date(y, mo, d);

  var targets = days.map(function(day) {
    return _ICAL_DAY_NUM[day];
  }).filter(function(n) { return n !== undefined; });

  for (var i = 0; i < 7; i++) {
    if (targets.indexOf(date.getDay()) !== -1) return date;
    date = new Date(date.getTime() + 86400000);
  }
  return null;
}

function _iCalDateStr(date) {
  return date.getFullYear() + _p2(date.getMonth() + 1) + _p2(date.getDate());
}

// Returns RRULE UNTIL value: midnight UTC on the day after iCalEnd (YYYYMMDD).
// Using the next day at 00:00:00Z ensures the end-date's events are always
// included regardless of local timezone offset.
function _untilStr(iCalEnd) {
  var y  = parseInt(iCalEnd.slice(0, 4));
  var mo = parseInt(iCalEnd.slice(4, 6)) - 1;
  var d  = parseInt(iCalEnd.slice(6, 8));
  var next = new Date(Date.UTC(y, mo, d + 1));
  return next.getUTCFullYear() +
    _p2(next.getUTCMonth() + 1) +
    _p2(next.getUTCDate()) + 'T000000Z';
}

// Converts a time string like "9:00am" or "2:30pm" to "HHMMSS"
function _timeToICalStr(timeStr) {
  var mins = ScheduleApp.timeToMinutes(timeStr);
  return _p2(Math.floor(mins / 60)) + _p2(mins % 60) + '00';
}

function _p2(n) { return n < 10 ? '0' + n : '' + n; }

function _downloadText(filename, content, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

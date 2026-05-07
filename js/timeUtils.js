/* global ScheduleApp */
window.ScheduleApp = window.ScheduleApp || {};

ScheduleApp.GRID_START   = 7 * 60;   // 7:00 AM in minutes (default, overridden per schedule)
ScheduleApp.GRID_END     = 22 * 60;  // 10:00 PM in minutes (default, overridden per schedule)
ScheduleApp.PX_PER_MIN   = 1.5;
ScheduleApp.GRID_HEIGHT  = (22 - 7) * 60 * 1.5; // overridden per schedule

// Set GRID_START/GRID_END/GRID_HEIGHT to fit the actual sections in a schedule.
// Start snaps to the floor hour of the earliest class; end snaps to the ceil hour of the latest.
ScheduleApp.fitGridToSections = function(sections) {
  var SA = ScheduleApp;
  var minStart = Infinity;
  var maxEnd   = -Infinity;

  for (var i = 0; i < sections.length; i++) {
    var s = sections[i];
    if (!s.startTime || !s.endTime) continue;
    var start = SA.timeToMinutes(s.startTime);
    var end   = SA.timeToMinutes(s.endTime);
    if (start < minStart) minStart = start;
    if (end   > maxEnd)   maxEnd   = end;
  }

  if (minStart === Infinity) {
    SA.GRID_START = 7 * 60;
    SA.GRID_END   = 22 * 60;
  } else {
    SA.GRID_START = Math.floor(minStart / 60) * 60;
    SA.GRID_END   = Math.ceil(maxEnd   / 60) * 60;
    if (SA.GRID_END <= SA.GRID_START) SA.GRID_END = SA.GRID_START + 60;
  }

  SA.GRID_HEIGHT = (SA.GRID_END - SA.GRID_START) * SA.PX_PER_MIN;
};

/** "10:45am" or "5pm" → total minutes from midnight */
ScheduleApp.timeToMinutes = function(t) {
  if (!t) return 0;
  var m = String(t).trim().match(/^(\d{1,2})(?::(\d{2}))?([ap]m)$/i);
  if (!m) return 0;
  var h = parseInt(m[1]);
  var min = parseInt(m[2] || '0');
  var period = m[3].toLowerCase();
  if (period === 'pm' && h !== 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  return h * 60 + min;
};

/** minutes from midnight → "10:45 AM" */
ScheduleApp.minutesToDisplay = function(min) {
  var h = Math.floor(min / 60);
  var m = min % 60;
  var period = h >= 12 ? 'PM' : 'AM';
  var displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return displayH + ':' + (m < 10 ? '0' : '') + m + ' ' + period;
};

/** "10:45am" → "10:45 AM" */
ScheduleApp.formatTime = function(t) {
  return ScheduleApp.minutesToDisplay(ScheduleApp.timeToMinutes(t));
};

/** px offset from top of grid for a given time string */
ScheduleApp.timeToPx = function(t) {
  return (ScheduleApp.timeToMinutes(t) - ScheduleApp.GRID_START) * ScheduleApp.PX_PER_MIN;
};

/** duration in px between two time strings */
ScheduleApp.durationPx = function(start, end) {
  return (ScheduleApp.timeToMinutes(end) - ScheduleApp.timeToMinutes(start)) * ScheduleApp.PX_PER_MIN;
};

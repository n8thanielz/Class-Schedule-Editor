window.ScheduleApp = window.ScheduleApp || {};

var DAYS       = ['M', 'T', 'W', 'Th', 'F'];
var DAY_LABELS = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', Th: 'Thursday', F: 'Friday' };

ScheduleApp.renderSchedule = function(container, schedule) {
  container.innerHTML = '';

  var SA = ScheduleApp;
  var activeSections = schedule.sections.filter(function(s) {
    return s.days.length > 0 && s.startTime && s.endTime;
  });

  // Fit the grid time range to the actual sections before any pixel calculations.
  SA.fitGridToSections(activeSections);

  // Store for dynamic relayout when visibility changes
  SA._activeSections  = activeSections;
  SA._dayColumns      = null;
  SA._dayHeaders      = null;
  SA._usedDays        = null;
  SA._gridContainer   = container;

  // Only render columns for days that have classes
  var usedDays = DAYS.filter(function(d) {
    return activeSections.some(function(s) { return s.days.indexOf(d) !== -1; });
  });

  if (!usedDays.length) {
    container.innerHTML = '<p style="padding:24px;color:#666;">No scheduled classes found in this PDF.</p>';
    return;
  }

  container.style.gridTemplateColumns = '70px repeat(' + usedDays.length + ', 1fr)';

  // ── Header row ──────────────────────────────────────────────
  container.appendChild(el('div', 'grid-header'));  // empty time header

  var dayHeaders = {};
  for (var i = 0; i < usedDays.length; i++) {
    var hdr = el('div', 'grid-header');
    hdr.textContent = DAY_LABELS[usedDays[i]];
    container.appendChild(hdr);
    dayHeaders[usedDays[i]] = hdr;
  }

  // ── Time gutter ─────────────────────────────────────────────
  var timeGutter = el('div', 'time-gutter');
  timeGutter.style.height = SA.GRID_HEIGHT + 'px';
  container.appendChild(timeGutter);

  // ── Day columns ──────────────────────────────────────────────
  var dayColumns = {};
  for (var i = 0; i < usedDays.length; i++) {
    var col = el('div', 'day-column');
    col.style.height = SA.GRID_HEIGHT + 'px';
    container.appendChild(col);
    dayColumns[usedDays[i]] = col;
  }

  // Store for relayout
  SA._dayColumns = dayColumns;
  SA._dayHeaders = dayHeaders;
  SA._usedDays   = usedDays;

  // ── Gridlines + time labels ──────────────────────────────────
  for (var min = SA.GRID_START; min <= SA.GRID_END; min += 30) {
    var top = (min - SA.GRID_START) * SA.PX_PER_MIN;
    var isHour = (min % 60 === 0);

    var label = el('span', 'time-label');
    label.style.top = top + 'px';
    label.textContent = SA.minutesToDisplay(min);
    timeGutter.appendChild(label);

    for (var i = 0; i < usedDays.length; i++) {
      var line = el('div', isHour ? 'gridline hour' : 'gridline');
      line.style.top = top + 'px';
      dayColumns[usedDays[i]].appendChild(line);
    }
  }

  // ── Course blocks ─────────────────────────────────────────────
  for (var d = 0; d < usedDays.length; d++) {
    var day = usedDays[d];
    var daySections = activeSections.filter(function(s) {
      return s.days.indexOf(day) !== -1;
    });
    var layouts = SA.layoutDayBlocks(daySections);

    for (var k = 0; k < layouts.length; k++) {
      var lyt     = layouts[k];
      var s       = lyt.section;
      var top     = SA.timeToPx(s.startTime);
      var height  = SA.durationPx(s.startTime, s.endTime);
      if (height < 1) continue;

      var color    = SA.getCourseColor(s.courseNumber);
      var shortNum = s.courseNumber + '-' + s.sectionNumber;
      var timeStr  = SA.formatTime(s.startTime) + '–' + SA.formatTime(s.endTime);

      var block = el('div', 'course-block');
      block.dataset.course    = s.courseNumber;
      block.dataset.sectionId = s.id;
      block.style.top    = Math.max(0, top) + 'px';
      block.style.height = height + 'px';
      block.style.left   = (lyt.left * 100).toFixed(2) + '%';
      block.style.width  = (lyt.width * 100).toFixed(2) + '%';
      block.style.background = color;

      block.title = [
        s.courseNumber + ' – ' + s.courseName,
        'Section ' + s.sectionNumber + ' (' + s.type + ')',
        'Instructor: ' + s.instructor,
        DAY_LABELS[day] + '  ' + timeStr,
        s.dateRange ? 'Dates: ' + s.dateRange : '',
        s.room ? 'Room: ' + s.room : '',
        s.notes || ''
      ].filter(Boolean).join('\n');

      // Delivery method badge (Hybrid / Remote Real-Time / Webinar)
      var badge = deliveryBadge(s.notes);
      if (badge) {
        var badgeEl = el('div', 'block-badge');
        badgeEl.textContent = badge;
        block.appendChild(badgeEl);
      }

      // Course number always shown
      var numEl = el('div', 'block-number');
      numEl.textContent = shortNum;
      block.appendChild(numEl);

      if (height >= 28) {
        var instEl = el('div', 'block-instructor');
        instEl.textContent = s.instructor;
        block.appendChild(instEl);
      }

      if (height >= 46) {
        var timeEl = el('div', 'block-time');
        timeEl.textContent = timeStr;
        block.appendChild(timeEl);
      }

      if (height >= 60 && s.room) {
        var roomEl = el('div', 'block-room');
        roomEl.textContent = s.room;
        block.appendChild(roomEl);
      }

      if (height >= 76 && s.dateRange) {
        var datesEl = el('div', 'block-dates');
        datesEl.textContent = s.dateRange;
        block.appendChild(datesEl);
      }

      dayColumns[day].appendChild(block);
    }
  }
};

// Re-run layout using only the currently visible courses, so blocks
// expand to fill available space when courses are hidden.
// Also hides/shows day columns so empty days are removed from the grid.
ScheduleApp.relayoutVisible = function() {
  var SA = ScheduleApp;
  if (!SA._activeSections || !SA._dayColumns || !SA._usedDays) return;

  // Which courses are currently checked
  var visible = {};
  document.querySelectorAll('.course-filter-cb').forEach(function(cb) {
    visible[cb.dataset.course] = cb.checked;
  });

  // Determine which days still have at least one visible section
  var visibleDays = SA._usedDays.filter(function(day) {
    return SA._activeSections.some(function(s) {
      return s.days.indexOf(day) !== -1 && visible[s.courseNumber];
    });
  });

  // Show/hide headers and columns; update grid template to match
  SA._usedDays.forEach(function(day) {
    var show = visibleDays.indexOf(day) !== -1;
    SA._dayColumns[day].style.display = show ? '' : 'none';
    SA._dayHeaders[day].style.display = show ? '' : 'none';
  });
  SA._gridContainer.style.gridTemplateColumns =
    '70px repeat(' + visibleDays.length + ', 1fr)';

  // Re-run block layout for each day
  for (var d = 0; d < SA._usedDays.length; d++) {
    var day = SA._usedDays[d];
    var col = SA._dayColumns[day];

    var daySections = SA._activeSections.filter(function(s) {
      return s.days.indexOf(day) !== -1 && visible[s.courseNumber];
    });

    var layouts = SA.layoutDayBlocks(daySections);

    // Build id → layout map
    var map = {};
    for (var k = 0; k < layouts.length; k++) {
      map[layouts[k].section.id] = layouts[k];
    }

    var blocks = col.querySelectorAll('.course-block');
    for (var b = 0; b < blocks.length; b++) {
      var block  = blocks[b];
      var lyt    = map[block.dataset.sectionId];
      if (lyt) {
        block.style.left  = (lyt.left  * 100).toFixed(2) + '%';
        block.style.width = (lyt.width * 100).toFixed(2) + '%';
      } else {
        // Hidden course: reset so it's correct if shown again later
        block.style.left  = '0%';
        block.style.width = '100%';
      }
    }
  }
};

function el(tag, className) {
  var e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function deliveryBadge(notes) {
  if (!notes) return '';
  if (/hybrid/i.test(notes))           return 'HYB';
  if (/remote real-time/i.test(notes)) return 'RRT';
  if (/webinar/i.test(notes))          return 'WEB';
  return '';
}

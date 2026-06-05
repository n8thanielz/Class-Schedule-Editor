window.ScheduleApp = window.ScheduleApp || {};

ScheduleApp.renderSidebar = function(container, schedule, loadedSchedules, onRemove) {
  // Snapshot filter states before clearing so they survive a re-render (e.g. Add File).
  // hasPrevState distinguishes a re-render (add/remove file) from a first load.
  var prevCourse = {}, prevInst = {}, hasPrevState = false;
  container.querySelectorAll('.course-filter-cb').forEach(function(cb) {
    prevCourse[cb.dataset.course] = cb.checked;
    hasPrevState = true;
  });
  container.querySelectorAll('.instructor-filter-cb').forEach(function(cb) {
    prevInst[cb.dataset.instructor] = cb.checked;
  });

  container.innerHTML = '';

  // ── Saved Presets ──
  container.appendChild(makePresetsSection());

  // ── Loaded Files (collapsible, open by default) ──
  if (loadedSchedules && loadedSchedules.length > 0) {
    var filesSection = makeSection('Loaded Files', true);

    var fileList = document.createElement('div');
    fileList.className = 'file-list';
    filesSection.body.appendChild(fileList);

    for (var fi = 0; fi < loadedSchedules.length; fi++) {
      (function(idx) {
        var sch = loadedSchedules[idx];
        var item = document.createElement('div');
        item.className = 'file-list-item';

        var label = document.createElement('span');
        label.className = 'file-list-label';
        label.textContent = sch.dept || ('File ' + (idx + 1));
        label.title = sch.semester;

        var removeBtn = document.createElement('button');
        removeBtn.className = 'file-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove ' + (sch.dept || 'this file');
        removeBtn.addEventListener('click', function() { onRemove(idx); });

        item.appendChild(label);
        item.appendChild(removeBtn);
        fileList.appendChild(item);
      })(fi);
    }

    container.appendChild(filesSection.el);

    var resetBtn = document.createElement('button');
    resetBtn.className = 'reset-filters-btn';
    resetBtn.textContent = 'Reset Filters';
    resetBtn.title = 'Show all courses and instructors';
    resetBtn.addEventListener('click', function() {
      container.querySelectorAll('.course-filter-cb').forEach(function(cb) {
        cb.checked = true;
        var ns = cb.parentElement.querySelector('.course-filter-name');
        if (ns) ns.classList.remove('muted');
      });
      container.querySelectorAll('.instructor-filter-cb').forEach(function(cb) {
        cb.checked = true;
        var ns = cb.parentElement.querySelector('.instructor-filter-name');
        if (ns) ns.classList.remove('muted');
      });
      applyAllVisibility();
      ScheduleApp.relayoutVisible();
    });
    container.appendChild(resetBtn);
  }

  // ── Filter Courses (collapsible, open — grouped by department) ──
  // Count unique sections per course (deduplicated by sectionNumber for multi-session rows)
  var sectionCounts = {};
  var seenSecIds    = {};
  for (var i = 0; i < schedule.sections.length; i++) {
    var s = schedule.sections[i];
    if (s._deleted) continue;
    var sid = s.courseNumber + '|' + s.sectionNumber;
    if (seenSecIds[sid]) continue;
    seenSecIds[sid] = true;
    sectionCounts[s.courseNumber] = (sectionCounts[s.courseNumber] || 0) + 1;
  }

  var seenCourses = {};
  var courseDeptMap   = {};
  var courseDeptOrder = [];

  for (var i = 0; i < schedule.sections.length; i++) {
    var s = schedule.sections[i];
    if (!seenCourses[s.courseNumber]) {
      seenCourses[s.courseNumber] = true;
      var dept = deptFromCourse(s.courseNumber);
      if (!courseDeptMap[dept]) { courseDeptMap[dept] = []; courseDeptOrder.push(dept); }
      courseDeptMap[dept].push({ number: s.courseNumber, name: s.courseName, count: sectionCounts[s.courseNumber] || 0 });
    }
  }
  courseDeptOrder.sort();
  for (var d = 0; d < courseDeptOrder.length; d++) {
    courseDeptMap[courseDeptOrder[d]].sort(function(a, b) { return a.number.localeCompare(b.number); });
  }

  var defaultOpen  = !loadedSchedules || loadedSchedules.length <= 1;

  var courseSection = makeSection('Filter Courses', defaultOpen);
  for (var d = 0; d < courseDeptOrder.length; d++) {
    courseSection.body.appendChild(makeCourseDeptGroup(courseDeptOrder[d], courseDeptMap[courseDeptOrder[d]], defaultOpen));
  }
  container.appendChild(courseSection.el);

  // ── Filter by Instructor (collapsible, closed by default — grouped by department) ──
  // Assign each instructor to the department where they have the most sections.
  // First-seen dept wins on a tie.
  var instDeptCounts = {};
  for (var i = 0; i < schedule.sections.length; i++) {
    var s = schedule.sections[i];
    if (!s.instructor) continue;
    var dept = deptFromCourse(s.courseNumber);
    if (!instDeptCounts[s.instructor]) instDeptCounts[s.instructor] = {};
    instDeptCounts[s.instructor][dept] = (instDeptCounts[s.instructor][dept] || 0) + 1;
  }

  var instByDept   = {};
  var instDeptOrder = [];

  for (var inst in instDeptCounts) {
    var counts     = instDeptCounts[inst];
    var primaryDept = null;
    var maxCount   = 0;
    for (var d in counts) {
      if (counts[d] > maxCount || (counts[d] === maxCount && (primaryDept === null || d < primaryDept))) {
        maxCount    = counts[d];
        primaryDept = d;
      }
    }
    if (!instByDept[primaryDept]) { instByDept[primaryDept] = []; instDeptOrder.push(primaryDept); }
    instByDept[primaryDept].push(inst);
  }

  // Store semester ID for use in iCal filenames
  ScheduleApp._semId = loadedSchedules && loadedSchedules.length > 0 && loadedSchedules[0].semPrefix
    ? loadedSchedules[0].semPrefix.replace(/\s+/g, '')
    : '';

  // Map each instructor to their course numbers (used by the print shortcut)
  var instToCourses = {};
  for (var i = 0; i < schedule.sections.length; i++) {
    var s = schedule.sections[i];
    if (!s.instructor) continue;
    if (!instToCourses[s.instructor]) instToCourses[s.instructor] = {};
    instToCourses[s.instructor][s.courseNumber] = true;
  }

  instDeptOrder.sort();
  for (var d = 0; d < instDeptOrder.length; d++) {
    instByDept[instDeptOrder[d]].sort(function(a, b) { return a.localeCompare(b); });
  }

  var instSection = makeSection('Filter by Instructor', false);

  // Global All / None for the whole instructor section
  var instControls = document.createElement('div');
  instControls.className = 'sidebar-controls';
  var instAllBtn  = makeCtrlBtn('All');
  var instNoneBtn = makeCtrlBtn('None');
  instControls.appendChild(instAllBtn);
  instControls.appendChild(instNoneBtn);
  instSection.body.appendChild(instControls);

  instAllBtn.addEventListener('click', function() {
    instSection.body.querySelectorAll('.instructor-filter-cb').forEach(function(cb) { cb.checked = true; });
    instSection.body.querySelectorAll('.instructor-filter-name').forEach(function(n) { n.classList.remove('muted'); });
    applyAllVisibility();
    ScheduleApp.relayoutVisible();
  });

  instNoneBtn.addEventListener('click', function() {
    instSection.body.querySelectorAll('.instructor-filter-cb').forEach(function(cb) { cb.checked = false; });
    instSection.body.querySelectorAll('.instructor-filter-name').forEach(function(n) { n.classList.add('muted'); });
    applyAllVisibility();
    ScheduleApp.relayoutVisible();
  });

  for (var d = 0; d < instDeptOrder.length; d++) {
    instSection.body.appendChild(makeInstDeptGroup(instDeptOrder[d], instByDept[instDeptOrder[d]], instToCourses));
  }

  container.appendChild(instSection.el);

  // Restore previous states. On a re-render (hasPrevState), items not in the
  // snapshot (new courses/instructors from an added file) default to checked so
  // they're visible immediately.
  if (hasPrevState) {
    container.querySelectorAll('.course-filter-cb').forEach(function(cb) {
      cb.checked = (cb.dataset.course in prevCourse) ? prevCourse[cb.dataset.course] : true;
      var nameSpan = cb.parentElement.querySelector('.course-filter-name');
      if (nameSpan) nameSpan.classList.toggle('muted', !cb.checked);
    });
    container.querySelectorAll('.instructor-filter-cb').forEach(function(cb) {
      if (cb.dataset.instructor in prevInst) {
        cb.checked = prevInst[cb.dataset.instructor];
        var nameSpan = cb.parentElement.querySelector('.instructor-filter-name');
        if (nameSpan) nameSpan.classList.toggle('muted', !cb.checked);
      }
      // New instructors stay checked (initialized that way above)
    });
  } else {
    // First load — restore filter states from localStorage if available
    try {
      container.querySelectorAll('.course-filter-cb').forEach(function(cb) {
        var stored = localStorage.getItem('sv_course_vis_' + cb.dataset.course);
        if (stored !== null) {
          cb.checked = stored === '1';
          var nameSpan = cb.parentElement.querySelector('.course-filter-name');
          if (nameSpan) nameSpan.classList.toggle('muted', !cb.checked);
        }
      });
      container.querySelectorAll('.instructor-filter-cb').forEach(function(cb) {
        var stored = localStorage.getItem('sv_inst_vis_' + cb.dataset.instructor);
        if (stored !== null) {
          cb.checked = stored === '1';
          var nameSpan = cb.parentElement.querySelector('.instructor-filter-name');
          if (nameSpan) nameSpan.classList.toggle('muted', !cb.checked);
        }
      });
    } catch(e) {}
  }
  applyAllVisibility();
  ScheduleApp.relayoutVisible();
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSection(title, open) {
  var el = document.createElement('div');
  el.className = 'sidebar-section';

  var toggle = document.createElement('div');
  toggle.className = 'sidebar-section-toggle';

  var arrow = document.createElement('span');
  arrow.className = 'section-arrow';
  arrow.textContent = open ? '▼' : '▶';

  var titleEl = document.createElement('span');
  titleEl.className = 'sidebar-heading';
  titleEl.style.marginBottom = '0';
  titleEl.textContent = title;

  toggle.appendChild(arrow);
  toggle.appendChild(titleEl);
  el.appendChild(toggle);

  var body = document.createElement('div');
  body.className = 'sidebar-section-body';
  if (!open) body.style.display = 'none';
  el.appendChild(body);

  toggle.addEventListener('click', function() {
    var isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    arrow.textContent = isOpen ? '▶' : '▼';
  });

  return { el: el, body: body };
}

function makeCourseDeptGroup(dept, courses, open) {
  var el      = makeDeptShell(dept, courses.length, open);
  var allBtn  = el.allBtn;
  var noneBtn = el.noneBtn;
  var body    = el.body;

  allBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    body.querySelectorAll('.course-filter-cb').forEach(function(cb) { cb.checked = true; });
    body.querySelectorAll('.course-filter-name').forEach(function(n) { n.classList.remove('muted'); });
    applyAllVisibility();
    ScheduleApp.relayoutVisible();
  });

  noneBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    body.querySelectorAll('.course-filter-cb').forEach(function(cb) { cb.checked = false; });
    body.querySelectorAll('.course-filter-name').forEach(function(n) { n.classList.add('muted'); });
    applyAllVisibility();
    ScheduleApp.relayoutVisible();
  });

  // Group courses by level; only add level sub-groups when multiple levels exist
  var levelMap = {}, levelOrder = [];
  for (var i = 0; i < courses.length; i++) {
    var lvl = levelFromCourse(courses[i].number);
    if (!levelMap[lvl]) { levelMap[lvl] = []; levelOrder.push(lvl); }
    levelMap[lvl].push(courses[i]);
  }
  levelOrder.sort(function(a, b) { return parseInt(a) - parseInt(b); });

  if (levelOrder.length > 1) {
    for (var l = 0; l < levelOrder.length; l++) {
      body.appendChild(makeLevelGroup(levelOrder[l], levelMap[levelOrder[l]], open));
    }
  } else {
    for (var i = 0; i < courses.length; i++) {
      body.appendChild(makeCourseRow(courses[i]));
    }
  }

  return el.el;
}

function makeLevelGroup(level, courses, open) {
  var el = document.createElement('div');
  el.className = 'level-group';

  var header = document.createElement('div');
  header.className = 'level-header';

  var arrow = document.createElement('span');
  arrow.className = 'level-arrow';
  arrow.textContent = '▼';

  var nameEl = document.createElement('span');
  nameEl.className = 'level-name';
  nameEl.textContent = level;

  var allBtn  = makeCtrlBtn('All');
  var noneBtn = makeCtrlBtn('None');
  allBtn.className  += ' dept-btn';
  noneBtn.className += ' dept-btn';

  header.appendChild(arrow);
  header.appendChild(nameEl);
  header.appendChild(allBtn);
  header.appendChild(noneBtn);
  el.appendChild(header);

  var body = document.createElement('div');
  body.className = 'level-body';
  if (open === false) { body.style.display = 'none'; arrow.textContent = '▶'; }
  el.appendChild(body);

  header.addEventListener('click', function(e) {
    if (e.target === allBtn || e.target === noneBtn) return;
    var isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    arrow.textContent = isOpen ? '▶' : '▼';
  });

  allBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    body.querySelectorAll('.course-filter-cb').forEach(function(cb) { cb.checked = true; });
    body.querySelectorAll('.course-filter-name').forEach(function(n) { n.classList.remove('muted'); });
    applyAllVisibility();
    ScheduleApp.relayoutVisible();
  });

  noneBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    body.querySelectorAll('.course-filter-cb').forEach(function(cb) { cb.checked = false; });
    body.querySelectorAll('.course-filter-name').forEach(function(n) { n.classList.add('muted'); });
    applyAllVisibility();
    ScheduleApp.relayoutVisible();
  });

  for (var i = 0; i < courses.length; i++) {
    body.appendChild(makeCourseRow(courses[i]));
  }

  return el;
}

function makeCourseRow(course) {
  var row = document.createElement('div');
  row.className = 'course-filter-row';

  var colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'course-color-input';
  colorInput.value = ScheduleApp.getCourseColor(course.number);
  colorInput.title = 'Change color for ' + course.number;

  // ── Secondary (tag) color ──────────────────────────────────────────────────
  var secColor   = ScheduleApp.getSecondaryColor(course.number);
  var hasSecColor = !!secColor;

  var secWrap = document.createElement('div');
  secWrap.className = 'course-sec-color-wrap';

  var secAddBtn = document.createElement('button');
  secAddBtn.type = 'button';
  secAddBtn.className = 'course-sec-color-add';
  secAddBtn.title = 'Add tag color stripe';
  if (hasSecColor) secAddBtn.style.display = 'none';

  var secInput = document.createElement('input');
  secInput.type = 'color';
  secInput.className = 'course-sec-color-input';
  secInput.value = secColor || '#3b82f6';
  secInput.title = 'Tag color for ' + course.number;
  if (!hasSecColor) secInput.style.display = 'none';

  var secClearBtn = document.createElement('button');
  secClearBtn.type = 'button';
  secClearBtn.className = 'course-sec-color-clear';
  secClearBtn.textContent = '×';
  secClearBtn.title = 'Remove tag color';
  if (!hasSecColor) secClearBtn.style.display = 'none';

  secAddBtn.addEventListener('click', function() {
    var defaultColor = '#3b82f6';
    ScheduleApp.setSecondaryColor(course.number, defaultColor);
    secInput.value = defaultColor;
    secAddBtn.style.display   = 'none';
    secInput.style.display    = '';
    secClearBtn.style.display = '';
    applySecondaryColor(course.number, defaultColor);
  });

  secInput.addEventListener('input', function() {
    ScheduleApp.setSecondaryColor(course.number, secInput.value);
    applySecondaryColor(course.number, secInput.value);
  });

  secClearBtn.addEventListener('click', function() {
    ScheduleApp.clearSecondaryColor(course.number);
    secAddBtn.style.display   = '';
    secInput.style.display    = 'none';
    secClearBtn.style.display = 'none';
    applySecondaryColor(course.number, '');
  });

  secWrap.appendChild(secAddBtn);
  secWrap.appendChild(secInput);
  secWrap.appendChild(secClearBtn);
  // ──────────────────────────────────────────────────────────────────────────

  var checkLabel = document.createElement('label');
  checkLabel.className = 'course-filter-check-label';

  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'course-filter-cb';
  cb.dataset.course = course.number;
  cb.checked = true;

  var nameSpan = document.createElement('span');
  nameSpan.className = 'course-filter-name';
  nameSpan.textContent = course.number.replace(/^[A-Z]{2,8}\s+/i, ''); // dept prefix is in group header
  nameSpan.title = course.number + ' – ' + course.name;

  var countSpan = document.createElement('span');
  countSpan.className = 'course-section-count';
  countSpan.textContent = '(' + course.count + ')';

  checkLabel.appendChild(cb);
  checkLabel.appendChild(nameSpan);
  checkLabel.appendChild(countSpan);
  row.appendChild(colorInput);
  row.appendChild(secWrap);
  row.appendChild(checkLabel);

  cb.addEventListener('change', function() {
    nameSpan.classList.toggle('muted', !cb.checked);
    applyAllVisibility();
    ScheduleApp.relayoutVisible();
  });

  colorInput.addEventListener('input', function() {
    ScheduleApp.setCourseColor(course.number, colorInput.value);
    applyColor(course.number, colorInput.value);
  });

  return row;
}

function makeInstDeptGroup(dept, instructors, instToCourses) {
  var el   = makeDeptShell(dept, instructors.length);
  var allBtn  = el.allBtn;
  var noneBtn = el.noneBtn;
  var body    = el.body;

  allBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    body.querySelectorAll('.instructor-filter-cb').forEach(function(cb) { cb.checked = true; });
    body.querySelectorAll('.instructor-filter-name').forEach(function(n) { n.classList.remove('muted'); });
    applyAllVisibility();
    ScheduleApp.relayoutVisible();
  });

  noneBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    body.querySelectorAll('.instructor-filter-cb').forEach(function(cb) { cb.checked = false; });
    body.querySelectorAll('.instructor-filter-name').forEach(function(n) { n.classList.add('muted'); });
    applyAllVisibility();
    ScheduleApp.relayoutVisible();
  });

  for (var i = 0; i < instructors.length; i++) {
    (function(inst) {
      var row = document.createElement('div');
      row.className = 'course-filter-row';

      var checkLabel = document.createElement('label');
      checkLabel.className = 'course-filter-check-label';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'instructor-filter-cb';
      cb.dataset.instructor = inst;
      cb.checked = true;

      var nameSpan = document.createElement('span');
      nameSpan.className = 'course-filter-name instructor-filter-name';
      nameSpan.textContent = inst;

      checkLabel.appendChild(cb);
      checkLabel.appendChild(nameSpan);
      row.appendChild(checkLabel);

      var printBtn = document.createElement('button');
      printBtn.className = 'inst-print-btn';
      printBtn.textContent = 'Print';
      printBtn.title = 'Print ' + inst + "'s schedule";
      printBtn.addEventListener('click', function(e) {
        e.stopPropagation();

        // Snapshot current filter state
        var snapCourse = {}, snapInst = {};
        document.querySelectorAll('.course-filter-cb').forEach(function(c) { snapCourse[c.dataset.course] = c.checked; });
        document.querySelectorAll('.instructor-filter-cb').forEach(function(c) { snapInst[c.dataset.instructor] = c.checked; });

        // Apply instructor-only filter without touching localStorage
        var myCourses = (instToCourses && instToCourses[inst]) || {};
        ScheduleApp._suppressPersist = true;
        document.querySelectorAll('.course-filter-cb').forEach(function(c) {
          var on = !!myCourses[c.dataset.course];
          c.checked = on;
          var ns = c.parentElement.querySelector('.course-filter-name');
          if (ns) ns.classList.toggle('muted', !on);
        });
        document.querySelectorAll('.instructor-filter-cb').forEach(function(c) {
          var on = c.dataset.instructor === inst;
          c.checked = on;
          var ns = c.parentElement.querySelector('.instructor-filter-name');
          if (ns) ns.classList.toggle('muted', !on);
        });
        applyAllVisibility();
        ScheduleApp.relayoutVisible();

        ScheduleApp.printNow(null, function() {
          // Restore previous filter state
          document.querySelectorAll('.course-filter-cb').forEach(function(c) {
            var on = (c.dataset.course in snapCourse) ? snapCourse[c.dataset.course] : true;
            c.checked = on;
            var ns = c.parentElement.querySelector('.course-filter-name');
            if (ns) ns.classList.toggle('muted', !on);
          });
          document.querySelectorAll('.instructor-filter-cb').forEach(function(c) {
            var on = (c.dataset.instructor in snapInst) ? snapInst[c.dataset.instructor] : true;
            c.checked = on;
            var ns = c.parentElement.querySelector('.instructor-filter-name');
            if (ns) ns.classList.toggle('muted', !on);
          });
          ScheduleApp._suppressPersist = false;
          applyAllVisibility();
          ScheduleApp.relayoutVisible();
        });
      });
      var icalBtn = document.createElement('button');
      icalBtn.className = 'inst-ical-btn';
      icalBtn.textContent = 'iCal';
      icalBtn.title = 'Export ' + inst + "'s schedule as iCal (.ics)";
      icalBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        ScheduleApp.exportInstructorICal(inst, ScheduleApp._activeSections || [], ScheduleApp._semId || '');
      });

      var btnGroup = document.createElement('div');
      btnGroup.className = 'inst-row-btns';
      btnGroup.appendChild(printBtn);
      btnGroup.appendChild(icalBtn);
      row.appendChild(btnGroup);

      body.appendChild(row);

      cb.addEventListener('change', function() {
        nameSpan.classList.toggle('muted', !cb.checked);
        applyAllVisibility();
        ScheduleApp.relayoutVisible();
      });
    })(instructors[i]);
  }

  return el.el;
}

// Shared dept group shell (header + collapsible body). Returns { el, body, allBtn, noneBtn }.
function makeDeptShell(dept, count, open) {
  var el = document.createElement('div');
  el.className = 'dept-group';

  var header = document.createElement('div');
  header.className = 'dept-header';

  var arrow = document.createElement('span');
  arrow.className = 'dept-arrow';
  arrow.textContent = '▼';

  var nameEl = document.createElement('span');
  nameEl.className = 'dept-name';
  nameEl.textContent = dept;

  var countEl = document.createElement('span');
  countEl.className = 'dept-count';
  countEl.textContent = '(' + count + ')';

  var allBtn  = makeCtrlBtn('All');
  var noneBtn = makeCtrlBtn('None');
  allBtn.className  += ' dept-btn';
  noneBtn.className += ' dept-btn';

  header.appendChild(arrow);
  header.appendChild(nameEl);
  header.appendChild(countEl);
  header.appendChild(allBtn);
  header.appendChild(noneBtn);
  el.appendChild(header);

  var body = document.createElement('div');
  body.className = 'dept-body';
  if (open === false) { body.style.display = 'none'; arrow.textContent = '▶'; }
  el.appendChild(body);

  header.addEventListener('click', function(e) {
    if (e.target === allBtn || e.target === noneBtn) return;
    var isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    arrow.textContent = isOpen ? '▶' : '▼';
  });

  return { el: el, body: body, allBtn: allBtn, noneBtn: noneBtn };
}

function makeCtrlBtn(label) {
  var btn = document.createElement('button');
  btn.textContent = label;
  btn.className = 'sidebar-ctrl-btn';
  return btn;
}

function deptFromCourse(courseNumber) {
  var m = courseNumber.match(/^([A-Z]{2,8})/i);
  return m ? m[1].toUpperCase() : 'OTHER';
}

function levelFromCourse(courseNumber) {
  var m = courseNumber.match(/(\d+)/);
  if (!m) return 'Other';
  var n = parseInt(m[1]);
  if (n >= 1000) return (Math.floor(n / 1000) * 1000) + 's';
  if (n >= 100)  return (Math.floor(n / 100)  * 100)  + 's';
  return n + 's';
}

function applyAllVisibility() {
  var courseVisible = {};
  document.querySelectorAll('.course-filter-cb').forEach(function(cb) {
    courseVisible[cb.dataset.course] = cb.checked;
  });

  var instVisible = {};
  var instFilterExists = document.querySelector('.instructor-filter-cb') !== null;
  if (instFilterExists) {
    document.querySelectorAll('.instructor-filter-cb').forEach(function(cb) {
      instVisible[cb.dataset.instructor] = cb.checked;
    });
  }

  document.querySelectorAll('.course-block, .online-card').forEach(function(el) {
    var courseOk = courseVisible[el.dataset.course] !== false;
    var instOk   = !instFilterExists || instVisible[el.dataset.instructor] !== false;
    el.style.display = (courseOk && instOk) ? '' : 'none';
  });

  // Hide the online panel when all its cards are filtered out; restore it when any become visible.
  // If the user has explicitly hidden it via the toolbar toggle, leave it hidden regardless.
  var onlinePanel = document.getElementById('online-panel');
  if (onlinePanel && onlinePanel.dataset.userHidden !== 'true') {
    var cards = onlinePanel.querySelectorAll('.online-card');
    if (cards.length > 0) {
      var anyVisible = false;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].style.display !== 'none') { anyVisible = true; break; }
      }
      onlinePanel.classList.toggle('hidden', !anyVisible);
    }
  }

  // Persist current filter states (suppressed during instructor print shortcut)
  if (!ScheduleApp._suppressPersist) {
    try {
      document.querySelectorAll('.course-filter-cb').forEach(function(cb) {
        localStorage.setItem('sv_course_vis_' + cb.dataset.course, cb.checked ? '1' : '0');
      });
      document.querySelectorAll('.instructor-filter-cb').forEach(function(cb) {
        localStorage.setItem('sv_inst_vis_' + cb.dataset.instructor, cb.checked ? '1' : '0');
      });
    } catch(e) {}
  }
}

// ── Saved Presets ─────────────────────────────────────────────────────────────

function loadPresets() {
  try { var r = localStorage.getItem('sv_presets'); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}

function savePresets(presets) {
  try { localStorage.setItem('sv_presets', JSON.stringify(presets)); } catch(e) {}
}

function makePresetsSection() {
  var section = makeSection('Saved Presets', true);

  var list = document.createElement('div');
  list.className = 'presets-list';
  section.body.appendChild(list);

  var saveForm = document.createElement('div');
  saveForm.className = 'preset-save-form hidden';

  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'preset-name-input';
  nameInput.placeholder = 'Preset name…';
  nameInput.maxLength = 40;

  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'preset-save-confirm';
  confirmBtn.textContent = '✓';
  confirmBtn.title = 'Save';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'preset-save-cancel';
  cancelBtn.textContent = '✕';
  cancelBtn.title = 'Cancel';

  saveForm.appendChild(nameInput);
  saveForm.appendChild(confirmBtn);
  saveForm.appendChild(cancelBtn);
  section.body.appendChild(saveForm);

  var addBtn = document.createElement('button');
  addBtn.className = 'preset-add-btn';
  addBtn.textContent = '+ Save Current Filters';
  section.body.appendChild(addBtn);

  function renderList() {
    list.innerHTML = '';
    var presets = loadPresets();

    if (!presets.length) {
      var empty = document.createElement('div');
      empty.className = 'preset-empty';
      empty.textContent = 'No saved presets yet.';
      list.appendChild(empty);
      return;
    }

    for (var i = 0; i < presets.length; i++) {
      (function(preset, idx) {
        var row = document.createElement('div');
        row.className = 'preset-row';

        var nameBtn = document.createElement('button');
        nameBtn.className = 'preset-name-btn';
        nameBtn.textContent = preset.name;
        nameBtn.title = 'Apply: ' + preset.name;
        nameBtn.addEventListener('click', function() { applyPreset(preset); });

        var delBtn = document.createElement('button');
        delBtn.className = 'preset-delete-btn';
        delBtn.textContent = '×';
        delBtn.title = 'Delete preset';
        delBtn.addEventListener('click', function() {
          if (!confirm('Delete preset "' + preset.name + '"?')) return;
          var all = loadPresets();
          all.splice(idx, 1);
          savePresets(all);
          renderList();
        });

        row.appendChild(nameBtn);
        row.appendChild(delBtn);
        list.appendChild(row);
      })(presets[i], i);
    }
  }

  function applyPreset(preset) {
    document.querySelectorAll('.course-filter-cb').forEach(function(cb) {
      var on = preset.courses[cb.dataset.course] === true;
      cb.checked = on;
      var ns = cb.parentElement.querySelector('.course-filter-name');
      if (ns) ns.classList.toggle('muted', !on);
    });
    document.querySelectorAll('.instructor-filter-cb').forEach(function(cb) {
      // Presets saved before instructor filters existed won't have an instructors
      // map; fall back to checked so nothing is unexpectedly hidden.
      var on = preset.instructors
        ? (cb.dataset.instructor in preset.instructors ? preset.instructors[cb.dataset.instructor] : true)
        : true;
      cb.checked = on;
      var ns = cb.parentElement.querySelector('.instructor-filter-name');
      if (ns) ns.classList.toggle('muted', !on);
    });
    applyAllVisibility();
    ScheduleApp.relayoutVisible();
  }

  function showForm() {
    saveForm.classList.remove('hidden');
    addBtn.classList.add('hidden');
    nameInput.value = '';
    nameInput.focus();
  }

  function hideForm() {
    saveForm.classList.add('hidden');
    addBtn.classList.remove('hidden');
  }

  function doSave() {
    var name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }

    var courses = {};
    document.querySelectorAll('.course-filter-cb').forEach(function(cb) {
      courses[cb.dataset.course] = cb.checked;
    });

    var instructors = {};
    document.querySelectorAll('.instructor-filter-cb').forEach(function(cb) {
      instructors[cb.dataset.instructor] = cb.checked;
    });

    var all = loadPresets();
    all.push({ id: Date.now().toString(), name: name, courses: courses, instructors: instructors });
    savePresets(all);
    hideForm();
    renderList();
  }

  addBtn.addEventListener('click', showForm);
  confirmBtn.addEventListener('click', doSave);
  cancelBtn.addEventListener('click', hideForm);
  nameInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter')  doSave();
    if (e.key === 'Escape') hideForm();
  });

  renderList();
  return section.el;
}

function applyColor(courseNumber, color) {
  var sel = '.course-block[data-course="' + courseNumber + '"], .online-card[data-course="' + courseNumber + '"]';
  var els = document.querySelectorAll(sel);
  for (var i = 0; i < els.length; i++) {
    els[i].style.background = color;
  }
}

function applySecondaryColor(courseNumber, color) {
  var sel = '.course-block[data-course="' + courseNumber + '"], .online-card[data-course="' + courseNumber + '"]';
  document.querySelectorAll(sel).forEach(function(el) {
    el.style.setProperty('--sec-color', color || 'transparent');
  });
}

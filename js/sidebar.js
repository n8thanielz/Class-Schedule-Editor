window.ScheduleApp = window.ScheduleApp || {};

ScheduleApp.renderSidebar = function(container, schedule, loadedSchedules, onRemove) {
  container.innerHTML = '';

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
  }

  // ── Filter Courses (collapsible, open — grouped by department) ──
  var seenCourses = {};
  var courseDeptMap   = {};
  var courseDeptOrder = [];

  for (var i = 0; i < schedule.sections.length; i++) {
    var s = schedule.sections[i];
    if (!seenCourses[s.courseNumber]) {
      seenCourses[s.courseNumber] = true;
      var dept = deptFromCourse(s.courseNumber);
      if (!courseDeptMap[dept]) { courseDeptMap[dept] = []; courseDeptOrder.push(dept); }
      courseDeptMap[dept].push({ number: s.courseNumber, name: s.courseName });
    }
  }
  courseDeptOrder.sort();
  for (var d = 0; d < courseDeptOrder.length; d++) {
    courseDeptMap[courseDeptOrder[d]].sort(function(a, b) { return a.number.localeCompare(b.number); });
  }

  var courseSection = makeSection('Filter Courses', true);
  for (var d = 0; d < courseDeptOrder.length; d++) {
    courseSection.body.appendChild(makeCourseDeptGroup(courseDeptOrder[d], courseDeptMap[courseDeptOrder[d]]));
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
    instSection.body.appendChild(makeInstDeptGroup(instDeptOrder[d], instByDept[instDeptOrder[d]]));
  }

  container.appendChild(instSection.el);
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

function makeCourseDeptGroup(dept, courses) {
  var el   = makeDeptShell(dept, courses.length);
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

  for (var i = 0; i < courses.length; i++) {
    (function(course) {
      var row = document.createElement('div');
      row.className = 'course-filter-row';

      var colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'course-color-input';
      colorInput.value = ScheduleApp.getCourseColor(course.number);
      colorInput.title = 'Change color for ' + course.number;

      var checkLabel = document.createElement('label');
      checkLabel.className = 'course-filter-check-label';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'course-filter-cb';
      cb.dataset.course = course.number;
      cb.checked = true;

      var nameSpan = document.createElement('span');
      nameSpan.className = 'course-filter-name';
      nameSpan.textContent = course.number;
      nameSpan.title = course.name;

      checkLabel.appendChild(cb);
      checkLabel.appendChild(nameSpan);
      row.appendChild(colorInput);
      row.appendChild(checkLabel);
      body.appendChild(row);

      cb.addEventListener('change', function() {
        nameSpan.classList.toggle('muted', !cb.checked);
        applyAllVisibility();
        ScheduleApp.relayoutVisible();
      });

      colorInput.addEventListener('input', function() {
        ScheduleApp.setCourseColor(course.number, colorInput.value);
        applyColor(course.number, colorInput.value);
      });
    })(courses[i]);
  }

  return el.el;
}

function makeInstDeptGroup(dept, instructors) {
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
function makeDeptShell(dept, count) {
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
  var onlinePanel = document.getElementById('online-panel');
  if (onlinePanel) {
    var cards = onlinePanel.querySelectorAll('.online-card');
    if (cards.length > 0) {
      var anyVisible = false;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].style.display !== 'none') { anyVisible = true; break; }
      }
      onlinePanel.classList.toggle('hidden', !anyVisible);
    }
  }
}

function applyColor(courseNumber, color) {
  var sel = '.course-block[data-course="' + courseNumber + '"], .online-card[data-course="' + courseNumber + '"]';
  var els = document.querySelectorAll(sel);
  for (var i = 0; i < els.length; i++) {
    els[i].style.background = color;
  }
}

window.ScheduleApp = window.ScheduleApp || {};

ScheduleApp.renderSidebar = function(container, schedule) {
  container.innerHTML = '';

  // Collect unique courses in sorted order
  var seen = {};
  var courses = [];
  for (var i = 0; i < schedule.sections.length; i++) {
    var s = schedule.sections[i];
    if (!seen[s.courseNumber]) {
      seen[s.courseNumber] = true;
      courses.push({ number: s.courseNumber, name: s.courseName });
    }
  }
  courses.sort(function(a, b) { return a.number.localeCompare(b.number); });

  // Heading
  var heading = document.createElement('div');
  heading.className = 'sidebar-heading';
  heading.textContent = 'Filter Courses';
  container.appendChild(heading);

  // All / None buttons
  var controls = document.createElement('div');
  controls.className = 'sidebar-controls';

  var allBtn = document.createElement('button');
  allBtn.textContent = 'All';
  allBtn.className = 'sidebar-ctrl-btn';

  var noneBtn = document.createElement('button');
  noneBtn.textContent = 'None';
  noneBtn.className = 'sidebar-ctrl-btn';

  controls.appendChild(allBtn);
  controls.appendChild(noneBtn);
  container.appendChild(controls);

  allBtn.addEventListener('click', function() {
    container.querySelectorAll('.course-filter-cb').forEach(function(cb) {
      cb.checked = true;
      applyVisibility(cb.dataset.course, true);
    });
    container.querySelectorAll('.course-filter-name').forEach(function(n) {
      n.classList.remove('muted');
    });
    ScheduleApp.relayoutVisible();
  });

  noneBtn.addEventListener('click', function() {
    container.querySelectorAll('.course-filter-cb').forEach(function(cb) {
      cb.checked = false;
      applyVisibility(cb.dataset.course, false);
    });
    container.querySelectorAll('.course-filter-name').forEach(function(n) {
      n.classList.add('muted');
    });
    ScheduleApp.relayoutVisible();
  });

  // One row per course
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
      container.appendChild(row);

      cb.addEventListener('change', function() {
        applyVisibility(course.number, cb.checked);
        nameSpan.classList.toggle('muted', !cb.checked);
        ScheduleApp.relayoutVisible();
      });

      colorInput.addEventListener('input', function() {
        ScheduleApp.setCourseColor(course.number, colorInput.value);
        applyColor(course.number, colorInput.value);
      });
    })(courses[i]);
  }
};

function applyVisibility(courseNumber, visible) {
  var sel = '.course-block[data-course="' + courseNumber + '"], .online-card[data-course="' + courseNumber + '"]';
  var els = document.querySelectorAll(sel);
  for (var i = 0; i < els.length; i++) {
    els[i].style.display = visible ? '' : 'none';
  }
}

function applyColor(courseNumber, color) {
  var sel = '.course-block[data-course="' + courseNumber + '"], .online-card[data-course="' + courseNumber + '"]';
  var els = document.querySelectorAll(sel);
  for (var i = 0; i < els.length; i++) {
    els[i].style.background = color;
  }
}

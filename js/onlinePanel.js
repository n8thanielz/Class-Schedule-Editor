window.ScheduleApp = window.ScheduleApp || {};

ScheduleApp.renderOnlinePanel = function(container, schedule) {
  container.innerHTML = '';

  var onlineSections = schedule.sections.filter(function(s) {
    if (s.isOnline || /^ONLINE$/i.test(s.room)) return true;
    return s.doesNotMeet && /^09\d/.test(s.sectionNumber);
  });

  if (!onlineSections.length) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  var heading = document.createElement('div');
  heading.className = 'online-panel-heading';
  heading.textContent = 'Online / Asynchronous Sections';
  container.appendChild(heading);

  var cards = document.createElement('div');
  cards.className = 'online-cards';
  container.appendChild(cards);

  // Sort by course number then section number
  onlineSections.sort(function(a, b) {
    var cn = a.courseNumber.localeCompare(b.courseNumber);
    return cn !== 0 ? cn : a.sectionNumber.localeCompare(b.sectionNumber);
  });

  onlineSections.forEach(function(s) {
    var deptStripped = s.courseNumber.replace(/^[A-Z]+\s*/i, '');
    var shortNum = deptStripped + '-' + s.sectionNumber;
    var isOnlineSec = /^09\d/.test(s.sectionNumber);
    var roomLabel = s.room || (isOnlineSec ? 'Online' : '');

    var card = document.createElement('div');
    card.className = 'online-card';
    card.dataset.course      = s.courseNumber;
    card.dataset.sectionId   = s.id;
    card.dataset.instructor  = s.instructor;
    card.style.background  = ScheduleApp.getCourseColor(s.courseNumber);
    card.title = [
      s.courseNumber + ' – ' + s.courseName,
      'Section ' + s.sectionNumber + ' (' + s.type + ')',
      'Instructor: ' + s.instructor,
      roomLabel
    ].join('\n');

    var numEl = document.createElement('div');
    numEl.className = 'online-card-number';
    numEl.textContent = shortNum;
    card.appendChild(numEl);

    var instEl = document.createElement('div');
    instEl.className = 'online-card-instructor';
    instEl.textContent = s.instructor;
    card.appendChild(instEl);

    var roomEl = document.createElement('div');
    roomEl.className = 'online-card-room';
    roomEl.textContent = roomLabel;
    card.appendChild(roomEl);

    if (s.dateRange) {
      var datesEl = document.createElement('div');
      datesEl.className = 'online-card-dates';
      datesEl.textContent = s.dateRange;
      card.appendChild(datesEl);
    }

    cards.appendChild(card);
  });
};

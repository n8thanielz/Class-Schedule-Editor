var uploadView    = document.getElementById('upload-view');
var scheduleView  = document.getElementById('schedule-view');
var pdfInput      = document.getElementById('pdf-input');
var addFileInput  = document.getElementById('add-file-input');
var addFileBtn    = document.getElementById('add-file-btn');
var uploadError   = document.getElementById('upload-error');
var uploadLoading = document.getElementById('upload-loading');
var scheduleTitle = document.getElementById('schedule-title');
var scheduleGrid  = document.getElementById('schedule-grid');
var courseSidebar = document.getElementById('course-sidebar');
var onlinePanel   = document.getElementById('online-panel');
var newUploadBtn      = document.getElementById('new-upload-btn');
var toggleOnlineBtn   = document.getElementById('toggle-online-btn');

var loadedSchedules = [];

function buildTitle() {
  if (!loadedSchedules.length) return 'Schedule';
  if (loadedSchedules.length === 1) return loadedSchedules[0].semester;
  var prefix = loadedSchedules[0].semPrefix ? loadedSchedules[0].semPrefix + ' ' : '';
  var depts = [];
  for (var i = 0; i < loadedSchedules.length; i++) {
    var d = loadedSchedules[i].dept;
    if (d && depts.indexOf(d) === -1) depts.push(d);
  }
  return depts.length ? prefix + depts.join(' + ') + ' Schedule' : 'Combined Schedule';
}

function mergeSchedules() {
  var allSections = [];
  for (var i = 0; i < loadedSchedules.length; i++) {
    allSections = allSections.concat(loadedSchedules[i].sections);
  }
  return { semester: buildTitle(), sections: allSections };
}

function renderAll() {
  var merged = mergeSchedules();
  scheduleTitle.textContent = merged.semester;
  ScheduleApp.renderSchedule(scheduleGrid, merged);

  // Apply persisted hide-online preference before the panel renders so it
  // picks up wasUserHidden correctly inside renderOnlinePanel.
  try { if (localStorage.getItem('sv_hide_online') === '1') onlinePanel.dataset.userHidden = 'true'; } catch(e) {}

  ScheduleApp.renderOnlinePanel(onlinePanel, merged);
  ScheduleApp.renderSidebar(courseSidebar, merged, loadedSchedules, removeFile);

  // Sync toolbar button with actual panel state after render
  var isHidden = onlinePanel.dataset.userHidden === 'true';
  toggleOnlineBtn.textContent = isHidden ? 'Show Online' : 'Hide Online';
  toggleOnlineBtn.classList.toggle('active', isHidden);
}

function removeFile(index) {
  loadedSchedules.splice(index, 1);
  if (!loadedSchedules.length) {
    scheduleView.classList.add('hidden');
    uploadView.classList.remove('hidden');
    scheduleGrid.innerHTML = '';
    onlinePanel.innerHTML  = '';
    courseSidebar.innerHTML = '';
    addFileBtn.classList.add('hidden');
    return;
  }
  renderAll();
}

async function loadFile(file) {
  var isCsv = /\.csv$/i.test(file.name);
  var schedule = isCsv
    ? await ScheduleApp.parseCSV(file)
    : await ScheduleApp.parsePDF(file);
  loadedSchedules.push(schedule);
}

pdfInput.addEventListener('change', async function(e) {
  var file = e.target.files[0];
  if (!file) return;

  uploadError.classList.add('hidden');
  uploadLoading.classList.remove('hidden');
  pdfInput.disabled = true;

  try {
    loadedSchedules = [];
    var files = e.target.files;
    for (var i = 0; i < files.length; i++) {
      await loadFile(files[i]);
    }
    renderAll();
    uploadView.classList.add('hidden');
    scheduleView.classList.remove('hidden');
    addFileBtn.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    uploadError.textContent = 'Could not parse file: ' + err.message;
    uploadError.classList.remove('hidden');
  } finally {
    uploadLoading.classList.add('hidden');
    pdfInput.disabled = false;
    pdfInput.value = '';
  }
});

addFileBtn.addEventListener('click', function() {
  addFileInput.click();
});

addFileInput.addEventListener('change', async function(e) {
  var file = e.target.files[0];
  if (!file) return;

  addFileBtn.disabled = true;
  addFileBtn.textContent = '…';

  try {
    await loadFile(file);
    renderAll();
  } catch (err) {
    console.error(err);
    alert('Could not parse file: ' + err.message);
  } finally {
    addFileBtn.disabled = false;
    addFileBtn.textContent = '+ Add File';
    addFileInput.value = '';
  }
});

toggleOnlineBtn.addEventListener('click', function() {
  var hidden = onlinePanel.dataset.userHidden === 'true';
  if (hidden) {
    delete onlinePanel.dataset.userHidden;
    onlinePanel.classList.remove('hidden');
    toggleOnlineBtn.textContent = 'Hide Online';
    toggleOnlineBtn.classList.remove('active');
    try { localStorage.setItem('sv_hide_online', '0'); } catch(e) {}
  } else {
    onlinePanel.dataset.userHidden = 'true';
    onlinePanel.classList.add('hidden');
    toggleOnlineBtn.textContent = 'Show Online';
    toggleOnlineBtn.classList.add('active');
    try { localStorage.setItem('sv_hide_online', '1'); } catch(e) {}
  }
});

newUploadBtn.addEventListener('click', function() {
  loadedSchedules = [];
  scheduleView.classList.add('hidden');
  uploadView.classList.remove('hidden');
  scheduleGrid.innerHTML = '';
  onlinePanel.innerHTML  = '';
  delete onlinePanel.dataset.userHidden;
  courseSidebar.innerHTML = '';
  addFileBtn.classList.add('hidden');
  toggleOnlineBtn.textContent = 'Hide Online';
  toggleOnlineBtn.classList.remove('active');
});

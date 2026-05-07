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
var newUploadBtn  = document.getElementById('new-upload-btn');

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
  ScheduleApp.renderOnlinePanel(onlinePanel, merged);
  ScheduleApp.renderSidebar(courseSidebar, merged, loadedSchedules, removeFile);
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
    await loadFile(file);
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

newUploadBtn.addEventListener('click', function() {
  loadedSchedules = [];
  scheduleView.classList.add('hidden');
  uploadView.classList.remove('hidden');
  scheduleGrid.innerHTML = '';
  onlinePanel.innerHTML  = '';
  courseSidebar.innerHTML = '';
  addFileBtn.classList.add('hidden');
});

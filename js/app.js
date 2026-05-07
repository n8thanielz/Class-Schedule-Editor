var uploadView    = document.getElementById('upload-view');
var scheduleView  = document.getElementById('schedule-view');
var pdfInput      = document.getElementById('pdf-input');
var uploadError   = document.getElementById('upload-error');
var uploadLoading = document.getElementById('upload-loading');
var scheduleTitle = document.getElementById('schedule-title');
var scheduleGrid  = document.getElementById('schedule-grid');
var courseSidebar = document.getElementById('course-sidebar');
var onlinePanel   = document.getElementById('online-panel');
var newUploadBtn  = document.getElementById('new-upload-btn');

pdfInput.addEventListener('change', async function(e) {
  var file = e.target.files[0];
  if (!file) return;

  uploadError.classList.add('hidden');
  uploadLoading.classList.remove('hidden');
  pdfInput.disabled = true;

  try {
    var isCsv = /\.csv$/i.test(file.name);
    var schedule = isCsv
      ? await ScheduleApp.parseCSV(file)
      : await ScheduleApp.parsePDF(file);
    scheduleTitle.textContent = schedule.semester;
    ScheduleApp.renderSchedule(scheduleGrid, schedule);
    ScheduleApp.renderOnlinePanel(onlinePanel, schedule);
    ScheduleApp.renderSidebar(courseSidebar, schedule);
    uploadView.classList.add('hidden');
    scheduleView.classList.remove('hidden');
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

newUploadBtn.addEventListener('click', function() {
  scheduleView.classList.add('hidden');
  uploadView.classList.remove('hidden');
  scheduleGrid.innerHTML = '';
  onlinePanel.innerHTML  = '';
  courseSidebar.innerHTML = '';
});

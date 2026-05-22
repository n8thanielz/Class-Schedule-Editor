document.getElementById('export-pdf-btn').addEventListener('click', function() {
  var defaultName = ScheduleApp.defaultExportPrefix();
  ScheduleApp.showExportNamePrompt('Export PDF', defaultName, '.pdf', function(name) {
    _doExportPDF(name + '.pdf');
  });
});

function _doExportPDF(filename) {
  var btn            = document.getElementById('export-pdf-btn');
  var sidebar        = document.getElementById('course-sidebar');
  var toolbarActions = document.querySelector('.toolbar-actions');
  var toolbar        = document.querySelector('.toolbar');
  var scheduleView   = document.getElementById('schedule-view');
  var scheduleBody   = document.querySelector('.schedule-body');

  var isLandscape = ScheduleApp.shouldUseLandscape();

  btn.disabled    = true;
  btn.textContent = isLandscape ? 'Exporting (Landscape)…' : 'Exporting…';

  sidebar.style.display        = 'none';
  toolbarActions.style.display = 'none';
  toolbar.style.position       = 'static';
  toolbar.style.boxShadow      = 'none';
  scheduleView.style.minHeight = '0';
  scheduleBody.style.display   = 'block';

  var result = ScheduleApp.applyExportTransform(isLandscape);

  scheduleView.style.width    = result.availW + 'px';
  scheduleView.style.height   = result.totalH + 'px';
  scheduleView.style.overflow = 'hidden';

  function restore() {
    result.restore();
    scheduleView.style.width     = '';
    scheduleView.style.height    = '';
    scheduleView.style.overflow  = '';
    scheduleBody.style.display   = '';
    sidebar.style.display        = '';
    toolbarActions.style.display = '';
    toolbar.style.position       = '';
    toolbar.style.boxShadow      = '';
    scheduleView.style.minHeight = '';
    btn.disabled    = false;
    btn.textContent = 'Export PDF';
  }

  html2pdf()
    .set({
      margin:      0.5,
      filename:    filename,
      image:       { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0,
                     width: result.availW, height: result.totalH },
      jsPDF:       { unit: 'in', format: 'letter', orientation: isLandscape ? 'landscape' : 'portrait' }
    })
    .from(scheduleView)
    .save()
    .then(restore)
    .catch(function(err) { restore(); console.error('Export failed:', err); });
}

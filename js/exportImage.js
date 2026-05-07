document.getElementById('export-pdf-btn').addEventListener('click', function() {
  var btn            = document.getElementById('export-pdf-btn');
  var sidebar        = document.getElementById('course-sidebar');
  var toolbarActions = document.querySelector('.toolbar-actions');
  var toolbar        = document.querySelector('.toolbar');
  var scheduleView   = document.getElementById('schedule-view');
  var scheduleBody   = document.querySelector('.schedule-body');
  var titleEl        = document.getElementById('schedule-title');

  var filename = (titleEl ? titleEl.textContent : 'schedule')
    .replace(/[^a-z0-9 _-]/gi, '_').trim() + '.pdf';

  btn.disabled    = true;
  btn.textContent = 'Exporting…';

  // Hide elements not wanted in the export
  sidebar.style.display        = 'none';
  toolbarActions.style.display = 'none';
  toolbar.style.position       = 'static';
  toolbar.style.boxShadow      = 'none';
  scheduleView.style.minHeight = '0';
  scheduleBody.style.display   = 'block';

  var result = ScheduleApp.applyExportTransform();

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
      jsPDF:       { unit: 'in', format: 'letter', orientation: 'portrait' }
    })
    .from(scheduleView)
    .save()
    .then(restore)
    .catch(function(err) { restore(); console.error('Export failed:', err); });
});

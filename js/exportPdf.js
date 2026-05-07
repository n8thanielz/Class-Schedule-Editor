document.getElementById('export-btn').addEventListener('click', function() {
  var scheduleView = document.getElementById('schedule-view');
  var result = ScheduleApp.applyExportTransform();

  scheduleView.style.width    = result.availW + 'px';
  scheduleView.style.height   = result.totalH + 'px';
  scheduleView.style.overflow = 'hidden';

  document.body.classList.add('exporting');

  function restore() {
    result.restore();
    scheduleView.style.width    = '';
    scheduleView.style.height   = '';
    scheduleView.style.overflow = '';
    document.body.classList.remove('exporting');
    window.removeEventListener('afterprint', restore);
  }

  window.addEventListener('afterprint', restore);
  window.print();
});

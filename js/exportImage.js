document.getElementById('export-pdf-btn').addEventListener('click', function() {
  var scheduleView   = document.getElementById('schedule-view');
  var sidebar        = document.getElementById('course-sidebar');
  var toolbarActions = document.querySelector('.toolbar-actions');
  var toolbar        = document.querySelector('.toolbar');
  var scheduleBody   = document.querySelector('.schedule-body');
  var wrapper        = document.querySelector('.schedule-wrapper');
  var grid           = document.getElementById('schedule-grid');
  var onlinePanel    = document.getElementById('online-panel');
  var titleEl        = document.getElementById('schedule-title');

  var filename = (titleEl ? titleEl.textContent : 'schedule')
    .replace(/[^a-z0-9 _-]/gi, '_').trim() + '.pdf';

  var MARGIN_IN = 0.5;
  var MARGIN_PX = Math.round(MARGIN_IN * 96); // 48px
  var availW    = 816  - 2 * MARGIN_PX;       // 720px
  var availH    = 1056 - 2 * MARGIN_PX;       // 960px
  var GAP       = 14;

  // --- Hide elements not wanted in the export ---
  sidebar.style.display        = 'none';
  toolbarActions.style.display = 'none';
  toolbar.style.position       = 'static';
  toolbar.style.boxShadow      = 'none';
  scheduleView.style.minHeight = '0';
  scheduleBody.style.display   = 'block';

  // --- Identical scaling logic to the Print button ---
  // Set panel width so card wrapping is accurate before measuring height.
  if (!onlinePanel.classList.contains('hidden')) {
    onlinePanel.style.width = availW + 'px';
  }
  var rawPanelH = onlinePanel.classList.contains('hidden') ? 0 : onlinePanel.offsetHeight;
  var panelH    = rawPanelH > 0 ? rawPanelH + GAP : 0;

  var toolbarH  = toolbar.offsetHeight;
  var gridAvailH = availH - toolbarH - 12 - panelH;
  var naturalH  = grid.scrollHeight;
  var scale     = Math.min(gridAvailH / naturalH, 1);
  var printW    = Math.ceil(availW / scale);
  var scaledH   = Math.ceil(naturalH * scale);

  // html2canvas respects transform + overflow:hidden, producing the correct scaled output.
  grid.style.transformOrigin = 'top left';
  grid.style.transform       = 'scale(' + scale + ')';
  wrapper.style.width        = printW + 'px';
  wrapper.style.height       = (scaledH + panelH) + 'px';
  wrapper.style.overflow     = 'hidden';
  wrapper.style.padding      = '0';

  if (rawPanelH > 0) {
    onlinePanel.style.marginTop = '-' + (naturalH - scaledH - GAP) + 'px';
  }

  scheduleBody.style.overflow = 'hidden';
  scheduleBody.style.width    = availW + 'px';

  var totalH = toolbarH + 12 + scaledH + panelH;
  scheduleView.style.width    = availW + 'px';
  scheduleView.style.height   = totalH + 'px';
  scheduleView.style.overflow = 'hidden';

  function restore() {
    grid.style.transform        = '';
    grid.style.transformOrigin  = '';
    wrapper.style.width         = '';
    wrapper.style.height        = '';
    wrapper.style.overflow      = '';
    wrapper.style.padding       = '';
    if (rawPanelH > 0) { onlinePanel.style.marginTop = ''; onlinePanel.style.width = ''; }
    scheduleBody.style.overflow = '';
    scheduleBody.style.width    = '';
    scheduleBody.style.display  = '';
    sidebar.style.display        = '';
    toolbarActions.style.display = '';
    toolbar.style.position       = '';
    toolbar.style.boxShadow      = '';
    scheduleView.style.minHeight = '';
    scheduleView.style.width     = '';
    scheduleView.style.height    = '';
    scheduleView.style.overflow  = '';
  }

  html2pdf()
    .set({
      margin:      MARGIN_IN,
      filename:    filename,
      image:       { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0,
                     width: availW, height: totalH },
      jsPDF:       { unit: 'in', format: 'letter', orientation: 'portrait' }
    })
    .from(scheduleView)
    .save()
    .then(restore)
    .catch(function(err) { restore(); console.error('Export failed:', err); });
});

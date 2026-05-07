window.ScheduleApp = window.ScheduleApp || {};

// Shared DOM setup used by both Print and Export PDF.
// Measures the online panel, scales the grid to fit a letter page, and applies
// the transform. Returns { availW, totalH, restore } so each caller can finish
// its own output (window.print or html2pdf) and then call restore().
ScheduleApp.applyExportTransform = function() {
  var grid         = document.getElementById('schedule-grid');
  var wrapper      = document.querySelector('.schedule-wrapper');
  var scheduleBody = document.querySelector('.schedule-body');
  var toolbar      = document.querySelector('.toolbar');
  var onlinePanel  = document.getElementById('online-panel');

  var MARGIN_PX = Math.round(0.5 * 96); // 0.5-in margin @ 96 dpi = 48 px
  var availW    = 816  - 2 * MARGIN_PX; // 720 px
  var availH    = 1056 - 2 * MARGIN_PX; // 960 px
  var GAP       = 14;

  if (!onlinePanel.classList.contains('hidden')) {
    onlinePanel.style.width = availW + 'px';
  }
  var rawPanelH = onlinePanel.classList.contains('hidden') ? 0 : onlinePanel.offsetHeight;
  var panelH    = rawPanelH > 0 ? rawPanelH + GAP : 0;

  var toolbarH   = toolbar.offsetHeight;
  var gridAvailH = availH - toolbarH - 12 - panelH;
  var naturalH   = grid.scrollHeight;
  var scale      = Math.min(gridAvailH / naturalH, 1);
  var printW     = Math.ceil(availW / scale);
  var scaledH    = Math.ceil(naturalH * scale);

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
  }

  return {
    availW:  availW,
    totalH:  toolbarH + 12 + scaledH + panelH,
    restore: restore
  };
};

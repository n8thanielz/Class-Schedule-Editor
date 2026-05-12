window.ScheduleApp = window.ScheduleApp || {};

// Returns true when the visible grid would render better in landscape.
// Triggers when 4+ day columns are visible, or any column has 3+ side-by-side blocks.
ScheduleApp.shouldUseLandscape = function() {
  var SA = ScheduleApp;
  if (!SA._usedDays || !SA._dayColumns) return false;

  var visibleDays = SA._usedDays.filter(function(day) {
    var col = SA._dayColumns[day];
    return col && col.style.display !== 'none';
  });

  if (visibleDays.length >= 4) return true;

  for (var i = 0; i < visibleDays.length; i++) {
    var col    = SA._dayColumns[visibleDays[i]];
    var blocks = col.querySelectorAll('.course-block');
    for (var j = 0; j < blocks.length; j++) {
      var w = parseFloat(blocks[j].style.width);
      if (!isNaN(w) && w < 34) return true; // width < 34% means 3+ columns
    }
  }

  return false;
};

// Shared DOM setup used by both Print and Export PDF.
// Measures the online panel, scales the grid to fit a letter page, and applies
// the transform. Returns { availW, totalH, restore } so each caller can finish
// its own output (window.print or html2pdf) and then call restore().
ScheduleApp.applyExportTransform = function(isLandscape) {
  var grid         = document.getElementById('schedule-grid');
  var wrapper      = document.querySelector('.schedule-wrapper');
  var scheduleBody = document.querySelector('.schedule-body');
  var toolbar      = document.querySelector('.toolbar');
  var onlinePanel  = document.getElementById('online-panel');

  var MARGIN_PX = Math.round(0.5 * 96); // 0.5-in margin @ 96 dpi = 48 px
  var PAGE_W    = isLandscape ? 1056 : 816;
  var PAGE_H    = isLandscape ? 816  : 1056;
  var availW    = PAGE_W - 2 * MARGIN_PX;
  var availH    = PAGE_H - 2 * MARGIN_PX;
  var GAP       = 14;

  // Apply compact styles before measuring so panel height reflects the smaller cards
  document.body.classList.add('print-compact');

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
    document.body.classList.remove('print-compact');
  }

  return {
    availW:  availW,
    totalH:  toolbarH + 12 + scaledH + panelH,
    restore: restore
  };
};

// Fires window.print() with auto landscape detection.
// btn: optional element whose label is updated during print.
// afterPrint: optional callback invoked after the print dialog closes.
ScheduleApp.printNow = function(btn, afterPrint) {
  var origLabel    = btn ? btn.textContent : '';
  var scheduleView = document.getElementById('schedule-view');
  var isLandscape  = ScheduleApp.shouldUseLandscape();
  var result       = ScheduleApp.applyExportTransform(isLandscape);

  scheduleView.style.width    = result.availW + 'px';
  scheduleView.style.height   = result.totalH + 'px';
  scheduleView.style.overflow = 'hidden';
  document.body.classList.add('exporting');

  var styleEl = null;
  if (isLandscape) {
    styleEl = document.createElement('style');
    styleEl.textContent = '@page { size: landscape; }';
    document.head.appendChild(styleEl);
    if (btn) btn.textContent = 'Printing (Landscape)…';
  }

  function restore() {
    result.restore();
    scheduleView.style.width    = '';
    scheduleView.style.height   = '';
    scheduleView.style.overflow = '';
    document.body.classList.remove('exporting');
    if (styleEl) { document.head.removeChild(styleEl); }
    if (btn) btn.textContent = origLabel;
    window.removeEventListener('afterprint', restore);
    if (afterPrint) afterPrint();
  }

  window.addEventListener('afterprint', restore);
  window.print();
};

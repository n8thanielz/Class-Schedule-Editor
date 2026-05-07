document.getElementById('export-btn').addEventListener('click', function() {
  var grid         = document.getElementById('schedule-grid');
  var wrapper      = document.querySelector('.schedule-wrapper');
  var scheduleBody = document.querySelector('.schedule-body');
  var toolbar      = document.querySelector('.toolbar');
  var onlinePanel  = document.getElementById('online-panel');

  // Letter portrait: 816 × 1056 CSS px  (@page margin: 0.5in = 48px each side)
  var pagePad     = Math.round(0.5 * 96);   // 48px each side
  var availW      = 816  - pagePad * 2;     // 720px
  var totalAvailH = 1056 - pagePad * 2 - (toolbar.offsetHeight + 12);

  // Reserve space for the online panel if visible.
  // Set width to availW first so card wrapping is accurate before measuring height.
  var GAP = 14;
  if (onlinePanel && !onlinePanel.classList.contains('hidden')) {
    onlinePanel.style.width = availW + 'px';
  }
  var rawPanelH = (onlinePanel && !onlinePanel.classList.contains('hidden'))
    ? onlinePanel.offsetHeight : 0;
  var panelH    = rawPanelH > 0 ? rawPanelH + GAP : 0;

  var availH  = totalAvailH - panelH;
  var naturalH = grid.scrollHeight;
  var scale    = Math.min(availH / naturalH, 1);
  var printW   = Math.ceil(availW / scale);
  var scaledH  = Math.ceil(naturalH * scale);

  grid.style.transformOrigin = 'top left';
  grid.style.transform       = 'scale(' + scale + ')';
  wrapper.style.width        = printW + 'px';
  wrapper.style.height       = (scaledH + panelH) + 'px';
  wrapper.style.overflow     = 'hidden';
  wrapper.style.padding      = '0';

  // Pull the panel up so it sits GAP px below the scaled grid bottom.
  // transform doesn't affect layout, so panel would otherwise appear at naturalH.
  if (rawPanelH > 0) {
    onlinePanel.style.marginTop = '-' + (naturalH - scaledH - GAP) + 'px';
  }

  scheduleBody.style.overflow = 'hidden';
  scheduleBody.style.width    = availW + 'px';

  document.body.classList.add('exporting');

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
    document.body.classList.remove('exporting');
    window.removeEventListener('afterprint', restore);
  }
  window.addEventListener('afterprint', restore);

  window.print();
});

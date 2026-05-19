window.ScheduleApp = window.ScheduleApp || {};

// ── Standard time blocks ─────────────────────────────────────────────────────
var SNAP_BLOCKS = {
  MW:  [
    { start: '8:05am',  end: '9:25am'  },
    { start: '9:40am',  end: '11:00am' },
    { start: '11:50am', end: '1:10pm'  },
    { start: '1:25pm',  end: '2:45pm'  },
    { start: '3:00pm',  end: '4:20pm'  },
    { start: '4:35pm',  end: '5:55pm'  },
    { start: '6:00pm',  end: '9:00pm'  }
  ],
  TTh: [
    { start: '7:30am',  end: '8:50am'  },
    { start: '9:10am',  end: '10:30am' },
    { start: '10:45am', end: '12:05pm' },
    { start: '12:25pm', end: '1:45pm'  },
    { start: '2:00pm',  end: '3:20pm'  },
    { start: '3:40pm',  end: '5:00pm'  },
    { start: '6:00pm',  end: '9:00pm'  }
  ]
};

ScheduleApp.SNAP_BLOCKS = SNAP_BLOCKS;

ScheduleApp._editMode = false;
ScheduleApp._isDirty  = false;

// ── Edit mode toggle ──────────────────────────────────────────────────────────

ScheduleApp.enterEditMode = function() {
  ScheduleApp._editMode = true;
  document.body.classList.add('edit-mode');
  var btn = document.getElementById('edit-mode-btn');
  if (btn) { btn.textContent = 'Exit Edit Mode'; btn.classList.add('active'); }
  var addBtn = document.getElementById('add-section-btn');
  if (addBtn) addBtn.classList.remove('hidden');
  _attachBlockListeners();
};

ScheduleApp.exitEditMode = function() {
  ScheduleApp._editMode = false;
  ScheduleApp._isDirty  = false;
  document.body.classList.remove('edit-mode');
  var btn = document.getElementById('edit-mode-btn');
  if (btn) { btn.textContent = 'Edit Mode'; btn.classList.remove('active'); }
  var addBtn = document.getElementById('add-section-btn');
  if (addBtn) addBtn.classList.add('hidden');
};

ScheduleApp.toggleEditMode = function() {
  if (ScheduleApp._editMode) {
    ScheduleApp.promptIfDirty(ScheduleApp.exitEditMode);
  } else {
    ScheduleApp.enterEditMode();
  }
};

ScheduleApp.markDirty = function() {
  ScheduleApp._isDirty = true;
};

ScheduleApp.promptIfDirty = function(cb) {
  if (!ScheduleApp._isDirty) { cb(); return; }
  if (confirm('You have unsaved edits that will be lost. Continue without exporting?')) {
    ScheduleApp._isDirty = false;
    cb();
  }
};

// ── Section lookup ────────────────────────────────────────────────────────────

ScheduleApp.findSection = function(sectionId) {
  var schedules = ScheduleApp.getLoadedSchedules();
  for (var fi = 0; fi < schedules.length; fi++) {
    var secs = schedules[fi].sections;
    for (var si = 0; si < secs.length; si++) {
      if (secs[si].id === sectionId) return { section: secs[si], fileIndex: fi };
    }
  }
  return null;
};

// ── Day pattern helpers ───────────────────────────────────────────────────────

var _MW_DAYS  = ['M', 'W', 'F'];
var _TTH_DAYS = ['T', 'Th'];

function _isMWFamily(days) {
  return days.some(function(d) { return _MW_DAYS.indexOf(d) !== -1; });
}

function _isTThFamily(days) {
  return days.some(function(d) { return _TTH_DAYS.indexOf(d) !== -1; });
}

// Given the hovered day, return the target day array.
// If hovering over the same family as original, return original unchanged.
// If crossing to a new family, return the canonical 2-day set for that family.
function _targetDays(origDays, hoveredDay) {
  if (!hoveredDay) return origDays;
  var hoverMW  = _MW_DAYS.indexOf(hoveredDay)  !== -1;
  var hoverTTh = _TTH_DAYS.indexOf(hoveredDay) !== -1;
  if (hoverMW  && _isMWFamily(origDays))  return origDays;
  if (hoverTTh && _isTThFamily(origDays)) return origDays;
  if (hoverMW)  return ['M', 'W'];
  if (hoverTTh) return ['T', 'Th'];
  return origDays;
}

function _isCrossDay(origDays, tgtDays) {
  return (_isMWFamily(origDays) && _isTThFamily(tgtDays)) ||
         (_isTThFamily(origDays) && _isMWFamily(tgtDays));
}

// Find which day column the cursor x-coordinate falls inside.
function _dayAtX(x) {
  var cols = ScheduleApp._dayColumns;
  if (!cols) return null;
  for (var day in cols) {
    var rect = cols[day].getBoundingClientRect();
    if (x >= rect.left && x <= rect.right) return day;
  }
  return null;
}

// ── Snap logic ────────────────────────────────────────────────────────────────

function _snapBlock(startMin, days) {
  var hasMW  = _isMWFamily(days);
  var hasTTh = _isTThFamily(days);
  var blocks = hasTTh && !hasMW ? SNAP_BLOCKS.TTh : SNAP_BLOCKS.MW;

  var best = null, bestDist = Infinity;
  for (var i = 0; i < blocks.length; i++) {
    var dist = Math.abs(startMin - ScheduleApp.timeToMinutes(blocks[i].start));
    if (dist < bestDist) { bestDist = dist; best = blocks[i]; }
  }
  return bestDist <= 45 ? best : null;
}

// ── Snap indicator (ghost overlay in target columns) ─────────────────────────

function _showSnapIndicator(snap, days) {
  _clearSnapIndicator();
  if (!snap) return;
  var cols = ScheduleApp._dayColumns;
  if (!cols) return;
  var SA     = ScheduleApp;
  var top    = (SA.timeToMinutes(snap.start) - SA.GRID_START) * SA.PX_PER_MIN;
  var height = (SA.timeToMinutes(snap.end)   - SA.timeToMinutes(snap.start)) * SA.PX_PER_MIN;
  days.forEach(function(day) {
    var col = cols[day];
    if (!col) return;
    var ind = document.createElement('div');
    ind.className = 'snap-indicator';
    ind.style.top    = top + 'px';
    ind.style.height = height + 'px';
    col.appendChild(ind);
  });
}

function _clearSnapIndicator() {
  document.querySelectorAll('.snap-indicator').forEach(function(el) {
    el.parentNode && el.parentNode.removeChild(el);
  });
}

// ── Drag state ────────────────────────────────────────────────────────────────

var _drag = null;

function _attachBlockListeners() {
  document.querySelectorAll('.course-block').forEach(function(block) {
    if (!block._editorBound) {
      block._editorBound = true;
      block.addEventListener('mousedown', _onBlockMouseDown);
      block.addEventListener('click',     _onBlockClick);
    }
  });
}

ScheduleApp.attachEditorBlockListeners = _attachBlockListeners;

function _onBlockClick(e) {
  if (!ScheduleApp._editMode || _drag && _drag.didMove) return;
  e.stopPropagation();
  var result = ScheduleApp.findSection(this.dataset.sectionId);
  if (!result) return;
  ScheduleApp.openSectionModal(result.section, result.fileIndex);
}

function _onBlockMouseDown(e) {
  if (!ScheduleApp._editMode) return;
  if (e.button !== 0) return;
  var result = ScheduleApp.findSection(this.dataset.sectionId);
  if (!result || result.section._multiSession) return;

  e.preventDefault();

  var allBlocks = Array.from(
    document.querySelectorAll('.course-block[data-section-id="' + this.dataset.sectionId + '"]')
  );

  _drag = {
    section:     result.section,
    startY:      e.clientY,
    startX:      e.clientX,
    didMove:     false,
    blocks:      allBlocks,
    origTops:    allBlocks.map(function(b) { return parseFloat(b.style.top) || 0; }),
    pendingSnap: null,
    pendingDays: null
  };

  allBlocks.forEach(function(b) { b.classList.add('dragging'); });
}

document.addEventListener('mousemove', function(e) {
  if (!_drag) return;

  var deltaY = e.clientY - _drag.startY;
  if (Math.abs(deltaY) > 3 || Math.abs(e.clientX - _drag.startX) > 3) _drag.didMove = true;
  if (!_drag.didMove) return;

  var SA       = ScheduleApp;
  var deltaMin = deltaY / SA.PX_PER_MIN;
  var origMin  = SA.timeToMinutes(_drag.section.startTime);
  var proposed = origMin + deltaMin;

  var hoveredDay = _dayAtX(e.clientX);
  var tgtDays    = _targetDays(_drag.section.days, hoveredDay);
  var crossDay   = _isCrossDay(_drag.section.days, tgtDays);
  var snapped    = _snapBlock(proposed, tgtDays);

  _drag.pendingSnap = snapped;
  _drag.pendingDays = tgtDays;

  if (crossDay) {
    // Dim original blocks and show ghost in target columns
    _drag.blocks.forEach(function(b) { b.style.opacity = '0.2'; });
    _showSnapIndicator(snapped, tgtDays);
  } else {
    // Restore blocks and move them vertically
    _drag.blocks.forEach(function(b) { b.style.opacity = ''; });
    _clearSnapIndicator();
    var snapMin = snapped ? SA.timeToMinutes(snapped.start) : proposed;
    var deltaPx = (snapMin - origMin) * SA.PX_PER_MIN;
    _drag.blocks.forEach(function(b, i) {
      b.style.top = (_drag.origTops[i] + deltaPx) + 'px';
    });
  }
});

document.addEventListener('mouseup', function(e) {
  if (!_drag) return;
  var state = _drag;
  _drag = null;

  state.blocks.forEach(function(b) {
    b.classList.remove('dragging');
    b.style.opacity = '';
  });
  _clearSnapIndicator();

  if (state.didMove && state.pendingSnap) {
    state.section.startTime = state.pendingSnap.start;
    state.section.endTime   = state.pendingSnap.end;
    if (state.pendingDays) state.section.days = state.pendingDays;
    state.section._modified = true;
    ScheduleApp.markDirty();
    ScheduleApp.triggerRenderAll();
  } else if (state.didMove) {
    // No valid snap — revert visual
    state.blocks.forEach(function(b, i) {
      b.style.top = state.origTops[i] + 'px';
    });
  }
  // If didMove is false → click handler fires naturally
});

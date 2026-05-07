window.ScheduleApp = window.ScheduleApp || {};

/**
 * Given an array of sections for one day, assign each a left and width
 * (0–1 fractions of the column) so overlapping sections appear side-by-side.
 * Returns array of { section, left, width }.
 */
ScheduleApp.layoutDayBlocks = function(sections) {
  if (!sections.length) return [];

  var toMin = ScheduleApp.timeToMinutes;

  var sorted = sections.slice().sort(function(a, b) {
    return toMin(a.startTime) - toMin(b.startTime);
  });

  // Greedy lane assignment — each lane tracks its current end time
  var laneEnds = [];
  var lanes = [];

  for (var i = 0; i < sorted.length; i++) {
    var start = toMin(sorted[i].startTime);
    var end   = toMin(sorted[i].endTime);
    var lane  = -1;
    for (var l = 0; l < laneEnds.length; l++) {
      if (laneEnds[l] <= start) { lane = l; laneEnds[l] = end; break; }
    }
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); }
    lanes.push(lane);
  }

  // For each section compute max concurrent overlap (determines its sub-column width)
  var concurrency = [];
  for (var i = 0; i < sorted.length; i++) {
    var sStart = toMin(sorted[i].startTime);
    var sEnd   = toMin(sorted[i].endTime);
    var maxLane = lanes[i];
    for (var j = 0; j < sorted.length; j++) {
      if (i === j) continue;
      var oStart = toMin(sorted[j].startTime);
      var oEnd   = toMin(sorted[j].endTime);
      if (oStart < sEnd && oEnd > sStart) {
        if (lanes[j] > maxLane) maxLane = lanes[j];
      }
    }
    concurrency.push(maxLane + 1);
  }

  return sorted.map(function(section, i) {
    return {
      section: section,
      left:    lanes[i] / concurrency[i],
      width:   1 / concurrency[i],
    };
  });
};

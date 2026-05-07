window.ScheduleApp = window.ScheduleApp || {};

var _PALETTE = [
  '#ffd6cc','#fde8b4','#fff3b0','#d4f0c4','#c2e4ff',
  '#e2ccff','#ffc9e3','#b8f0e8','#ffcfaa','#d5c4ff',
  '#b8d8ff','#ffbce8','#c5ffd6','#fffab5','#f2beff',
  '#b8f2ff','#ffd4c0','#c0ffd5','#ffcfc0','#c5c8ff',
];

var _colorCache = {};

function _hash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

ScheduleApp.getCourseColor = function(courseNumber) {
  if (!_colorCache[courseNumber]) {
    _colorCache[courseNumber] = _PALETTE[_hash(courseNumber) % _PALETTE.length];
  }
  return _colorCache[courseNumber];
};

ScheduleApp.setCourseColor = function(courseNumber, color) {
  _colorCache[courseNumber] = color;
};

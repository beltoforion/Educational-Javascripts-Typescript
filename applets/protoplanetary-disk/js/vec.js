// Rechnen mit dreidimensionalen Vektoren als Felder [x, y, z]
(function (Disk) {
'use strict';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

// Drehung von v um eine Achse (Rodrigues)
function rot(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), x = cross(axis, v), d = dot(axis, v) * (1 - c);
  return [v[0] * c + x[0] * s + axis[0] * d, v[1] * c + x[1] * s + axis[1] * d, v[2] * c + x[2] * s + axis[2] * d];
}

Disk.vec = { dot, cross, norm, rot };
})(globalThis.Disk = globalThis.Disk || {});

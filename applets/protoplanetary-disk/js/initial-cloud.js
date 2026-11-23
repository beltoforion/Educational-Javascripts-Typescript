// Startwolke: Kugel mit Dichte ~ 1/r. Es gibt keine vorgegebene Drehachse. Die Bewegung besteht aus
// wenigen zufälligen, wolkengroßen Wirbeln (Wellen mit zufälliger Richtung, Phase und Stärke) plus
// feiner Unordnung je Teilchen. Welcher Drehimpuls dabei übrig bleibt, ist Zufall.
(function (Disk) {
'use strict';

// Kleiner Zufallsgenerator mit Startwert, damit sich eine Wolke wiederholen lässt
function mulberry(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// options: size (Kantenlänge der Textur), eddy, turb, cloudMass, seed (ohne Startwert zufällig).
// Liefert { size, pos, vel, spin }. pos und vel haben vier Werte je Teilchen: xyz und den Körperradius 1
// bzw. xyz und die Nachbardichte 0. spin ist der Anteil des Drehimpulses, den dieselbe Wolke auf Kreisbahnen hätte.
Disk.createCloud = function (options) {
  const { R0, MC0 } = Disk.constants;
  const size = options.size, N = size * size;
  const rnd = mulberry(Number.isFinite(options.seed) ? options.seed : (Math.random() * 2 ** 31) | 0);
  const ball = () => { let x, y, z; do { x = 2 * rnd() - 1; y = 2 * rnd() - 1; z = 2 * rnd() - 1; } while (x * x + y * y + z * z > 1); return [x, y, z]; };
  const sphere = () => { const ct = 2 * rnd() - 1, st = Math.sqrt(1 - ct * ct), ph = 2 * Math.PI * rnd(); return [st * Math.cos(ph), ct, st * Math.sin(ph)]; };

  const modes = [];
  for (let m = 0; m < 6; m++) {
    const k = 2 * Math.PI / (R0 * (2 + 2 * rnd()));          // Wellenlänge: 2 bis 4 Wolkenradien
    const dir = sphere();
    let amp = ball();                                         // Strömung quer zur Welle, also wirbelnd statt stauchend
    const along = amp[0] * dir[0] + amp[1] * dir[1] + amp[2] * dir[2];
    amp = amp.map((v, i) => v - along * dir[i]);
    const norm = (Math.hypot(amp[0], amp[1], amp[2]) || 1) * k;   // große Wirbel sind stärker
    modes.push({ k: dir.map(v => v * k), a: amp.map(v => v / norm), ph: 2 * Math.PI * rnd() });
  }

  const pos = new Float32Array(N * 4), vel = new Float32Array(N * 4), flow = new Float32Array(N * 3);
  let flow2 = 0, mx = 0, my = 0, mz = 0;
  for (let i = 0; i < N; i++) {
    const r = R0 * Math.sqrt(0.02 + 0.98 * rnd()), d = sphere();
    const x = r * d[0], y = r * d[1], z = r * d[2];
    pos.set([x, y, z, 1], i * 4);
    let ux = 0, uy = 0, uz = 0;
    for (const m of modes) { const c = Math.cos(m.k[0] * x + m.k[1] * y + m.k[2] * z + m.ph); ux += m.a[0] * c; uy += m.a[1] * c; uz += m.a[2] * c; }
    flow.set([ux, uy, uz], i * 3);
    mx += ux / N; my += uy / N; mz += uz / N;
  }
  // Der Stern ruht im Schwerpunkt der Wolke: gemeinsame Drift abziehen, übrig bleiben nur die Wirbel
  for (let i = 0; i < N; i++) {
    const ux = flow[i * 3] -= mx, uy = flow[i * 3 + 1] -= my, uz = flow[i * 3 + 2] -= mz;
    flow2 += ux * ux + uy * uy + uz * uz;
  }
  const flowRms = Math.sqrt(flow2 / N) || 1;
  let Lx = 0, Ly = 0, Lz = 0, Lmax = 0;
  for (let i = 0; i < N; i++) {
    const x = pos[i * 4], y = pos[i * 4 + 1], z = pos[i * 4 + 2], r = Math.hypot(x, y, z);
    const vc = Math.sqrt((MC0 + options.cloudMass * (r / R0) ** 2) / r);   // Kreisbahngeschwindigkeit bei r
    const t = ball(), e = options.eddy * vc / flowRms, f = options.turb * vc;
    let vx = e * flow[i * 3] + f * t[0], vy = e * flow[i * 3 + 1] + f * t[1], vz = e * flow[i * 3 + 2] + f * t[2];
    const speed = Math.hypot(vx, vy, vz), cap = 1.1 * vc;    // unter der Fluchtgeschwindigkeit bleiben
    if (speed > cap) { vx *= cap / speed; vy *= cap / speed; vz *= cap / speed; }
    vel.set([vx, vy, vz, 0], i * 4);
    Lx += y * vz - z * vy; Ly += z * vx - x * vz; Lz += x * vy - y * vx; Lmax += r * vc;
  }
  return { size, pos, vel, spin: Math.hypot(Lx, Ly, Lz) / Lmax };
};
})(globalThis.Disk = globalThis.Disk || {});

// Auswertung einer Momentaufnahme auf der CPU: Drehimpulsachse, Bahnneigung, Exzentrizität, Scheibendicke
// und die Liste der schwersten Körper. Kennt weder WebGL noch die Seite.
(function (Disk) {
'use strict';

const ENC_BINS = 128, ENC_RMAX = 6;   // Raster für die eingeschlossene Masse je Radius
const TOP = 5;                        // so viele schwerste Körper werden geführt
const GROWN_MAX = 400;                // so viele gewachsene Körper werden höchstens mit Rang geführt

class Diagnostics {
  constructor() {
    this.axis = [0, 1, 0];                              // Richtung des Gesamtdrehimpulses. Bleibt dasselbe Feld, andere halten es fest
    this.plane = { e1: [1, 0, 0], e2: [0, 0, -1] };     // zwei Achsen in der Scheibenebene
    this.encl = null;                                   // eingeschlossene Masse je Radius, aus der letzten Messung
    this.L0 = 0;                                        // Gesamtdrehimpuls beim Start
    this.top = [];                                      // die schwersten Körper, von innen nach außen
    this.grown = [];                                    // alle gewachsenen Körper mit Rang nach Masse, schwerster zuerst
    this.stats = null;
    this.time = 0;                                      // Simulationszeit der letzten Messung
    this.particleMass = 0;
    this.starMass = Disk.constants.MC0;
    this.scratchA = new Float32Array(0); this.scratchB = new Float32Array(0);
  }

  // Vor einer neuen Startwolke. Achse und Ebene bleiben stehen, bis die erste Messung sie neu setzt.
  reset() { this.L0 = 0; this.stats = null; this.top = []; this.grown = []; this.time = 0; }

  // snap: Momentaufnahme aus Simulation.readback(). Liefert die Kennzahlen.
  measure(snap) {
    const { dot } = Disk.vec, C = Disk.constants;
    const posBuf = snap.pos, velBuf = snap.vel, N = snap.slots, Lhat = this.axis;
    const m = snap.particleMass, gMc = snap.starMass;
    if (this.scratchA.length < N) { this.scratchA = new Float32Array(N); this.scratchB = new Float32Array(N); }
    const scratchA = this.scratchA, scratchB = this.scratchB;

    // Gesamtdrehimpuls, nach Masse gewichtet. Verschluckte Teilchen (negativer Radius) behalten Ort und
    // Geschwindigkeit vom Moment des Einfangs, zählen hier also als Eigendrehimpuls des Sterns weiter mit.
    let Lx = snap.sinkL[0], Ly = snap.sinkL[1], Lz = snap.sinkL[2], bodies = 0, biggest = 0, mass = 0;
    for (let i = 0; i < N; i++) {
      const k = i * 4, rad = posBuf[k + 3]; if (rad === 0) continue;
      const x = posBuf[k], y = posBuf[k + 1], z = posBuf[k + 2], vx = velBuf[k], vy = velBuf[k + 1], vz = velBuf[k + 2], mw = Math.abs(rad) ** 3;
      Lx += mw * (y * vz - z * vy); Ly += mw * (z * vx - x * vz); Lz += mw * (x * vy - y * vx);
      if (rad > 0) { bodies++; mass += mw; if (mw > biggest) biggest = mw; }
    }
    const Lmag = Math.hypot(Lx, Ly, Lz);
    if (Lmag > 1e-9 * snap.count0) { Lhat[0] = Lx / Lmag; Lhat[1] = Ly / Lmag; Lhat[2] = Lz / Lmag; }
    if (!this.L0) this.L0 = Lmag;

    // Eingeschlossene Masse je Radius, damit die Exzentrizität auch mit Eigengravitation stimmt
    const NB = ENC_BINS, RMAX = ENC_RMAX, bins = new Float64Array(NB + 1);
    for (let i = 0; i < N; i++) {
      const k = i * 4, rad = posBuf[k + 3]; if (rad <= 0) continue;
      const r = Math.hypot(posBuf[k], posBuf[k + 1], posBuf[k + 2]);
      bins[Math.min(NB, (r / RMAX * NB) | 0)] += rad ** 3;
    }
    let acc = 0;
    for (let b = 0; b <= NB; b++) { const c = bins[b]; bins[b] = acc + 0.5 * c; acc += c; }
    this.encl = bins;

    // Neigung und Exzentrizität als Mittel über die Masse, Dicke und Radius als Median über die Körper
    let incSum = 0, eccSum = 0, n = 0, planets = 0;
    const top = [], grown = [];
    for (let i = 0; i < N; i++) {
      const k = i * 4, rad = posBuf[k + 3]; if (rad <= 0) continue;
      const w = rad ** 3;
      const x = posBuf[k], y = posBuf[k + 1], z = posBuf[k + 2], vx = velBuf[k], vy = velBuf[k + 1], vz = velBuf[k + 2];
      const lx = y * vz - z * vy, ly = z * vx - x * vz, lz = x * vy - y * vx;
      const ln = Math.hypot(lx, ly, lz) || 1e-12, r = Math.hypot(x, y, z) || 1e-12;
      incSum += w * Math.acos(Math.max(-1, Math.min(1, (lx * Lhat[0] + ly * Lhat[1] + lz * Lhat[2]) / ln)));
      const mu = gMc + m * bins[Math.min(NB, (r / RMAX * NB) | 0)];
      const ex = (vy * lz - vz * ly) / mu - x / r, ey = (vz * lx - vx * lz) / mu - y / r, ez = (vx * ly - vy * lx) / mu - z / r;
      eccSum += w * Math.min(1, Math.hypot(ex, ey, ez));
      const h = x * Lhat[0] + y * Lhat[1] + z * Lhat[2];
      scratchA[n] = Math.abs(h); scratchB[n] = Math.sqrt(Math.max(0, r * r - h * h));
      if (w * m >= C.PLANET_MASS) planets++;
      if (rad >= C.BODY_MIN_W) grown.push({ slot: i, w, p: [x, y, z], v: [vx, vy, vz], earth: w * m / C.EARTH });
      if (w > 1.5 && (top.length < TOP || w > top[top.length - 1].w)) {   // nur Körper, die schon gewachsen sind
        let at = top.length; while (at > 0 && top[at - 1].w < w) at--;
        top.splice(at, 0, { slot: i, w, p: [x, y, z], v: [vx, vy, vz], mu, r, ecc: Math.hypot(ex, ey, ez) });
        if (top.length > TOP) top.pop();
      }
      n++;
    }
    for (const b of top) {
      const v2 = dot(b.v, b.v), energy = v2 / 2 - b.mu / b.r;
      b.bound = energy < 0;
      b.a = b.bound ? -b.mu / (2 * energy) : Infinity;            // große Halbachse
      b.speed = b.bound ? Math.sqrt(b.mu / b.a) : Math.sqrt(v2);  // mittlere Umlaufgeschwindigkeit der Bahn
      b.earth = b.w * m / C.EARTH;
    }
    top.sort((p, q) => q.speed - p.speed);   // von innen (schnell) nach außen (langsam)
    top.forEach((b, k) => { b.index = k + 1; });
    this.top = top;
    grown.sort((p, q) => q.w - p.w);
    grown.length = Math.min(grown.length, GROWN_MAX);
    grown.forEach((b, k) => { b.rank = k + 1; });
    this.grown = grown;

    const zs = scratchA.subarray(0, n).sort(), ss = scratchB.subarray(0, n).sort();
    const rMed = n ? ss[n >> 1] : 1, r90 = n ? ss[Math.min(n - 1, (n * 0.9) | 0)] : 1;
    this.stats = {
      inc: mass ? incSum / mass * 180 / Math.PI : 0,
      ecc: mass ? eccSum / mass : 0,
      hr: n ? zs[n >> 1] / Math.max(rMed, 1e-6) : 0,
      L: this.L0 ? Lmag / this.L0 : 1,
      accreted: snap.swallowed / snap.count0,
      slots: snap.size,
      r90, bodies, planets,
      biggest: biggest * m / C.EARTH,   // schwerster Körper in Erdmassen, wenn der Stern eine Sonnenmasse hat
    };
    this.updatePlane();
    this.time = snap.time;
    this.particleMass = m;
    this.starMass = gMc;
    return this.stats;
  }

  // Zwei Achsen in der Scheibenebene, senkrecht zur Drehimpulsachse
  updatePlane() {
    const [a, b, c] = this.axis;
    const ref = Math.abs(b) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let e1 = [b * ref[2] - c * ref[1], c * ref[0] - a * ref[2], a * ref[1] - b * ref[0]];
    const n1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = e1.map(v => v / n1);
    const e2 = [b * e1[2] - c * e1[1], c * e1[0] - a * e1[2], a * e1[1] - b * e1[0]];
    this.plane = { e1, e2 };
  }

  // Nach dem Umpacken stehen die gemerkten Körper auf anderen Plätzen
  remap(moved) {
    for (const b of this.top) b.slot = moved[b.slot];
    for (const b of this.grown) b.slot = moved[b.slot];
  }

  // Erwartete Winkelgeschwindigkeit einer Kreisbahn bei Radius r: Stern plus die Masse innerhalb der Bahn
  orbitRate(r) {
    const inside = this.encl ? this.particleMass * this.encl[Math.min(ENC_BINS, (r / ENC_RMAX * ENC_BINS) | 0)] : 0;
    return Math.sqrt((this.starMass + inside) / (r * r * r));
  }
}

Disk.Diagnostics = Diagnostics;
})(globalThis.Disk = globalThis.Disk || {});

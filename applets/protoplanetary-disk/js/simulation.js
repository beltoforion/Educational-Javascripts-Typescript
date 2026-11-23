// Die Simulation auf der Grafikkarte: Zustand in Texturen, Zeitschritt, Verschmelzen, Umpacken.
// Sie kennt weder die Seite noch die Kamera. Wer Messwerte braucht, holt sich mit readback() eine Momentaufnahme.
//
// Jedes Teilchen belegt einen Platz in quadratischen Texturen:
//   Ort             xyz, w = Körperradius in Teilchenradien, Masse = w³
//                   (negativ: vom Stern verschluckt, 0: in einem anderen Körper aufgegangen)
//   Geschwindigkeit xyz, w = Nachbardichte
//   Beschleunigung  xyz
(function (Disk) {
'use strict';

class Simulation {
  // gl: WebGL2-Kontext mit EXT_color_buffer_float. params: die einstellbaren Parameter (wird nur gelesen).
  constructor(gl, params) {
    const { createProgram } = Disk.glUtils, S = Disk.shaders;
    this.gl = gl;
    this.params = params;
    this.driftProgram = createProgram(gl, S.triangle, S.drift);
    this.kickProgram = createProgram(gl, S.triangle, S.kick);
    this.mergeProgram = createProgram(gl, S.triangle, S.merge);
    this.vao = gl.createVertexArray();
    this.size = 0;                 // Kantenlänge der Texturen
    this.slots = 0;                // Plätze = size². Schrumpft, wenn Körper verschmelzen oder verschluckt werden
    this.count0 = 0;               // Teilchenzahl beim Start. Legt die Masse eines Teilchens fest
    this.collisionRadius = 0.05;
    this.time = 0;
    this.starMass = Disk.constants.MC0;
    this.sink = { mass: 0, L: [0, 0, 0] };   // was der Stern verschluckt hat und beim Umpacken aus der Textur genommen wurde
    this.state = null;
    this.targets = null;
    this.pos = null; this.vel = null;        // Puffer der letzten Momentaufnahme
    this.lastWait = 0;                       // so lange hat die Grafikkarte beim letzten Zurücklesen noch an offenen Schritten gerechnet (ms)
  }

  get particleMass() { return this.params.md / this.count0; }
  // Körperradius eines einzelnen Teilchens im Raum: gleiche Körperdichte bei jeder Teilchenzahl und Wolkenmasse
  get unitRadius() { return this.params.rm * Math.cbrt((this.params.md / 0.08) * (4096 / this.count0)); }
  get positionTexture() { return this.state.P[this.state.p]; }
  get velocityTexture() { return this.state.V[this.state.v]; }

  // Beginnt mit einer neuen Startwolke aus Disk.createCloud
  reset(cloud) {
    this.size = cloud.size; this.slots = cloud.size * cloud.size;
    this.count0 = this.slots;
    this.collisionRadius = this.params.h0 * Math.sqrt(4096 / this.count0);   // hält die Stoßrate unabhängig von der Teilchenzahl
    this.time = 0;
    this.starMass = Disk.constants.MC0;
    this.sink.mass = 0; this.sink.L = [0, 0, 0];
    this.load(cloud.pos, cloud.vel);
  }

  // Lädt einen Zustand in frische Texturen und berechnet daraus die Beschleunigungen a(n).
  // Sie hängen nur von den Orten ab, gehen beim Neuladen also nicht verloren.
  load(pos, vel) {
    const gl = this.gl, { floatTexture, TargetCache } = Disk.glUtils, size = this.size;
    this.free();
    // Ort, Geschwindigkeit und Beschleunigung liegen je in zwei Texturen: Eine gilt, in die andere wird geschrieben.
    // p, v und a sagen, welche gerade gilt. aux merkt sich die Verschmelzungswünsche.
    this.state = {
      P: [floatTexture(gl, size, pos), floatTexture(gl, size, null)], V: [floatTexture(gl, size, vel), floatTexture(gl, size, null)],
      A: [floatTexture(gl, size, null), floatTexture(gl, size, null)], aux: floatTexture(gl, size, null),
      p: 0, v: 1, a: 0,
    };
    this.targets = new TargetCache(gl);
    this.pos = new Float32Array(this.slots * 4); this.vel = new Float32Array(this.slots * 4);
    this.prepare();
    this.kick(0, 0);
  }

  free() {
    const s = this.state;
    if (!s) return;
    for (const t of [...s.P, ...s.V, ...s.A, s.aux]) this.gl.deleteTexture(t);
    this.targets.dispose();
    this.state = null;
  }

  prepare() {
    const gl = this.gl;
    gl.viewport(0, 0, this.size, this.size);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
  }

  // Zeitintegration: Leapfrog in Kick-Drift-Kick-Form, siehe shaders.js.
  // Durchgang 1: halber Kick und Drift
  drift() {
    const gl = this.gl, s = this.state, u = this.driftProgram.u, { bindTexture } = Disk.glUtils, C = Disk.constants;
    this.targets.bind(s.P[1 - s.p], s.V[1 - s.v]);               // schreibt x(n+1) und v(n+1/2)
    gl.useProgram(this.driftProgram.p);
    bindTexture(gl, 0, s.P[s.p]); bindTexture(gl, 1, s.V[s.v]); bindTexture(gl, 2, s.A[s.a]);
    gl.uniform1i(u.uPos, 0); gl.uniform1i(u.uVel, 1); gl.uniform1i(u.uAcc, 2);
    gl.uniform1f(u.uDt, C.DT); gl.uniform1f(u.uRacc2, C.R_ACC * C.R_ACC);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    s.p = 1 - s.p;
  }

  // Durchgang 2: Kräfte an den neuen Orten, zweiter halber Kick. half = dt/2 und cdt = Stoßstärke · dt,
  // beide 0, wenn nur a(0) gebraucht wird.
  kick(half, cdt) {
    const gl = this.gl, s = this.state, u = this.kickProgram.u, P = this.params, { bindTexture } = Disk.glUtils, C = Disk.constants;
    const rm = P.merge ? this.unitRadius : 0;   // 0 schaltet das Verschmelzen ab
    // Können Körper verschmelzen, wird die Gravitation erst auf Berührabstand geglättet. Sonst gilt die feste Länge EPS.
    const soft = rm > 0 ? rm : C.EPS / 2;
    const H = this.collisionRadius;
    this.targets.bind(s.V[s.v], s.A[s.a], s.aux);                 // schreibt v(n+1), a(n+1) und die Verschmelzungswünsche
    gl.useProgram(this.kickProgram.p);
    bindTexture(gl, 0, s.P[s.p]); bindTexture(gl, 1, s.V[1 - s.v]);    // liest x(n+1) und v(n+1/2)
    gl.uniform1i(u.uPos, 0); gl.uniform1i(u.uVel, 1); gl.uniform1i(u.uTS, this.size);
    gl.uniform1f(u.uHalf, half); gl.uniform1f(u.uCdt, cdt); gl.uniform1f(u.uC2, 2 * P.diss * C.DT);
    gl.uniform1f(u.uGMc, this.starMass); gl.uniform1f(u.uGm, P.md / this.count0);
    gl.uniform1f(u.uSoft, soft); gl.uniform1f(u.uInvH2, 1 / (H * H));
    gl.uniform1f(u.uRm, rm); gl.uniform1f(u.uStick, 2 * P.stick);
    gl.uniform1f(u.uHill, 3 * this.starMass / (Math.max(P.md / this.count0, 1e-12) * P.hill ** 3));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Durchgang 3: Paare, die sich gegenseitig gewählt haben, werden eins
  merge() {
    const gl = this.gl, s = this.state, u = this.mergeProgram.u, { bindTexture } = Disk.glUtils;
    this.targets.bind(s.P[1 - s.p], s.V[1 - s.v], s.A[1 - s.a]);
    gl.useProgram(this.mergeProgram.p);
    bindTexture(gl, 0, s.P[s.p]); bindTexture(gl, 1, s.V[s.v]); bindTexture(gl, 2, s.A[s.a]); bindTexture(gl, 3, s.aux);
    gl.uniform1i(u.uPos, 0); gl.uniform1i(u.uVel, 1); gl.uniform1i(u.uAcc, 2); gl.uniform1i(u.uAux, 3); gl.uniform1i(u.uTS, this.size);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    s.p = 1 - s.p; s.v = 1 - s.v; s.a = 1 - s.a;
  }

  // Ein Zeitschritt
  step() {
    const C = Disk.constants;
    this.prepare();
    this.drift();
    this.kick(0.5 * C.DT, this.params.diss * C.DT);
    if (this.params.merge) this.merge();
    this.time += C.DT;
  }

  // Viele Schritte am Stück, etwa von der Konsole aus. In Portionen abgearbeitet, sonst bricht der Grafiktreiber
  // bei vielen Teilchen wegen Zeitüberschreitung ab.
  run(steps) {
    const chunk = Math.max(1, Math.floor(2e9 / (this.slots * this.slots)));
    for (let i = 0; i < steps; i++) { this.step(); if ((i + 1) % chunk === 0) this.gl.finish(); }
    return this.time;
  }

  // Liest Orte und Geschwindigkeiten zurück und rechnet dem Stern die verschluckte Masse an.
  // Die Felder pos und vel der Momentaufnahme gelten bis zum nächsten Aufruf oder Umpacken.
  readback() {
    const gl = this.gl, s = this.state, n = this.slots;
    // Das erste Zurücklesen wartet, bis alle offenen Schritte gerechnet sind, das zweite kostet nur den Weg zur
    // Grafikkarte und zurück. Der Unterschied ist ihr Rückstand.
    const t0 = performance.now();
    this.targets.bind(s.P[s.p]); gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(0, 0, this.size, this.size, gl.RGBA, gl.FLOAT, this.pos);
    const t1 = performance.now();
    this.targets.bind(s.V[s.v]); gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(0, 0, this.size, this.size, gl.RGBA, gl.FLOAT, this.vel);
    this.lastWait = Math.max(0, (t1 - t0) - (performance.now() - t1));
    let swallowed = this.sink.mass;
    for (let i = 0; i < n; i++) { const rad = this.pos[i * 4 + 3]; if (rad < 0) swallowed += Math.abs(rad) ** 3; }
    this.starMass = Disk.constants.MC0 + swallowed * this.particleMass;
    return {
      pos: this.pos, vel: this.vel, slots: n, size: this.size, time: this.time,
      count0: this.count0, particleMass: this.particleMass, starMass: this.starMass,
      swallowed,                 // verschluckte Masse in Teilchenmassen
      sinkL: this.sink.L,        // Drehimpuls der verschluckten Teilchen, die nicht mehr in der Textur stehen
    };
  }

  // Packt die überlebenden Körper in eine kleinere Textur. Der Rechenaufwand je Schritt ist Plätze², leere Plätze
  // kosten also mit. Verschluckte Teilchen wandern mit Masse und Drehimpuls in die Buchführung des Sterns.
  // Braucht eine frische Momentaufnahme. Liefert die Tabelle alter Platz → neuer Platz, oder null, wenn es nicht lohnt.
  compact(bodies) {
    const size = Math.max(8, Math.ceil(Math.sqrt(bodies)));
    if (size > this.size * 0.85) return null;   // lohnt erst, wenn mindestens ein Viertel der Paare wegfällt
    const posBuf = this.pos, velBuf = this.vel, sink = this.sink;
    const pos = new Float32Array(size * size * 4), vel = new Float32Array(size * size * 4), moved = new Int32Array(this.slots).fill(-1);
    let n = 0;
    for (let i = 0; i < this.slots; i++) {
      const k = i * 4, rad = posBuf[k + 3];
      if (rad > 0) { pos.set(posBuf.subarray(k, k + 4), n * 4); vel.set(velBuf.subarray(k, k + 4), n * 4); moved[i] = n; n++; }
      else if (rad < 0) {
        const x = posBuf[k], y = posBuf[k + 1], z = posBuf[k + 2], vx = velBuf[k], vy = velBuf[k + 1], vz = velBuf[k + 2], mw = (-rad) ** 3;
        sink.mass += mw; sink.L[0] += mw * (y * vz - z * vy); sink.L[1] += mw * (z * vx - x * vz); sink.L[2] += mw * (x * vy - y * vx);
      }
    }
    this.size = size; this.slots = size * size;
    this.load(pos, vel);
    this.pos.set(pos); this.vel.set(vel);   // die Messpuffer zeigen sofort den umgepackten Zustand
    return moved;
  }
}

Disk.Simulation = Simulation;
})(globalThis.Disk = globalThis.Disk || {});

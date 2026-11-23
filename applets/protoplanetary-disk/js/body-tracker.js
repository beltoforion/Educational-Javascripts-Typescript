// Lässt die Kamera mit einem gewählten Körper um die Scheibenachse laufen. Zwischen zwei Messungen dreht sie mit
// seiner zuletzt gemessenen Winkelgeschwindigkeit weiter, bei jeder Messung wird sie auf seinen wahren Ort nachgestellt.
(function (Disk) {
'use strict';

class BodyTracker {
  // camera: die Kamera, die mitgedreht wird. axis: Richtung der Scheibenachse (das Feld der Auswertung, wird nur gelesen).
  constructor(camera, axis) {
    this.camera = camera;
    this.axis = axis;
    this.current = null;   // der verfolgte Körper: { slot, w, p, v, t, omega, turnedUntil }. t: Zeit der Messung von p und v,
                           // turnedUntil: Simulationszeit, bis zu der die Kamera schon mitgedreht ist
  }

  // Anteil eines Vektors in der Scheibenebene
  flat(a) { const L = this.axis, d = Disk.vec.dot(a, L); return [a[0] - d * L[0], a[1] - d * L[1], a[2] - d * L[2]]; }

  // Winkelgeschwindigkeit um die Scheibenachse
  spinRate(p, v) { const { dot, cross } = Disk.vec, q = this.flat(p); return dot(this.axis, cross(p, v)) / (dot(q, q) || 1e-9); }

  release() { this.current = null; }

  // Folgt dem Körper aus der Liste der schwersten, oder löst sich von ihm, wenn er schon verfolgt wird.
  // now: Simulationszeit jetzt. measuredAt: Zeit der Messung, aus der body stammt. Liefert true, wenn jetzt verfolgt wird.
  toggle(body, now, measuredAt) {
    if (this.current && this.current.slot === body.slot) { this.current = null; return false; }
    const omega = this.spinRate(body.p, body.v);
    // Was der Körper seit der letzten Messung schon gelaufen ist, soll die Kamera nicht nachholen
    this.current = { slot: body.slot, w: body.w, p: body.p, v: body.v, t: measuredAt, omega, turnedUntil: now };
    return true;
  }

  // Dreht die Kamera um den Winkel weiter, den der Körper bis zur Simulationszeit now zurücklegt
  advanceTo(now) {
    const f = this.current;
    if (!f) return;
    this.camera.turn(this.axis, f.omega * (now - f.turnedUntil));
    f.turnedUntil = now;
  }

  // Stellt die Kamera nach einer Messung auf den wahren Ort des Körpers nach. snap: Momentaufnahme der Simulation.
  sync(snap) {
    const follow = this.current;
    if (!follow) return;
    const { dot, cross, rot } = Disk.vec, Lhat = this.axis, posBuf = snap.pos, velBuf = snap.vel;
    const elapsed = snap.time - follow.t;
    const guess = rot(follow.p, Lhat, follow.omega * elapsed);   // wo der Körper jetzt etwa sein müsste
    let slot = follow.slot, k = slot * 4;
    if (!(slot >= 0 && posBuf[k + 3] > 0 && posBuf[k + 3] ** 3 >= follow.w * 0.999)) {
      // Er ist in einem schwereren Körper aufgegangen: Der steht jetzt an fast derselben Stelle.
      slot = -1;
      let best = 0.3 * 0.3;
      for (let i = 0; i < snap.slots; i++) {
        const j = i * 4, rad = posBuf[j + 3]; if (rad <= 0 || rad ** 3 <= follow.w) continue;
        const d2 = (posBuf[j] - guess[0]) ** 2 + (posBuf[j + 1] - guess[1]) ** 2 + (posBuf[j + 2] - guess[2]) ** 2;
        if (d2 < best) { best = d2; slot = i; }
      }
      if (slot < 0) { this.current = null; return; }   // vom Stern verschluckt
      k = slot * 4;
    }
    const p = [posBuf[k], posBuf[k + 1], posBuf[k + 2]], v = [velBuf[k], velBuf[k + 1], velBuf[k + 2]];
    const g = this.flat(guess), q = this.flat(p);
    const off = Math.atan2(dot(Lhat, cross(g, q)), dot(g, q));          // Abweichung von der Vorhersage
    this.camera.turn(Lhat, follow.omega * elapsed + off - follow.omega * (follow.turnedUntil - follow.t));
    this.current = { slot, w: posBuf[k + 3] ** 3, p, v, t: snap.time, omega: this.spinRate(p, v), turnedUntil: snap.time };
  }

  // Nach dem Umpacken steht der Körper auf einem anderen Platz
  remap(moved) { if (this.current) this.current.slot = moved[this.current.slot]; }

  // Geschätzter Ort des Körpers zur Simulationszeit now
  spot(now) { const f = this.current; return Disk.vec.rot(f.p, this.axis, f.omega * (now - f.t)); }
}

Disk.BodyTracker = BodyTracker;
})(globalThis.Disk = globalThis.Disk || {});

// Verfolgt Lichtstrahlen vom Hintergrundstern durch das Schwerefeld von Stern und Planet und findet die, die
// die Öffnung des Teleskops treffen.
//
// Gerechnet wird in Pixeln der Zeichnung, aber räumlich: x nach rechts, y nach unten zum Teleskop, z aus der
// Zeichenebene heraus. Jede Masse zieht den Strahl mit einer Kraft an, die mit dem Quadrat des Abstands
// abnimmt (Gravitationsgesetz). Licht ändert dabei nur seine Richtung, nicht sein Tempo. Die Stärke der
// Anziehung ist so gewählt, dass bei genauer Ausrichtung der Einsteinring der Zeichnung herauskommt; sie ist
// gegenüber der Wirklichkeit gewaltig übertrieben.
//
// Eine Richtung wird durch ihre Steigungen (sx, sz) angegeben: Der Strahl startet in Richtung (sx, 1, sz).
// Ein Netz mit gleichen Abständen in sx und sz trifft die Ebene des Teleskops ohne Linse gleichmäßig dicht.
// Die Lichtkurve des Applets stammt nicht aus dieser Rechnung, sondern aus der Helligkeit der verzerrten
// Bilder (image-brightness.js).
(function (ML) {
'use strict';

// Sicherheitszuschlag beim Aussortieren von Strahlen, die das Teleskop nicht erreichen können
const PRUNE_SAFETY = 1.6;
// Schrittweite der Strahlverfolgung: Anteil am Abstand zur nächsten Masse, mit Grenzen in Pixeln.
// Mit feineren Schritten ändert sich die gezählte Lichtmenge um weniger als ein Prozent.
const STEP_FACTOR = 0.3, STEP_MIN = 0.4, STEP_MAX = 16;

class RayTracer {
  // aperture: Radius der Teleskopöffnung in Pixeln
  constructor(layout, aperture) {
    this.layout = layout;
    const v = layout.view;
    this.d1 = v.lensY - v.sourceY;          // Hintergrundstern → Linsenebene
    this.d2 = v.telescopeY - v.lensY;       // Linsenebene → Teleskop
    this.aperture = aperture;
    // Erste Schätzung aus der Näherung für kleine Winkel: Ablenkung = 2·GM/Abstand
    this.gm = layout.lensScale * layout.lensScale * (this.d1 + this.d2) / (2 * this.d1 * this.d2);
    this.gm = this._calibrate();
  }

  // bodies: [{ x, mass, radius }] in der Linsenebene (x in Pixeln, mass in Sternmassen); in radius um einen
  // Körper endet ein Strahl. Verfolgt den Strahl mit den Steigungen (sx, sz) bis zur Höhe endY.
  // Ergebnis: { points, blocked, arrived, x, z, slope }
  //   points = sein Weg in der Zeichenebene (nur mit keep), arrived = er hat endY erreicht,
  //   x, z = Ort und slope = Richtung dx/dy dort
  trace(sx, sz, bodies, endY, keep) {
    const v = this.layout.view, panel = this.layout.panel, gm = this.gm;
    const norm = 1 / Math.sqrt(sx * sx + 1 + sz * sz);
    let x = this.layout.cx, y = v.sourceY, z = 0, vx = sx * norm, vy = norm, vz = sz * norm;
    const points = keep ? [[x, y]] : null;
    const left = panel.x - 40, right = panel.x + panel.width + 40;
    let blocked = false, arrived = false, sinceKept = 0;
    let nearest = this.d1;      // Abstand zur nächsten Masse, bestimmt die Schrittweite

    // Jeder Schritt: halbes Stück geradeaus, dort die Richtung ändern, zweites halbes Stück geradeaus.
    for (let guard = 0; guard < 4000; guard++) {
      // Nahe an einer Masse ändert sich die Kraft schnell: kleinere Schritte
      let h = STEP_FACTOR * nearest;
      if (h > STEP_MAX) h = STEP_MAX; else if (h < STEP_MIN) h = STEP_MIN;
      const last = y + vy * h >= endY;
      if (last) h = (endY - y) / vy;
      x += vx * h / 2;
      y += vy * h / 2;
      z += vz * h / 2;

      let ax = 0, ay = 0, az = 0;
      nearest = Infinity;
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const dx = body.x - x, dy = v.lensY - y;
        const r = Math.sqrt(dx * dx + dy * dy + z * z);
        if (r < body.radius) blocked = true;
        if (r < nearest) nearest = r;
        const f = gm * body.mass / (r * r * r);
        ax += f * dx;
        ay += f * dy;
        az -= f * z;
      }
      if (blocked) break;
      // nur die Richtung ändert sich, das Tempo bleibt 1
      vx += ax * h;
      vy += ay * h;
      vz += az * h;
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      vx /= speed;
      vy /= speed;
      vz /= speed;
      if (vy <= 0) break;

      // Auf dem letzten Schritt genau bis zur Zielhöhe
      const rest = last ? (endY - y) / vy : h / 2;
      x += vx * rest;
      y += vy * rest;
      z += vz * rest;
      if (keep) {
        sinceKept += h;
        if (sinceKept >= 3 || last) {
          points.push([x, y]);
          sinceKept = 0;
        }
      }
      if (last) { arrived = true; break; }
      if (x < left || x > right) break;
    }
    if (keep && sinceKept > 0) points.push([x, y]);
    return { points, blocked, arrived, x, z, slope: vx / vy };
  }

  // Der Fächer in der Zeichenebene: Strahlen in gleichen Abständen der Steigung
  fan(bodies, endY) {
    const v = this.layout.view, rays = [];
    const count = Math.floor(v.fanSpread / v.fanStep);
    for (let i = -count; i <= count; i++) rays.push(this.trace(i * v.fanStep, 0, bodies, endY, true));
    return rays;
  }

  // Abstand im Strahlennetz, bei dem ohne Linse etwa `unlensed` Strahlen die Öffnung treffen
  stepFor(unlensed) {
    return this.aperture * Math.sqrt(Math.PI / unlensed) / (this.d1 + this.d2);
  }

  // Die Strahlen eines Netzes, die die Öffnung treffen, mit ihrem Weg in der Zeichenebene.
  // Ergebnis: [{ points, inPlane }], inPlane = der Strahl bleibt in der Zeichenebene
  hits(bodies, step) {
    const v = this.layout.view, a = this.aperture, found = [];
    this._shoot(bodies, step, (ray, weight, sx, sz) => {
      if (Math.hypot(ray.x - this.layout.cx, ray.z) > a) return;
      found.push({ points: this.trace(sx, sz, bodies, v.telescopeY, true).points, inPlane: sz === 0 });
    });
    return found;
  }

  // Schießt ein Netz von Strahlen und meldet jeden, der die Höhe des Teleskops erreicht:
  // onRay(ray, weight, sx, sz). Alle Massen liegen in der Zeichenebene, das Feld ist also spiegelbildlich zu
  // ihr: Verfolgt wird nur die vordere Hälfte, ihre Strahlen zählen doppelt (weight 2).
  // Strahlen, die das Teleskop auch mit der größten denkbaren Ablenkung nicht erreichen können, werden
  // gar nicht erst verfolgt.
  _shoot(bodies, step, onRay) {
    const v = this.layout.view, cx = this.layout.cx;
    const d1 = this.d1, d2 = this.d2, total = d1 + d2;
    const reach = this.aperture + 2 * step * total;
    const widest = 2.6 * this.layout.lensScale;      // so weit von der Sichtlinie kreuzen Treffer die Linsenebene höchstens
    const limit = Math.ceil(widest / d1 / step);
    for (let j = 0; j <= limit; j++) {
      const sz = j * step;
      for (let i = -limit; i <= limit; i++) {
        const sx = i * step;
        if (i * i + j * j > limit * limit) continue;
        // Wie weit ginge der Strahl geradeaus am Teleskop vorbei, und wie weit kann ihn jede Masse höchstens
        // versetzen? Ablenkung im Vorbeiflug ≈ 2·GM/Abstand.
        const miss = Math.sqrt(sx * sx + sz * sz) * total;
        const tilt = Math.sqrt(1 + sx * sx + sz * sz);
        let shift = 0;
        for (let k = 0; k < bodies.length; k++) {
          const px = sx * d1 - (bodies[k].x - cx), pz = sz * d1;
          const b = Math.sqrt(px * px + pz * pz) / tilt;
          shift += 2 * this.gm * bodies[k].mass / (b + 1e-9) * d2;
        }
        if (miss > reach + PRUNE_SAFETY * shift) continue;
        const ray = this.trace(sx, sz, bodies, v.telescopeY, false);
        if (ray.arrived) onRay(ray, j === 0 ? 1 : 2, sx, sz);
      }
    }
  }

  // Alle Strahlen in der Zeichenebene, die genau die Mitte der Öffnung treffen. Der Fächer wird fein
  // abgetastet; wo zwei benachbarte Strahlen links und rechts am Teleskop vorbeigehen, liegt dazwischen ein
  // Treffer. Ergebnis: [{ points, apparentX }], apparentX = wo der Hintergrundstern auf diesem Weg zu stehen
  // scheint, wenn man die Ankunftsrichtung gerade bis auf seine Höhe verlängert.
  arriving(bodies) {
    const v = this.layout.view, cx = this.layout.cx;
    const miss = s => {
      const ray = this.trace(s, 0, bodies, v.telescopeY, false);
      return ray.arrived ? ray.x - cx : NaN;
    };
    const found = [], step = 0.004, spread = 0.9;
    let s0 = -spread, f0 = miss(s0);
    for (let s1 = s0 + step; s1 <= spread; s1 += step) {
      const f1 = miss(s1);
      if (f0 === 0 || f0 * f1 < 0) {
        let lo = s0, hi = s1, flo = f0;
        for (let i = 0; i < 40 && flo !== 0; i++) {
          const mid = 0.5 * (lo + hi), fm = miss(mid);
          if (Number.isNaN(fm)) break;
          if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
        }
        const ray = this.trace(0.5 * (lo + hi), 0, bodies, v.telescopeY, true);
        // Zwischen zwei Strahlen, die eine Masse auf verschiedenen Seiten umlaufen, springt der Auftreffort;
        // das ist kein Treffer.
        if (ray.arrived && Math.abs(ray.x - cx) < 0.5) {
          found.push({ points: ray.points, apparentX: cx - ray.slope * (v.telescopeY - v.sourceY) });
        }
      }
      s0 = s1;
      f0 = f1;
    }
    return found;
  }

  // Stelle, an der ein verfolgter Strahl die Linsenebene kreuzt
  crossing(points) {
    const y = this.layout.view.lensY;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      if (y1 >= y) return x0 + (x1 - x0) * (y - y0) / (y1 - y0);
    }
    return points[points.length - 1][0];
  }

  // Stärke der Anziehung so einstellen, dass bei genauer Ausrichtung das Bild im Abstand des Einsteinrings
  // erscheint, den die Zeichnung der verzerrten Bilder verwendet.
  _calibrate() {
    const L = this.layout, star = [{ x: L.cx, mass: 1, radius: 1 }];
    const first = this.gm;
    const error = factor => {
      this.gm = first * factor;
      const found = this.arriving(star);
      const outer = found.length ? Math.max(...found.map(h => Math.abs(h.apparentX - L.cx))) : 0;
      return outer - L.skyScale;
    };
    let lo = 0.5, hi = 2;
    for (let i = 0; i < 30; i++) {
      const mid = 0.5 * (lo + hi);
      if (error(mid) < 0) lo = mid; else hi = mid;
    }
    return first * 0.5 * (lo + hi);
  }
}

ML.RayTracer = RayTracer;
})(globalThis.Microlensing = globalThis.Microlensing || {});

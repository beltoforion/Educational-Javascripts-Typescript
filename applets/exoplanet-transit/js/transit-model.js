// Bahn des Planeten und Helligkeit, die das Teleskop von Stern und Planet zusammen misst.
//
// Der Fortschritt p läuft je Umlauf von 0 bis 1:
//   p = 0     Planet steht links neben dem Stern
//   p = 0,25  genau vor dem Stern (Mitte des Transits)
//   p = 0,5   rechts neben dem Stern
//   p = 0,75  genau hinter dem Stern (Mitte der sekundären Bedeckung)
// Orte sind relativ zur Sternmitte angegeben. Die Helligkeit ist auf den Stern allein bezogen (= 1).
(function (TR) {
'use strict';

class TransitModel {
  constructor(model) {
    this.model = model;
  }

  // Bahnwinkel: 0 = vor dem Stern, π = dahinter
  angle(p) {
    return 2 * Math.PI * p - Math.PI / 2;
  }

  // Ort des Planeten: { x, y, front }; front = er steht zwischen Stern und Beobachter
  planet(p) {
    const m = this.model, a = this.angle(p);
    return { x: m.orbitRadius * Math.sin(a), y: m.orbitRadius * m.orbitTilt * Math.cos(a), front: Math.cos(a) > 0 };
  }

  // Fortschritt, bei dem der Planet waagerecht im Abstand x von der Sternmitte steht, auf der hinteren
  // (behind) oder der vorderen Hälfte seiner Bahn
  progressAt(x, behind) {
    const side = Math.asin(Math.max(-1, Math.min(1, x / this.model.orbitRadius))) / (2 * Math.PI);
    return behind ? 0.75 - side : (0.25 + side + 1) % 1;
  }

  // Phasenwinkel: 0 = wir sehen die voll beleuchtete Seite (Planet hinter dem Stern), π = die Nachtseite
  phaseAngle(p) {
    return Math.acos(Math.max(-1, Math.min(1, -Math.cos(this.angle(p)))));
  }

  // Anteil der Sternscheibe, den der Planet beim Transit abdunkelt. Zum Rand hin ist die Scheibe dunkler,
  // dort fehlt also weniger Licht.
  transitLoss(p) {
    const m = this.model, planet = this.planet(p);
    if (!planet.front) return 0;
    const distance = Math.hypot(planet.x, planet.y);
    const covered = TransitModel.overlap(m.starRadius, m.planetRadius, distance);
    if (covered === 0) return 0;
    // Flächenhelligkeit an der verdeckten Stelle im Verhältnis zum Mittel über die Scheibe
    const r = Math.min(1, distance / m.starRadius), u = m.limbDarkening;
    const local = (1 - u * (1 - Math.sqrt(1 - r * r))) / (1 - u / 3);
    return covered / (Math.PI * m.starRadius * m.starRadius) * local;
  }

  // Phasenkurve: Licht des Sterns, das der Planet zu uns zurückwirft. Es folgt seiner Phase wie beim Mond
  // (Lambert-Kugel) und fällt ganz weg, solange der Stern ihn verdeckt: die sekundäre Bedeckung.
  reflection(p) {
    const m = this.model, alpha = this.phaseAngle(p);
    const phase = (Math.sin(alpha) + (Math.PI - alpha) * Math.cos(alpha)) / Math.PI;
    return m.reflection * phase * this.planetVisible(p);
  }

  // Anteil der Planetenscheibe, den der Stern nicht verdeckt
  planetVisible(p) {
    const m = this.model, planet = this.planet(p);
    if (planet.front) return 1;
    const hidden = TransitModel.overlap(m.starRadius, m.planetRadius, Math.hypot(planet.x, planet.y));
    return 1 - hidden / (Math.PI * m.planetRadius * m.planetRadius);
  }

  // Ellipsoidale Variation: Der Planet zieht den Stern durch seine Gezeiten leicht in die Länge. Steht er
  // seitlich, sehen wir die lange Seite des Sterns und damit mehr leuchtende Fläche; zweimal je Umlauf.
  ellipsoidal(p) {
    return -this.model.ellipsoidal * Math.cos(2 * this.angle(p));
  }

  // Doppler-Beaming: Der Stern umkreist mit dem Planeten den gemeinsamen Schwerpunkt. Bewegt er sich auf uns
  // zu, erscheint er etwas heller, sonst etwas dunkler. Er kommt auf uns zu, während sich der Planet entfernt,
  // also nach dem Transit.
  beaming(p) {
    return this.model.beaming * Math.sin(this.angle(p));
  }

  // Gesamte Helligkeit von Stern und Planet
  brightness(p) {
    return (1 - this.transitLoss(p)) * (1 + this.ellipsoidal(p) + this.beaming(p)) + this.reflection(p);
  }

  // Kleinster und größter Wert, den die Kurve außerhalb des Transits annimmt, samt Rauschen und den einzeln
  // aufgetragenen Anteilen: { min, max }. Danach richtet sich die Skala der Vergrößerung.
  fineRange() {
    const m = this.model;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i <= m.samples; i++) {
      const p = i / m.samples;
      if (this.transitLoss(p) > 0) continue;
      const values = [this.brightness(p) - m.noise, this.brightness(p) + m.noise,
        1 + this.reflection(p), 1 + this.ellipsoidal(p), 1 + this.beaming(p)];
      min = Math.min(min, ...values);
      max = Math.max(max, ...values);
    }
    return { min, max };
  }

  // Die Messung: Helligkeit mit Rauschen. Der Messpunkt index hat immer dasselbe Rauschen.
  measured(index) {
    const m = this.model;
    return this.brightness(index / m.samples) + m.noise * TransitModel.noise(index);
  }
}

// Fläche, die sich zwei Kreise mit den Radien R und r im Mittenabstand d teilen
TransitModel.overlap = function (R, r, d) {
  if (d >= R + r) return 0;
  if (d <= Math.abs(R - r)) return Math.PI * Math.min(R, r) * Math.min(R, r);
  const a = Math.acos((d * d + r * r - R * R) / (2 * d * r));
  const b = Math.acos((d * d + R * R - r * r) / (2 * d * R));
  return r * r * (a - Math.sin(2 * a) / 2) + R * R * (b - Math.sin(2 * b) / 2);
};

// Zufallszahl zwischen −1 und 1, fest an die Nummer i gebunden
TransitModel.noise = function (i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return 2 * (s - Math.floor(s)) - 1;
};

TR.TransitModel = TransitModel;
})(globalThis.Transit = globalThis.Transit || {});

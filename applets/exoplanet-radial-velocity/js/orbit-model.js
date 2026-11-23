// Stern und Planet auf ihren Kreisbahnen um den gemeinsamen Schwerpunkt.
//
// Der Fortschritt p läuft je Umlauf von 0 bis 1. Orte sind relativ zum Schwerpunkt angegeben, y nach unten;
// der Beobachter (die Sternwarte) sitzt unten. Die Radialgeschwindigkeit ist der Anteil der Sternbewegung
// entlang der Blickrichtung: positiv, wenn sich der Stern entfernt.
(function (RV) {
'use strict';

class OrbitModel {
  constructor(model) {
    this.model = model;
  }

  angle(p) {
    return 2 * Math.PI * p;
  }

  star(p) {
    const a = this.angle(p), d = this.model.starDistance;
    return { x: d * Math.sin(a), y: d * Math.cos(a) };
  }

  // Der Planet steht dem Stern immer genau gegenüber.
  planet(p) {
    const a = this.angle(p), d = this.model.planetDistance;
    return { x: -d * Math.sin(a), y: -d * Math.cos(a) };
  }

  // Radialgeschwindigkeit des Sterns im Verhältnis zu ihrem größten Wert, −1…1
  radialVelocity(p) {
    return Math.sin(this.angle(p));
  }

  // Fortschritt, bei dem der Planet vom Schwerpunkt aus in Richtung (dx, dy) steht
  progressToward(dx, dy) {
    const p = Math.atan2(-dx, -dy) / (2 * Math.PI);
    return ((p % 1) + 1) % 1;
  }
}

RV.OrbitModel = OrbitModel;
})(globalThis.RadialVelocity = globalThis.RadialVelocity || {});

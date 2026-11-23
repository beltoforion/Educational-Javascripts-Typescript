// Ein Pulsar, dessen Strahl sich dreht, und das Signal, das die Erde davon empfängt.
//
// Orte sind relativ zum Schwerpunkt angegeben, y nach unten; die Erde steht senkrecht darunter. Hat der
// Pulsar einen Planeten, umkreisen beide den Schwerpunkt, sonst ruht der Pulsar in ihm. Die Erde empfängt
// einen Puls, wenn eine der beiden Seiten des Strahls auf sie zeigt. Weil der umlaufende Pulsar die Erde
// aus wechselnder Richtung sieht, treffen seine Pulse etwas früher oder später ein als die des ruhenden.
(function (PT) {
'use strict';

class PulsarModel {
  constructor(model, hasPlanet) {
    this.model = model;
    this.hasPlanet = hasPlanet;
  }

  // Drehwinkel des Strahls zur Zeit t (Sekunden); 0 = die Strahlachse steht senkrecht
  beamAngle(t) {
    return 2 * Math.PI * t / this.model.spinSeconds;
  }

  orbitAngle(t) {
    return 2 * Math.PI * t / this.model.orbitSeconds;
  }

  pulsar(t) {
    if (!this.hasPlanet) return { x: 0, y: 0 };
    const a = this.orbitAngle(t), d = this.model.pulsarDistance;
    return { x: d * Math.sin(a), y: d * Math.cos(a) };
  }

  // Der Planet steht dem Pulsar immer genau gegenüber.
  planet(t) {
    const a = this.orbitAngle(t), d = this.model.planetDistance;
    return { x: -d * Math.sin(a), y: -d * Math.cos(a) };
  }

  earth() {
    return { x: 0, y: this.model.earthDistance };
  }

  // Winkel zwischen der Senkrechten und der Richtung vom Pulsar zur Erde
  earthDirection(t) {
    const p = this.pulsar(t), e = this.earth();
    return Math.atan2(e.x - p.x, e.y - p.y);
  }

  // Empfangenes Signal, 0…1: am stärksten, wenn die Strahlachse genau auf die Erde zeigt
  signal(t) {
    const m = this.model;
    // Abweichung der Strahlachse von der Richtung zur Erde; beide Seiten des Strahls zählen (Periode π)
    let off = (this.beamAngle(t) - this.earthDirection(t)) % Math.PI;
    if (off > Math.PI / 2) off -= Math.PI;
    if (off < -Math.PI / 2) off += Math.PI;
    const pulse = Math.exp(-(off / m.beamWidth) * (off / m.beamWidth));
    return m.baseline + (1 - m.baseline) * pulse;
  }
}

PT.PulsarModel = PulsarModel;
})(globalThis.PulsarTiming = globalThis.PulsarTiming || {});

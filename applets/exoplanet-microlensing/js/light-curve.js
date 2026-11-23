// Die Lichtkurve eines Durchgangs: Lichtmenge am Teleskop an gleichmäßig verteilten Stellungen des Linsensterns,
// im Verhältnis zu der ohne Linse.
// Die Werte werden erst berechnet, wenn sie gebraucht werden, und dann behalten.
(function (ML) {
'use strict';

class LightCurve {
  // brightness(lensX) liefert die Lichtmenge am Teleskop bei dieser Stellung des Linsensterns
  constructor(brightness, travel, samples) {
    this.brightness = brightness;
    this.travel = travel;
    this.count = samples;
    this.values = new Float32Array(samples);   // 0 = noch nicht berechnet
  }

  // Stellung des Linsensterns zum Fortschritt 0…1 des Durchgangs
  lensX(progress) {
    return (2 * progress - 1) * this.travel;
  }

  progressOf(lensX) {
    return Math.min(1, Math.max(0, (lensX / this.travel + 1) / 2));
  }

  // Ist die Stützstelle schon berechnet?
  has(index) {
    return this.values[index] !== 0;
  }

  value(index) {
    if (this.values[index] === 0) {
      this.values[index] = this.brightness(this.lensX(index / (this.count - 1)));
    }
    return this.values[index];
  }

  // Index der letzten Stützstelle, die zum Fortschritt 0…1 schon erreicht ist
  lastIndex(progress) {
    return Math.min(this.count - 1, Math.max(0, Math.floor(progress * (this.count - 1))));
  }

  // Verstärkung zum Fortschritt 0…1, zwischen den Stützstellen linear
  at(progress) {
    const f = Math.min(1, Math.max(0, progress)) * (this.count - 1);
    const i = Math.min(this.count - 2, Math.floor(f));
    return this.value(i) + (this.value(i + 1) - this.value(i)) * (f - i);
  }
}

ML.LightCurve = LightCurve;
})(globalThis.Microlensing = globalThis.Microlensing || {});

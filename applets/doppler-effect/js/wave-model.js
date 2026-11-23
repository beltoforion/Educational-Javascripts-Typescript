// Die Wellenfronten eines bewegten Sterns.
//
// Der Stern steht in der Bildmitte still; dafür zieht der Hintergrund nach rechts. Eine Wellenfront breitet
// sich als Kreis um den Ort aus, an dem sie ausgesandt wurde, und dieser Ort bleibt mit dem Hintergrund hinter
// dem Stern zurück. Orte sind relativ zum Stern angegeben.
(function (DP) {
'use strict';

class WaveModel {
  constructor(model) {
    this.model = model;
  }

  // Die sichtbaren Wellenfronten zur Zeit t (Sekunden): [{ x, radius, age }], age 0…1 (1 = verblasst)
  fronts(t) {
    const m = this.model, fronts = [];
    const newest = Math.floor(t / m.interval);
    for (let k = 0; k < m.fronts; k++) {
      const elapsed = t - (newest - k) * m.interval;      // Zeit seit dem Aussenden dieser Front
      if (elapsed < 0) continue;
      fronts.push({
        x: m.starSpeed * m.waveSpeed * elapsed,
        radius: m.waveSpeed * elapsed,
        age: elapsed / (m.fronts * m.interval),
      });
    }
    return fronts;
  }

  // Abstand zweier aufeinanderfolgender Wellenfronten, vor dem Stern (in Bewegungsrichtung) und hinter ihm
  spacing() {
    const m = this.model, base = m.waveSpeed * m.interval;
    return { ahead: base * (1 - m.starSpeed), behind: base * (1 + m.starSpeed) };
  }
}

DP.WaveModel = WaveModel;
})(globalThis.Doppler = globalThis.Doppler || {});

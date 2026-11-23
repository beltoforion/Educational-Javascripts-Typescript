// Die Lichtkurven über den Szenen. Die Helligkeit ist logarithmisch aufgetragen, wie bei den
// Größenklassen der Astronomie; sonst gingen die kurzen Spitzen des Planeten neben dem Maximum unter.
(function (ML) {
'use strict';

class ChartView {
  // rect: { left, right, top, bottom }, maxMagnification = oberer Rand der Auftragung
  constructor(rect, texts, maxMagnification) {
    this.texts = texts;
    this.chart = new ExoKit.Chart(rect, {
      xTitle: texts.time, yTitle: texts.brightness, min: 0.86, max: maxMagnification, log: true,
    });
  }

  set font(font) {
    this.chart.font = font;
  }

  // series: [{ curve, color, width, mark }], in Zeichenreihenfolge. mark = Fortschritt, bei dem der Planet
  // die Kurve ausschlagen lässt, oder null.
  draw(ctx, series, progress) {
    this.chart.axes(ctx);
    for (const s of series) this.chart.line(ctx, this._points(s.curve, progress), s.color, s.width);
    for (const s of series) {
      if (s.mark === null || progress <= s.mark) continue;
      this.chart.mark(ctx, s.mark, s.curve.at(s.mark), this.texts.planet, Math.min(1, (progress - s.mark) / 0.03));
    }
  }

  // Die Kurve bis zum Fortschritt. Stützstellen, die noch nicht berechnet sind, werden übersprungen; sie
  // füllen sich in den nächsten Bildern (siehe app.js).
  _points(curve, progress) {
    const last = curve.lastIndex(progress), n = curve.count - 1, points = [];
    for (let i = 0; i <= last; i++) {
      if (curve.has(i)) points.push([i / n, curve.value(i)]);
    }
    points.push([progress, curve.at(progress)]);
    return points;
  }
}

ML.ChartView = ChartView;
})(globalThis.Microlensing = globalThis.Microlensing || {});

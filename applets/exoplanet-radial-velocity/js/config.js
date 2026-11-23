// Feste Größen des Applets zur Radialgeschwindigkeitsmethode. Schema, nicht maßstäblich: Der Stern bewegt
// sich in Wirklichkeit viel weniger, und die Linien im Spektrum verschieben sich nur um winzige Beträge.
// Längen in logischen Pixeln der Zeichenfläche.
(function (RV) {
'use strict';

RV.VERSION = '2.0.0';

RV.config = Object.freeze({
  model: Object.freeze({
    starDistance: 28,       // Abstand des Sterns vom gemeinsamen Schwerpunkt
    planetDistance: 105,    // Abstand des Planeten vom Schwerpunkt, auf der Gegenseite
  }),
  timing: Object.freeze({
    periodSeconds: 9,       // Dauer eines Umlaufs
  }),
  // Aufbau wie in der früheren Fassung: oben das Sternspektrum, am linken Rand der Pfeil der
  // Radialgeschwindigkeit, in der Mitte Stern und Planet, unten die Sternwarte.
  view: Object.freeze({
    width: 840,
    height: 580,
    centerX: 420,           // Schwerpunkt
    centerY: 300,
    telescopeY: 452,        // Öffnung der Kuppel; die Sternwarte blickt von unten auf das System
    starSize: 56,
    planetSize: 20,
    barycenterSize: 10,
    spectrum: Object.freeze({ titleY: 26, y: 72, width: 400, height: 46, shift: 22 }),   // shift = größte Verschiebung der Linien
    arrow: Object.freeze({ x: 86, length: 62, titleX: 46 }),   // Pfeil der Radialgeschwindigkeit und sein Titel
  }),
});
})(globalThis.RadialVelocity = globalThis.RadialVelocity || {});

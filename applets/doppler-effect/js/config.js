// Feste Größen des Applets zum Doppler-Effekt. Längen in logischen Pixeln der Zeichenfläche.
(function (DP) {
'use strict';

DP.VERSION = '2.0.0';

DP.config = Object.freeze({
  model: Object.freeze({
    waveSpeed: 34,          // Ausbreitung der Wellenfronten, Pixel je Sekunde
    starSpeed: 0.5,         // Geschwindigkeit des Sterns im Verhältnis dazu (er bewegt sich nach links)
    interval: 0.42,         // Zeit zwischen zwei Wellenfronten, Sekunden
    fronts: 22,             // so viele Wellenfronten sind gleichzeitig zu sehen
  }),
  view: Object.freeze({
    width: 840,
    height: 560,
    starX: 350,
    starY: 290,
    starSize: 46,
    backgroundStars: 150,
    labelY: 520,
  }),
});
})(globalThis.Doppler = globalThis.Doppler || {});

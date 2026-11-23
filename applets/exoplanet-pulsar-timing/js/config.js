// Feste Größen des Applets zum Pulsar-Timing. Schema, nicht maßstäblich: Die Bahn des Pulsars ist im
// Verhältnis zur Entfernung der Erde riesig, damit die Verschiebung der Pulse sichtbar wird.
// Längen in logischen Pixeln der Zeichenfläche, Winkel im Bogenmaß.
(function (PT) {
'use strict';

PT.VERSION = '2.0.0';

PT.config = Object.freeze({
  model: Object.freeze({
    pulsarDistance: 46,      // Abstand des Pulsars vom gemeinsamen Schwerpunkt
    planetDistance: 122,     // Abstand des Planeten vom Schwerpunkt, auf der Gegenseite
    earthDistance: 228,      // Abstand der Erde vom Schwerpunkt, senkrecht darunter
    spinSeconds: 3,          // eine Drehung des Pulsars; sein Strahl hat zwei Seiten, also zwei Pulse je Drehung
    orbitSeconds: 21,        // ein Umlauf um den Schwerpunkt
    beamWidth: 0.075,        // Breite des Strahls (Winkel, bei dem seine Stärke auf 1/e gefallen ist)
    baseline: 0.12,          // Signal zwischen den Pulsen
  }),
  view: Object.freeze({
    width: 840,
    height: 630,
    // Zwei Szenen nebeneinander, links mit und rechts ohne Planet
    panels: Object.freeze([
      Object.freeze({ x: 0, width: 420 }),
      Object.freeze({ x: 420, width: 420 }),
    ]),
    captionY: 190,
    centerY: 338,            // Schwerpunkt
    pulsarSize: 22,
    planetSize: 22,
    earthSize: 62,
    barycenterSize: 10,
    beamLength: 300,
    chart: Object.freeze({ left: 78, right: 812, top: 22, bottom: 142 }),
    chartSeconds: 6,         // Zeitspanne, die das Diagramm zeigt, bevor es von vorn beginnt
    chartSamples: 600,
  }),
});
})(globalThis.PulsarTiming = globalThis.PulsarTiming || {});

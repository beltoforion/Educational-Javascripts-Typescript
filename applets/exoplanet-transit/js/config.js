// Feste Größen des Transit-Applets. Schema, nicht maßstäblich: Der Planet ist im Verhältnis zum Stern viel
// zu groß und umkreist ihn viel zu nah, und die feinen Effekte außerhalb des Transits sind um ein
// Vielfaches überzeichnet. Längen in logischen Pixeln der Zeichenfläche.
(function (TR) {
'use strict';

TR.VERSION = '2.1.0';

TR.config = Object.freeze({
  model: Object.freeze({
    starRadius: 85,
    planetRadius: 13,
    orbitRadius: 330,       // Halbachse der Bahn; man sieht fast genau auf ihre Kante
    orbitTilt: 0.05,        // Stauchung der Bahn zur Ellipse (Blick leicht von oben)
    limbDarkening: 0.6,     // Randverdunklung des Sterns: 0 = gleichmäßig helle Scheibe
    // Die feinen Effekte, jeweils als größter Anteil an der Helligkeit des Sterns. In Wirklichkeit ist das
    // reflektierte Licht eines heißen Jupiters etwa hundertmal schwächer als sein Transit tief ist, und die
    // beiden anderen sind noch einmal deutlich kleiner.
    reflection: 0.005,      // Licht des Sterns, das der voll beleuchtete Planet zurückwirft
    ellipsoidal: 0.0016,    // der Planet zieht den Stern leicht in die Länge; von der Seite sieht man mehr Fläche
    beaming: 0.001,         // der Stern erscheint heller, während er sich auf uns zu bewegt
    noise: 0.0005,          // Messrauschen der Helligkeit
    samples: 480,           // Messpunkte je Umlauf
  }),
  timing: Object.freeze({
    periodSeconds: 16,      // Dauer eines Umlaufs
  }),
  view: Object.freeze({
    width: 840,
    height: 630,
    starX: 420,
    starY: 305,
    telescopeY: 512,        // Öffnung der Kuppel
    // rechts neben dem Diagramm bleibt Platz für den Maßstabsbalken
    chart: Object.freeze({ left: 78, right: 762, top: 22, bottom: 142 }),
    scaleBarX: 780,
    // Wertebereich der Helligkeit für die ganze Kurve (1 = Stern allein). Die Vergrößerung wählt den Bereich,
    // den sie spreizt, selbst so, dass die feinen Effekte das Diagramm füllen.
    fullRange: Object.freeze({ min: 0.9655, max: 1.011 }),
    fullScaleBar: 0.01,     // Länge des Maßstabsbalkens bei der ganzen Kurve und in der Vergrößerung
    zoomScaleBar: 0.002,
    zoomBreakShare: 0.24,   // Anteil der Diagrammhöhe, in den die Vergrößerung den Transit staucht
    legendY: 180,           // Zeile unter dem Diagramm, in der die Vergrößerung ihre Kurven benennt
  }),
  // Farben der einzelnen Anteile in der Vergrößerung
  colors: Object.freeze({ reflection: '#4fb4ff', ellipsoidal: '#7dff8a', beaming: '#ff6ad5' }),
});
})(globalThis.Transit = globalThis.Transit || {});

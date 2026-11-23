// Feste Größen des Modells und der Darstellung.
//
// Das Applet ist ein Schema: Die Lichtablenkung, die Masse des Planeten und die Größe der Sterne sind
// stark übertrieben, die Entfernungen nicht maßstäblich. Die Lichtwege und die Lichtkurve folgen trotzdem
// der Linsengleichung.
// Winkel sind in Einsteinradien des Linsensterns angegeben, Längen der Zeichnung in logischen Pixeln.
(function (ML) {
'use strict';

ML.VERSION = '1.0.0';

ML.config = Object.freeze({
  model: Object.freeze({
    // Radius des Hintergrundsterns. Er muss deutlich kleiner sein als der Bereich, in dem der Planet
    // zusätzlich verstärkt; sonst verschmieren dessen zwei Spitzen in der Lichtkurve zu einem Buckel.
    sourceRadius: 0.04,
    planetMass: 0.03,      // Masse des Planeten in Sternmassen (echte Planeten: um 0,001 und weniger)
    planetOffset: 1.5,     // Abstand des Planeten vom Stern; er läuft dem Stern voraus
    travel: 5,             // der Linsenstern zieht von −travel bis +travel an der Sichtlinie vorbei
    samples: 600,          // Stützstellen der Lichtkurve
    cellsPerRadius: 8,     // Feinheit des Gitters, auf dem die Helligkeit der Bilder aufsummiert wird
  }),
  timing: Object.freeze({
    passSeconds: 26,       // Dauer eines Durchgangs
    holdSeconds: 3,        // Pause am Ende, bevor es von vorn beginnt
  }),
  view: Object.freeze({
    width: 840,
    height: 630,
    // Zwei Szenen nebeneinander, links mit und rechts ohne Planet
    panels: Object.freeze([
      Object.freeze({ x: 0, width: 420 }),
      Object.freeze({ x: 420, width: 420 }),
    ]),
    captionY: 190,         // Überschrift der Szenen
    sourceY: 290,          // Höhe des Hintergrundsterns
    lensY: 405,            // Höhe der Linsenebene
    telescopeY: 550,       // Öffnung der Kuppel, dort laufen die Lichtwege zusammen
    groundY: 586,          // Horizont; dort enden die Strahlen, die das Teleskop verfehlen
    einsteinRadius: 24,    // Einsteinradius in der Linsenebene, in Pixeln
    skyHalfHeight: 62,     // halbe Höhe des Streifens, in dem die verzerrten Bilder gezeichnet werden
    maxRasterScale: 2,     // die Bilder werden höchstens in doppelter Auflösung gerechnet
    fanStep: 0.028,        // Abstand der gezeichneten Strahlen des Fächers, als Steigung dx/dy
    fanSpread: 0.73,       // der Fächer reicht bis zu dieser Steigung nach beiden Seiten
    telescopeAperture: 4.3, // Radius der Teleskopöffnung, die ein gezeichneter Strahl treffen muss
    raysShown: 5,          // so viele Strahlen des gezeichneten Netzes treffen die Öffnung ohne Linse
    hitsDrawn: 60,         // höchstens so viele Treffer werden gezeichnet
    arrowSpacing: 84,      // Abstand der Richtungspfeile entlang eines Strahls
    flowSpeed: 45,         // Tempo, mit dem die Richtungspfeile wandern, Pixel je Sekunde
    chart: Object.freeze({ left: 78, right: 812, top: 22, bottom: 142 }),
    observatoryScale: 0.81, // Vergrößerung des Bildes der Sternwarte
    // Durchmesser des Linsensterns. Strahlen, die auf seine Scheibe treffen, enden dort. Das begrenzt
    // zugleich die stärkste Ablenkung: Bei der übertriebenen Anziehung würden Strahlen, die noch näher
    // am Stern vorbeiliefen, um ihn herum und zurückgeworfen.
    starSize: 24,
    sourceSize: 13,        // Durchmesser des Hintergrundsterns
    planetSize: 9,         // Durchmesser des Planeten
    planetCore: 0.8,       // so nah am Planeten endet ein Lichtstrahl
  }),
});
})(globalThis.Microlensing = globalThis.Microlensing || {});

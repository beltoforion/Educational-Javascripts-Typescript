// Feste Größen des Modells und die Startwerte aller einstellbaren Parameter.
// Einheiten: G = 1, Sternmasse = 1, Radius der Startwolke = 1,6.
(function (Disk) {
'use strict';

Disk.constants = Object.freeze({
  DT: 0.0075,                  // Zeitschritt
  R0: 1.6,                     // Radius der Startwolke
  R_ACC: 0.06,                 // Einfangradius des Protosterns
  EPS: 0.03,                   // Plummer-Glättung der Teilchengravitation, wenn nichts verschmilzt
  MC0: 1.0,                    // Anfangsmasse des Protosterns
  FADE: 0.93,                  // Nachleuchten der Bahnspuren
  EARTH: 3.0e-6,               // Erdmasse in Sonnenmassen
  PLANET_MASS: 100 * 3.0e-6,   // ab hier zählt ein Körper als Protoplanet
  CO_MAX: 2,                   // größter Bezugsradius, mit dem die Kamera mitdrehen kann
  BODY_MIN_W: 2,               // ab diesem Körperradius (8 Teilchenmassen) gilt ein Körper als gewachsen: Die Maus zeigt dann Rang und Masse
  FOV: 40 * Math.PI / 180,     // Öffnungswinkel der Kamera
});

// Die Parameter, die Regler und Konsole verändern dürfen. Der Suchteil der Adresse kann die Teilchenzahl
// vorgeben (?n=16384).
Disk.createParams = function (search) {
  const params = {
    ts: 64,              // Kantenlänge der Teilchentextur, Teilchenzahl = ts²
    diss: 12,            // Stärke der inelastischen Stöße
    md: 0.08,            // Masse der Wolke in Sternmassen
    drawEvery: 1,        // Bild erst neu zeichnen, wenn die Simulation so viele Schritte weiter ist (1 = zu jedem Bildschirmbild)
    eddy: 0.9,           // Stärke der großen Wirbel in der Startwolke
    turb: 0.3,           // feine Unordnung in der Startwolke
    h0: 0.05,            // Stoßradius bei 4 096 Teilchen
    merge: true,         // Teilchen verschmelzen zu Körpern
    stick: 1,            // Haftung: Vielfaches der Fluchtgeschwindigkeit zum Quadrat
    rm: 0.0039,          // Körperradius eines Teilchens bei 4 096 Teilchen und 8 % Wolkenmasse
    hill: 0.7,           // Anteil der Hill-Sphäre, in dem ein Paar zusammenbleiben kann
    mode: 0,             // Farbmodus
    trails: true,        // Bahnspuren zeichnen
    axis: true,          // Drehimpulsachse und Ebene zeigen
    co: 0,               // Radius, mit dessen Umlaufgeschwindigkeit die Kamera mitdreht (0 = aus)
    // Kamera kreist langsam, außer jemand hat weniger Bewegung eingestellt. Ohne Fenster gibt es die Abfrage nicht.
    spin: typeof matchMedia === 'function' ? !matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  };
  const query = new URLSearchParams(search);
  if (query.has('n')) params.ts = Math.max(8, Math.min(256, Math.round(Math.sqrt(+query.get('n')) || 64)));
  return params;
};
})(globalThis.Disk = globalThis.Disk || {});

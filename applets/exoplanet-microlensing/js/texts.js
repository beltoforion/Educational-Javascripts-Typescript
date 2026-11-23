// Die eigenen Texte des Applets, deutsch und englisch; die gemeinsamen stehen im Baukasten (ExoKit.texts).
(function (ML) {
'use strict';

const TEXTS = {
  de: {
    withPlanet: 'Stern mit Exoplanet',
    starOnly: 'Stern ohne Exoplanet',
    source: 'Hintergrundstern',
    lensStar: 'Linsenstern',
    planet: 'Exoplanet',
    hint: 'Ziehen verschiebt die Linsensterne.',
    aria: 'Schema eines Mikrolinsenereignisses in zwei Szenen nebeneinander: Ein Stern zieht vor einem ' +
          'Hintergrundstern vorbei, lenkt dessen Licht zum Teleskop und lässt ihn heller erscheinen. Links hat ' +
          'der Stern einen Planeten, rechts nicht. Darüber die beiden Lichtkurven.',
  },
  en: {
    withPlanet: 'Star with exoplanet',
    starOnly: 'Star without exoplanet',
    source: 'Background star',
    lensStar: 'Lens star',
    planet: 'Exoplanet',
    hint: 'Drag to move the lens stars.',
    aria: 'Diagram of a microlensing event in two scenes side by side: a star passes in front of a ' +
          'background star, bends its light toward the telescope and makes it appear brighter. On the left ' +
          'the star has a planet, on the right it has none. Above them the two light curves.',
  },
};

ML.texts = function (lang) {
  return ExoKit.texts(lang, TEXTS);
};
})(globalThis.Microlensing = globalThis.Microlensing || {});

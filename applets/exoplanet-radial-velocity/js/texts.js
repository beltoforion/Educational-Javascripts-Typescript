// Die eigenen Texte des Applets, deutsch und englisch; die gemeinsamen stehen im Baukasten (ExoKit.texts).
(function (RV) {
'use strict';

const TEXTS = {
  de: {
    velocity: 'Radialgeschwindigkeit',
    spectrum: 'Sternspektrum',
    star: 'Stern',
    planet: 'Exoplanet',
    hint: 'Ziehen dreht Stern und Planet um ihren Schwerpunkt.',
    aria: 'Schema der Radialgeschwindigkeitsmethode: Stern und Planet umkreisen ihren gemeinsamen Schwerpunkt. ' +
          'Bewegt sich der Stern von der Sternwarte weg, verschieben sich die Linien seines Spektrums zum roten ' +
          'Ende, bewegt er sich auf sie zu, zum blauen. Ein Pfeil am linken Rand zeigt die Radialgeschwindigkeit.',
  },
  en: {
    velocity: 'Radial velocity',
    spectrum: 'Stellar spectrum',
    star: 'Star',
    planet: 'Exoplanet',
    hint: 'Drag to turn star and planet around their center of mass.',
    aria: 'Diagram of the radial velocity method: star and planet orbit their common center of mass. When the ' +
          'star moves away from the observatory, the lines of its spectrum shift toward the red end; when it ' +
          'approaches, toward the blue end. An arrow at the left edge shows the radial velocity.',
  },
};

RV.texts = function (lang) {
  return ExoKit.texts(lang, TEXTS);
};
})(globalThis.RadialVelocity = globalThis.RadialVelocity || {});

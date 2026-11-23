// Die eigenen Texte des Applets, deutsch und englisch; die gemeinsamen stehen im Baukasten (ExoKit.texts).
(function (DP) {
'use strict';

const TEXTS = {
  de: {
    motion: 'Bewegung des Sterns',
    shorter: 'kürzere Wellenlänge: blauer',
    longer: 'längere Wellenlänge: röter',
    aria: 'Schema des Doppler-Effekts: Ein Stern sendet in gleichen Zeitabständen kreisförmige Wellenfronten ' +
          'aus und bewegt sich dabei nach links. In Bewegungsrichtung liegen die Wellenfronten dichter ' +
          'beieinander, in der Gegenrichtung weiter auseinander.',
  },
  en: {
    motion: 'Motion of the star',
    shorter: 'shorter wavelength: bluer',
    longer: 'longer wavelength: redder',
    aria: 'Diagram of the Doppler effect: a star emits circular wave fronts at equal intervals while moving to ' +
          'the left. In the direction of motion the wave fronts are closer together, in the opposite ' +
          'direction farther apart.',
  },
};

DP.texts = function (lang) {
  return ExoKit.texts(lang, TEXTS);
};
})(globalThis.Doppler = globalThis.Doppler || {});

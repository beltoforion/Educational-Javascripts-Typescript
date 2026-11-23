// Die eigenen Texte des Applets, deutsch und englisch; die gemeinsamen stehen im Baukasten (ExoKit.texts).
(function (PT) {
'use strict';

const TEXTS = {
  de: {
    withPlanet: 'Pulsar mit Exoplanet',
    pulsarOnly: 'Pulsar ohne Exoplanet',
    signal: 'Signal',
    planet: 'Exoplanet',
    earth: 'Erde',
    aria: 'Schema des Pulsar-Timings in zwei Szenen nebeneinander: Der Strahl eines Pulsars überstreicht bei ' +
          'jeder Drehung die Erde. Links umkreist der Pulsar mit einem Planeten den gemeinsamen Schwerpunkt, ' +
          'rechts steht er still. Darüber die empfangenen Pulse beider Pulsare; die des linken treffen leicht ' +
          'verschoben ein.',
  },
  en: {
    withPlanet: 'Pulsar with exoplanet',
    pulsarOnly: 'Pulsar without exoplanet',
    signal: 'Signal',
    planet: 'Exoplanet',
    earth: 'Earth',
    aria: 'Diagram of pulsar timing in two scenes side by side: the beam of a pulsar sweeps across Earth with ' +
          'every rotation. On the left the pulsar orbits a common center of mass with a planet, on the right ' +
          'it stands still. Above them the received pulses of both pulsars; those of the left one arrive ' +
          'slightly shifted.',
  },
};

PT.texts = function (lang) {
  return ExoKit.texts(lang, TEXTS);
};
})(globalThis.PulsarTiming = globalThis.PulsarTiming || {});

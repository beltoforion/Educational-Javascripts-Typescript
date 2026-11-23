// Die eigenen Texte des Applets, deutsch und englisch; die gemeinsamen stehen im Baukasten (ExoKit.texts).
(function (TR) {
'use strict';

const TEXTS = {
  de: {
    star: 'Stern',
    planet: 'Exoplanet',
    transit: 'Transit',
    secondary: 'sekundäre Bedeckung',
    reflection: 'Phasenkurve (Reflexion)',
    ellipsoidal: 'ellipsoidale Variation',
    beaming: 'Doppler-Beaming',
    scaleFull: '1 %',
    scaleZoom: '0,2 %',
    zoomIn: 'Feine Effekte vergrößern',
    zoomOut: 'Ganze Kurve zeigen',
    hint: 'Ziehen verschiebt den Planeten; oben läuft er hinter dem Stern.',
    aria: 'Schema der Transitmethode: Ein Planet umkreist seinen Stern und zieht dabei vor ihm vorbei. Solange ' +
          'er einen Teil der Sternscheibe verdeckt, sinkt die gemessene Helligkeit. Darüber die Lichtkurve mit ' +
          'dem Transit, der sekundären Bedeckung hinter dem Stern und der Phasenkurve dazwischen.',
  },
  en: {
    star: 'Star',
    planet: 'Exoplanet',
    transit: 'Transit',
    secondary: 'secondary eclipse',
    reflection: 'phase curve (reflected light)',
    ellipsoidal: 'ellipsoidal variation',
    beaming: 'Doppler beaming',
    scaleFull: '1 %',
    scaleZoom: '0.2 %',
    zoomIn: 'Magnify subtle effects',
    zoomOut: 'Show whole curve',
    hint: 'Drag to move the planet; above, it passes behind the star.',
    aria: 'Diagram of the transit method: a planet orbits its star and passes in front of it. While it covers ' +
          'part of the stellar disk, the measured brightness drops. Above it the light curve with the transit, ' +
          'the secondary eclipse behind the star and the phase curve in between.',
  },
};

TR.texts = function (lang) {
  return ExoKit.texts(lang, TEXTS);
};
})(globalThis.Transit = globalThis.Transit || {});

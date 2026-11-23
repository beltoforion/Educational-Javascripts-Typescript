// Gemeinsamer Baukasten der Exoplaneten-Applets: Farben, Schrift und Standardtexte.
// Alle Applets zu den Nachweisverfahren benutzen ihn, damit sie gleich aussehen und sich gleich bedienen.
// Längen sind in logischen Pixeln der Zeichenfläche angegeben.
(function (Kit) {
'use strict';

Kit.colors = Object.freeze({
  background: '#000000',
  axis: '#ffffff',
  text: '#ffffff',
  light: '#ffe81a',          // Lichtstrahlen
  primary: '#ffab0f',        // erste Kurve und ihre Szene (mit Planet)
  secondary: '#4fb4ff',      // zweite Kurve und ihre Szene (ohne Planet)
  orbit: 'rgba(176, 44, 44, 0.85)',
  divider: 'rgba(255, 255, 255, 0.22)',
});

// Schrift der Beschriftung. scale = Bildschirmpixel je logischem Pixel; wird die Zeichenfläche verkleinert,
// wächst die logische Schriftgröße, damit die Schrift auf dem Schirm nicht unter 11 Pixel fällt.
Kit.labelFont = function (scale) {
  const size = Math.min(20, Math.max(15, 11 / scale));
  return size.toFixed(1) + 'px "DejaVu Sans", "Segoe UI", system-ui, Arial, sans-serif';
};

// Texte, die in jedem Applet gleich lauten
const TEXTS = {
  de: { pause: 'Anhalten', resume: 'Weiter', time: 'Zeit', brightness: 'Helligkeit' },
  en: { pause: 'Pause', resume: 'Resume', time: 'Time', brightness: 'Brightness' },
};

// Die gemeinsamen Texte einer Sprache, ergänzt um die eigenen des Applets: own = { de: {…}, en: {…} }
Kit.texts = function (lang, own) {
  const key = TEXTS[lang] ? lang : 'de';
  return Object.assign({}, TEXTS[key], own ? own[key] : null);
};
})(globalThis.ExoKit = globalThis.ExoKit || {});

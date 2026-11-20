// Atlas der Exoplaneten: eigenständige Seite (atlas.html) mit Planetentyp,
// Filtersätzen und nachladbaren Texten zu einzelnen Entdeckungen.
//
// Daten:   ../data.js und ../data-extra.js (erzeugt mit "node update-data.js")
// Texte:   discoveries/<sprache>/<id>.html, Verzeichnis in discoveries.js
//          (erzeugt mit "node atlas/update-index.js")
//
// Läuft ohne Server (file://) und lädt nichts von fremden Servern.
//
// Einbetten in eine andere Website: Angaben als JSON im Attribut
// data-atlas-config am Element (oder vorab in window.EXO_ATLAS_CONFIG), alle
// optional:
//   lang      'de' oder 'en' (wie data-lang)
//   langUrls  { "de": "/de/…/", "en": "/en/…/" }: der Sprachschalter führt
//             dann zu dieser Adresse, statt an Ort und Stelle zu wechseln
//   base      Ordner, in dem der Ordner atlas/ liegt (z. B. "/de/exoplaneten/
//             atlas/"), wenn die Seite selbst woanders liegt
//   site      { "logo": { "src": …, "href": …, "alt": … },
//               "links": [ { "text": "Impressum", "href": … }, … ] }
//             erscheint unten in der linken Leiste. text und href dürfen
//             auch { "de": …, "en": … } sein.
//   intro     false: kein Zeitraffer beim Öffnen
//   setTitle  false: den Seitentitel (document.title) nicht verändern
//
// Version: bei jeder Änderung hochzählen und hier eintragen.
//   1.1.1  2026-11-20  Zoom zurücksetzen als Symbolknopf unten rechts neben
//                      dem Diagramm (verdeckt keine Punkte mehr); ein
//                      einheitlicher, eckiger Stil für alle Knöpfe
//   1.2.0  2026-11-20  Neue Bedienung: Klick wählt einen Planeten aus, Klick
//                      ins Freie hebt die Auswahl auf und zeigt die Übersicht;
//                      Überfahren zeigt nur noch den Hinweis am Mauszeiger.
//                      Die Übersicht zeigt Kacheln für alle Berichte (mit den
//                      Cursortasten ansteuerbar); in den Berichten oben
//                      Knöpfe zum Vor- und Zurückblättern (auch Pfeiltasten).
//   1.3.0  2026-11-20  Planeten des Sonnensystems: auswählbar (Marke, Name,
//                      Suche, eigene Kachelreihe), mit eigenem Bericht und
//                      Steckbrief (mit Monden) in abgesetzter Aufmachung. Filtersatz
//                      "Nachbarschaft" entfernt (gleich der Entfernungsauswahl).
//   1.4.0  2026-11-20  Bedienbarkeit: sichtbarer Rückweg (✕) im festen Kopf des
//                      Infofelds, "Filter zurücksetzen", selten Gebrauchtes
//                      unter "Weitere Filter", Zeitleiste folgt den Filtern,
//                      Regionsnamen zoomen, "Alles zeigen" nur wenn gezoomt,
//                      kürzere und einfachere Texte.
//   1.5.0  2026-11-20  Dritte Ansicht "Masse · Größe" mit Linien gleicher Dichte
//                      (nur Planeten mit gemessener Masse und gemessenem Radius).
//   1.6.0  2026-11-20  Planetensysteme: vierte Ansicht (je Zeile ein Stern mit
//                      seinen Planeten nach Umlaufzeit, habitable Zone als
//                      Band), schematische Leiste des Systems im Steckbrief,
//                      eigenes Infofeld je System. Vermutete Lücken nach der
//                      Titius-Bode-Regel (Verfahren von Lara u. a. 2020).
//   1.6.1  2026-11-20  Infofeld eines Systems: Diagramm zur Titius-Bode-Reihe
//                      (Umlaufzeit je Platz mit der Reihe als Gerade, darunter
//                      die Abweichung jedes Planeten von der Reihe).
//   1.6.2  2026-11-20  Zeitleiste unten ist anfangs eingeklappt (Knopf
//                      "Zeitleiste"); der Filter für Mehrplanetensysteme steht
//                      nur noch unter "Weitere Filter", nicht mehr oben.
//   1.6.3  2026-11-20  Titius-Bode-Reihe vorsichtiger beschrieben: "freie Plätze
//                      der Reihe" statt "vermutete Lücken", keine Aussage mehr
//                      darüber, was dort kreisen könnte; Hinweis auf die
//                      Gegenprüfung von Huang & Bakos (2014).
//   1.1.0  2026-11-20  Einbetten in eine Website: Logo und Links (site),
//                      Sprachschalter mit Zieladressen (langUrls), Basispfad
//                      (base); Berichte werden über http(s) direkt geladen
//   1.0.0  2026-11-20  erste Fassung

(function () {
  'use strict';

  const VERSION = '1.6.3';

  // ============================================================ Konstanten
  const EARTH_PER_JUPITER = 317.83;   // Erdmassen je Jupitermasse
  const RE_PER_RJ = 11.209;           // Erdradien je Jupiterradius
  const DAYS_PER_YEAR = 365.25;
  const SOLAR_CONSTANT = 1361;        // W/m² an der Erdbahn
  const SUN_TEFF = 5772;
  const LY_PER_PC = 3.2616;
  const log10 = Math.log10;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Planetentypen, nach Größe geordnet. Farben mit dem Paletten-Validator
  // geprüft (dunkler Grund, Nachbarn auf der Massenachse).
  const TYPES = [
    { key: 'rocky', color: '#199e70', glow: '#3fe0a6', size: 1.5 },
    { key: 'mini', color: '#c98500', glow: '#ffc247', size: 1.9 },
    { key: 'neptune', color: '#3987e5', glow: '#6fb0ff', size: 2.3 },
    { key: 'giant', color: '#d55181', glow: '#ff7fae', size: 2.9 },
    { key: 'bd', color: '#9085e9', glow: '#b3aaff', size: 3.3 },
  ];
  const METHODS = [
    { key: 'rv', color: '#e66767', glow: '#ff9a9a' },
    { key: 'tr', color: '#3987e5', glow: '#6fb0ff' },
    { key: 'ti', color: '#0ca30c', glow: '#58e058' },
    { key: 'im', color: '#c98500', glow: '#ffc247' },
    { key: 'ml', color: '#d55181', glow: '#ff7fae' },
    { key: 'other', color: '#8a90a8', glow: '#b9bfd6' },
  ];
  const METHOD_OF = {
    'Radial Velocity': 0, 'Primary Transit': 1, 'Timing': 2, 'Pulsar': 2, 'TTV': 2,
    'Imaging': 3, 'Microlensing': 4,
  };
  // Sternfarbe nach Temperatur (kühl = rötlich, heiß = bläulich).
  const TEFF_STOPS = [
    [2400, [255, 128, 92]], [3300, [255, 164, 110]], [4300, [255, 205, 150]],
    [5300, [255, 236, 200]], [6000, [255, 250, 240]], [7000, [214, 226, 255]],
    [9000, [170, 196, 255]], [12000, [140, 170, 255]],
  ];
  const TEFF_BUCKETS = 14;
  const UNKNOWN_COLOR = '#6c7391';

  // Habitable Zone nach Kopparapu et al. 2014 (ApJL 787, L29): Grenzen als
  // Einstrahlung relativ zur Erde, S = S0 + a·T + b·T² + c·T³ + d·T⁴ mit
  // T = Teff - 5780 K, gültig für 2600-7200 K.
  const HZ = {
    recentVenus: [1.776, 2.136e-4, 2.533e-8, -1.332e-11, -3.097e-15],
    runaway: [1.107, 1.332e-4, 1.580e-8, -8.308e-12, -1.931e-15],
    maxGreen: [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16],
    earlyMars: [0.320, 5.547e-5, 1.526e-9, -2.874e-12, -5.011e-16],
  };
  function hzLimit(c, teff) {
    const t = clamp(teff, 2600, 7200) - 5780;
    return c[0] + c[1] * t + c[2] * t * t + c[3] * t * t * t + c[4] * t * t * t * t;
  }
  function hzClass(flux, teff) {
    if (flux === null) return 'unknown';
    if (!teff || teff < 2300 || teff > 7600) return 'none';
    if (flux > hzLimit(HZ.recentVenus, teff)) return 'hot';
    if (flux > hzLimit(HZ.runaway, teff)) return 'inner';
    if (flux >= hzLimit(HZ.maxGreen, teff)) return 'yes';
    if (flux >= hzLimit(HZ.earlyMars, teff)) return 'outer';
    return 'cold';
  }
  function relativeFlux(teff, starRadius, starMass, axis, periodDays) {
    if (!teff || !starRadius) return null;
    const a = axis || (starMass ? Math.cbrt(starMass * Math.pow(periodDays / DAYS_PER_YEAR, 2)) : null);
    if (!a) return null;
    return starRadius * starRadius * Math.pow(teff / SUN_TEFF, 4) / (a * a);
  }

  // Masse aus dem Radius (beide in Erdeinheiten) nach Chen & Kipping 2017
  // (ApJ 834, 17, "Forecaster"): R = 1,008·M^0,279 bis 2,04 Erdmassen, darüber
  // R = 0,808·M^0,589. Oberhalb von MAX_EST_RADIUS hängt der Radius kaum noch
  // von der Masse ab; solche Planeten werden nicht geschätzt.
  const MAX_EST_RADIUS = 8;
  const UPPER_LIMIT_FACTOR = 4;   // Katalogmasse gilt als Obergrenze, wenn so viel größer als die Schätzung
  function massFromRadius(r) {
    return r < 1.23 ? Math.pow(r / 1.008, 1 / 0.279) : Math.pow(r / 0.808, 1 / 0.589);
  }
  // Umgekehrt: Radius aus der Masse, für Planeten ohne gemessenen Radius
  // (vor allem Funde der Radialgeschwindigkeitsmethode). Nur bis zur Masse,
  // die MAX_EST_RADIUS entspricht.
  const MAX_EST_MASS = massFromRadius(MAX_EST_RADIUS);
  function radiusFromMass(m) {
    return m < 2.04 ? 1.008 * Math.pow(m, 0.279) : 0.808 * Math.pow(m, 0.589);
  }

  // Planetentyp: kleine Planeten nach dem Radius (er verrät die
  // Zusammensetzung besser als die Masse), große nach der Masse.
  function classifyType(massE, radiusE, massMeasured) {
    if (massMeasured && massE >= 13 * EARTH_PER_JUPITER) return 4;
    if (radiusE !== null && radiusE < 1.6) return 0;
    if (radiusE !== null && radiusE < 3.5) return 1;
    if (massMeasured) {
      if (radiusE === null && massE < 5) return 0;
      return massE < 12 ? 1 : massE < 60 ? 2 : 3;
    }
    return radiusE < 7 ? 2 : 3;
  }
  function classifyMethod(text) {
    for (const part of String(text).split(',')) {
      const i = METHOD_OF[part.trim()];
      if (i !== undefined) return i;
    }
    return 5;
  }
  // Earth Similarity Index aus Radius und Einstrahlung (Schulze-Makuch et al. 2011).
  function esi(radiusE, flux) {
    if (radiusE === null || flux === null) return null;
    const a = (flux - 1) / (flux + 1), b = (radiusE - 1) / (radiusE + 1);
    return 1 - Math.sqrt(0.5 * (a * a + b * b));
  }

  // Sonnensystem: Masse (Erdmassen), Umlaufzeit (Tage), Radius (Erdradien),
  // Einstrahlung relativ zur Erde.
  // Masse und Radius relativ zur Erde, Umlaufzeit in Tagen, Bahnabstand a in
  // Astronomischen Einheiten; Werte nach dem NASA Planetary Fact Sheet
  // (https://nssdc.gsfc.nasa.gov/planetary/factsheet/). s: Licht von der Sonne
  // relativ zur Erde, aus dem Abstand berechnet. Reihenfolge von innen nach außen.
  const SOLAR = [
    { key: 'mercury', m: 0.0553, p: 88.0, r: 0.383, a: 0.387 },
    { key: 'venus', m: 0.815, p: 224.7, r: 0.949, a: 0.723 },
    { key: 'earth', m: 1, p: 365.2, r: 1, a: 1 },
    { key: 'mars', m: 0.107, p: 687.0, r: 0.532, a: 1.524 },
    { key: 'jupiter', m: 317.8, p: 4331, r: 11.21, a: 5.204 },
    { key: 'saturn', m: 95.2, p: 10747, r: 9.45, a: 9.572 },
    { key: 'uranus', m: 14.5, p: 30589, r: 4.01, a: 19.165 },
    { key: 'neptune', m: 17.1, p: 59800, r: 3.88, a: 30.18 },
  ];
  SOLAR.forEach((s) => { s.s = 1 / (s.a * s.a); });
  // Typ, habitable Zone und Erdähnlichkeit nach denselben Regeln wie bei den
  // Exoplaneten; story: Bericht aus discoveries.js (data-solar), falls vorhanden.
  SOLAR.forEach((s) => {
    s.ti = classifyType(s.m, s.r, true);
    s.hz = hzClass(s.s, SUN_TEFF);
    s.esi = esi(s.r, s.s);
    s.story = null;
    s.period = s.p; s.plotRadius = s.r; s.isSolar = true;   // dieselben Namen wie bei den Exoplaneten
  });

  // ------------------------------------------------------ Planetensysteme
  // Habitable Zone eines Sterns als Bahnabstand a (AE) und Umlaufzeit p
  // (Tage): o0/o1 die großzügigen, c0/c1 die vorsichtigen Grenzen, jeweils
  // innen/außen. Leuchtkraft aus Radius und Temperatur des Sterns.
  function systemHz(teff, starRadius, starMass) {
    if (!teff || !starRadius || !starMass || teff < 2300 || teff > 7600) return null;
    const lum = starRadius * starRadius * Math.pow(teff / SUN_TEFF, 4);
    const at = (c) => {
      const a = Math.sqrt(lum / hzLimit(c, teff));
      return { a: a, p: DAYS_PER_YEAR * Math.sqrt(a * a * a / starMass) };
    };
    return { o0: at(HZ.recentVenus), c0: at(HZ.runaway), c1: at(HZ.maxGreen), o1: at(HZ.earlyMars) };
  }

  // Titius-Bode-Reihe nach Lara, Cordero-Tercero & Allen 2020 (PASJ 72, 24;
  // arXiv:2003.05121): Umlaufzeit des n-ten Planeten p_n = p0·e^(b·n), der
  // innerste hat n = 1. Passt die Reihe nicht (R² unter 0,992, der Wert der
  // klassischen Regel im Sonnensystem), werden zwischen den Planeten freie
  // Plätze eingefügt, erst einer, dann zwei usw.; es gilt die Anpassung mit
  // den wenigsten freien Plätzen. Ein freier Platz ist ein Ergebnis der
  // Rechnung, kein Fund; die Texte behaupten nicht, dass dort etwas kreist. Die
  // Arbeit wendet das
  // auf Systeme ab vier Planeten an und findet dort höchstens vier freie
  // Plätze; mehr werden hier nicht versucht. Über den äußersten Planeten
  // hinaus wird (wie in Abschnitt 4 der Arbeit) nichts vorhergesagt.
  // Geprüft an Tabelle 1 der Arbeit: Kepler-90 mit acht Planeten ergibt
  // p0 = 4,0530, b = 0,4387 und freie Plätze bei n = 4 und 5.
  const TB_MIN_PLANETS = 4, TB_R2 = 0.992, TB_MAX_GAPS = 4;
  function tbFit(periods) {
    const p = periods.slice().sort((a, b) => a - b), count = p.length;
    if (count < TB_MIN_PLANETS) return null;
    const ys = p.map(Math.log);
    const regress = (ns) => {   // ln p = ln p0 + b·n
      let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
      for (let i = 0; i < count; i++) { sx += ns[i]; sy += ys[i]; sxx += ns[i] * ns[i]; sxy += ns[i] * ys[i]; syy += ys[i] * ys[i]; }
      const dx = count * sxx - sx * sx, dy = count * syy - sy * sy, c = count * sxy - sx * sy;
      const b = c / dx;
      return { p0: Math.exp((sy - b * sx) / count), b: b, r2: dy > 0 ? c * c / (dx * dy) : 0, ns: ns };
    };
    // Alle Arten, k freie Plätze auf die Zwischenräume zu verteilen.
    function spread(k, slots) {
      if (slots === 1) return [[k]];
      const out = [];
      for (let i = 0; i <= k; i++) for (const rest of spread(k - i, slots - 1)) out.push([i].concat(rest));
      return out;
    }
    for (let k = 0; k <= TB_MAX_GAPS; k++) {
      let best = null;
      for (const free of spread(k, count - 1)) {
        const ns = [1];
        for (let i = 1; i < count; i++) ns.push(ns[i - 1] + 1 + free[i - 1]);
        const f = regress(ns);
        if (f.r2 >= TB_R2 && (!best || f.r2 > best.r2)) best = f;
      }
      if (best) {
        const taken = new Set(best.ns);
        best.gaps = [];
        for (let n = 2; n < best.ns[count - 1]; n++) if (!taken.has(n)) best.gaps.push({ n: n, period: best.p0 * Math.exp(best.b * n) });
        return best;
      }
    }
    return null;
  }
  // Ein System: name, planets (von innen nach außen), Angaben zum Stern, hz
  // (siehe systemHz), fit (tbFit: null = keine Reihe gefunden, undefined = zu
  // wenige Planeten), row (Zeile in der Ansicht "Planetensysteme" oder -1).
  const SUN = { name: '', solar: true, planets: SOLAR, teff: SUN_TEFF, starR: 1, starM: 1, sp: 'G2V', distLy: null, row: 0 };
  SUN.hz = systemHz(SUN.teff, SUN.starR, SUN.starM);
  SUN.fit = tbFit(SOLAR.map((s) => s.p));

  // ================================================================ Texte
  const TEXT = {
    de: {
      locale: 'de-DE', title: 'Atlas der Exoplaneten',
      subtitle: (shown, total, all) => (all ? total + ' Planeten fremder Sterne auf einen Blick' : shown + ' von ' + total + ' Planeten'),
      presets: { all: 'Alle Welten', earth: 'Erdähnliche Gesteinsplaneten', news: 'In den Nachrichten',
        extreme: 'Extreme Welten', imaged: 'Direkt abgebildet' },
      presetHint: {
        all: 'Alle Planeten des Katalogs, für die Masse oder Radius und die Umlaufzeit bekannt sind.',
        earth: 'Gesteinsplaneten (Radius unter 1,6 Erdradien) in der habitablen Zone ihres Sterns.',
        news: 'Nur Planeten, zu denen es hier einen Bericht gibt.',
        extreme: 'Berichte über Metallregen, Gluthitze, verdampfende Planeten und andere Extreme.',
        imaged: 'Planeten, die auf einem Foto zu sehen sind, mit dem Bild im Bericht.',
      },
      search: 'Planet suchen …', noMatch: 'Kein Planet gefunden',
      fullscreen: 'Vollbild (F11)', exitFullscreen: 'Vollbild beenden (Esc)', language: 'Sprache',
      fullscreenBlocked: 'Vollbild lässt sich hier nicht einschalten. Öffne die Seite direkt in einem Browserfenster oder drücke F11.',
      view: 'Ansicht', views: { mp: 'Masse · Umlaufzeit', rs: 'Größe · Licht vom Stern', mr: 'Masse · Größe', sys: 'Planetensysteme' },
      viewHints: { mp: 'Wie schwer die Planeten sind und wie lange ein Umlauf dauert', rs: 'Wie groß die Planeten sind und wie viel Licht sie bekommen (habitable Zone)',
        mr: 'Woraus die Planeten bestehen: Masse, Größe und Dichte',
        sys: 'Sterne mit vielen Planeten: je Zeile ein System, von innen nach außen' },
      sysGroup: 'Planeten je System', sysMin: { 4: 'ab 4', 5: 'ab 5', 6: 'ab 6' },
      gaps: 'Freie Plätze der Reihe zeigen',
      gapsHint: 'Gestrichelte Ringe: Plätze, die in der Titius-Bode-Reihe des Systems unbesetzt bleiben. Ein Ergebnis der Rechnung, kein Fund.',
      multiOnly: 'Nur Sterne mit mehreren Planeten',
      solarSystem: 'Sonnensystem', systemTitle: 'Planetensystem', systemOf: (i, n) => 'System ' + i + ' von ' + n,
      sysPlanets: (n) => n + ' bekannte Planeten',
      sysLink: (name, n) => 'System ' + name + ': ' + n + ' bekannte Planeten',
      sysStrip: (name) => name + ', von innen nach außen', sysStar: 'Stern: das ganze System zeigen',
      sysLegend: { star: 'Stern', hz: 'habitable Zone', gap: 'freier Platz der Reihe' },
      sysFacts: { starMass: 'Masse des Sterns', starRadius: 'Radius des Sterns', hzRange: 'Habitable Zone', inHz: 'Planeten in der Zone', none: 'keiner' },
      hzRangeNote: 'Abstand vom Stern, großzügige Grenzen',
      sunMasses: ' Sonnenmassen', sunRadii: ' Sonnenradien', range: (a, b) => a + ' bis ' + b,
      sysList: 'Planeten von innen nach außen', sysSearch: (n) => 'System, ' + n + ' Planeten',
      clickSystem: 'Klicken für das System',
      gapTitle: 'Freier Platz der Reihe', gapAt: (period) => 'Umlaufzeit etwa ' + period, gapNote: 'aus der Titius-Bode-Reihe berechnet, kein Fund',
      tb: {
        title: 'Regelmäßige Abstände (Titius-Bode-Regel)',
        few: 'Ob die Umlaufzeiten einer festen Regel folgen, lässt sich erst ab vier bekannten Planeten prüfen.',
        fit: (factor, r2) => 'Von Planet zu Planet wächst die Umlaufzeit im Mittel auf das ' + factor + '-Fache (Güte der Anpassung: R² = ' + r2 + ').',
        full: 'Die Reihe geht auf, ohne dass ein Platz frei bleibt.',
        gaps: (n, list) => (n === 1 ? 'Damit die Reihe aufgeht, bleibt ein Platz frei' : 'Damit die Reihe aufgeht, bleiben ' + n + ' Plätze frei') +
          ' (Umlaufzeit etwa ' + list + '). Diese Plätze ergeben sich allein aus der Rechnung; ob dort etwas kreist, ist nicht bekannt.',
        solar: 'Im Sonnensystem liegt dort, zwischen Mars und Jupiter, der Asteroidengürtel mit dem Zwergplaneten Ceres (Umlaufzeit 4,6 Jahre).',
        none: 'Die Umlaufzeiten folgen keiner solchen Reihe, auch nicht mit bis zu vier freien Plätzen.',
        source: 'Verfahren: ', sourceAfter: ', hier auf den aktuellen Katalog angewandt. Die Arbeit nennt für ihre Vorhersagen eine Trefferquote von 78 %. Eine unabhängige Suche in den Kepler-Daten nach 97 Planeten, die eine ähnliche Arbeit vorhergesagt hatte, fand fünf Kandidaten (',
        sourceEnd: '). Eine physikalische Begründung der Regel fehlt.',
        and: ' und ',
        dev: (name, pct) => 'Am weitesten neben der Reihe liegt ' + name + ' (' + pct + ').',
        chartTop: 'Umlaufzeit in Tagen', chartBottom: 'Abweichung von der Reihe', chartX: 'Platz',
        chartLabel: 'Diagramm: Umlaufzeiten der Planeten und die Titius-Bode-Reihe',
        chartNote: 'Oben die Reihe als Gerade, unten der Abstand jedes Planeten von ihr. Im grauen Band läge auch ein Planet an beliebiger Stelle (bis zum halben Weg zum Nachbarplatz): Je näher die Punkte an der Nulllinie, desto besser trägt die Reihe.',
        pointTitle: (name, period, pct) => name + ': ' + period + ', ' + pct + ' neben der Reihe',
      },
      density: { water: 'Wasser', earth: 'Erde' },
      colorBy: 'Farbe', colors: { type: 'Typ', method: 'Methode', star: 'Stern' },
      typeGroup: 'Planetentyp', methodGroup: 'Entdeckungsmethode', hzGroup: 'Habitable Zone',
      distGroup: 'Entfernung', dataGroup: 'Anzeige', moreGroup: 'Weitere Filter', moreActive: 'geändert',
      types: { rocky: 'Gesteinsplanet', mini: 'Mini-Neptun', neptune: 'Neptunartig', giant: 'Gasriese', bd: 'Brauner Zwerg' },
      typeHint: { rocky: 'Radius unter 1,6 Erdradien', mini: '1,6 bis 3,5 Erdradien', neptune: '12 bis 60 Erdmassen',
        giant: '60 Erdmassen bis 13 Jupitermassen', bd: 'über 13 Jupitermassen' },
      methods: { rv: 'Radialgeschwindigkeit', tr: 'Transit', ti: 'Timing', im: 'Direkte Abbildung', ml: 'Microlensing', other: 'Andere' },
      hz: { all: 'Alle', opt: 'In der Zone', con: 'Streng' },
      hzHints: { all: 'Alle Planeten zeigen', opt: 'Nur Planeten, auf denen Wasser flüssig sein könnte (großzügige Grenzen)',
        con: 'Nur Planeten sicher innerhalb der Zone (vorsichtige Grenzen)' },
      dist: { all: 'Alle', d100: '≤ 100 Lj', d50: '≤ 50 Lj', d20: '≤ 20 Lj' },
      estMass: 'Geschätzte Werte zeigen', estPeriod: 'Berechnete Umlaufzeiten zeigen', storiesOnly: 'Nur Planeten mit Bericht',
      estMassHint: 'Planeten, deren Masse oder Größe nicht gemessen, sondern geschätzt ist (offene Ringe)',
      estimatedRadius: 'geschätzt aus der Masse',
      starCool: 'kühl', starHot: 'heiß', starUnknown: 'unbekannt',
      axisMass: 'Masse in Erdmassen', axisMassJ: 'Jupitermassen', axisPeriod: 'Umlaufzeit in Tagen',
      axisRadius: 'Radius in Erdradien', axisFlux: 'Licht vom Stern (Erde = 1)',
      year: ' Jahr', years: ' Jahre', hot: 'heißer', cold: 'kälter',
      hzBand: 'Habitable Zone (sonnenähnlicher Stern)',
      regions: { rockyWorlds: 'Gesteinswelten', gasGiants: 'Gasriesen: fast gleich groß', puffy: 'Aufgeblähte Planeten',
        hotJupiters: 'Heiße Jupiter', superEarths: 'Supererden und Mini-Neptune', wide: 'Riesen auf weiten Bahnen',
        coldGiants: 'Kalte Gasriesen', lava: 'Lavawelten', temperate: 'Gemäßigte Welten', ice: 'Eiswelten' },
      planets: { mercury: 'Merkur', venus: 'Venus', earth: 'Erde', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn',
        uranus: 'Uranus', neptune: 'Neptun' },
      solarNote: 'Planet unseres Sonnensystems', solarGroup: 'Unser Sonnensystem',
      solarOf: (i, n) => 'Planet ' + i + ' von ' + n + ' unseres Sonnensystems', sunDistance: 'Abstand zur Sonne',
      moons: 'Bekannte Monde', noMoons: 'keine', asOf: (when) => 'Stand: ' + when,
      timeline: 'Entdeckt bis', play: 'Zeitraffer', pause: 'Anhalten', stories: 'Berichte',
      timeToggle: 'Zeitleiste', timeShow: 'Zeitleiste und Zeitraffer einblenden', timeHide: 'Zeitleiste ausblenden',
      guideTitle: 'Tausende Welten auf einen Blick',
      guideAxes: { mp: 'Nach rechts werden die Planeten schwerer, nach oben dauert ein Umlauf länger.',
        rs: 'Nach rechts bekommen die Planeten weniger Licht von ihrem Stern, nach oben werden sie größer.',
        mr: 'Nach rechts werden die Planeten schwerer, nach oben größer. Die gestrichelten Linien verbinden Planeten gleicher Dichte; gezeigt sind nur Planeten, bei denen Masse und Größe gemessen sind.',
        sys: 'Jede Zeile ist ein Stern mit seinen bekannten Planeten: links die inneren, rechts die äußeren. Das grüne Band ist die habitable Zone, gestrichelte Ringe sind freie Plätze der Titius-Bode-Reihe.' },
      guide: 'Jeder Punkt ist ein Planet bei einem fremden Stern.',
      facts: { type: 'Typ', mass: 'Masse', radius: 'Radius', period: 'Umlaufzeit', axis: 'Abstand zum Stern',
        flux: 'Licht vom Stern', hz: 'Habitable Zone', esi: 'Erdähnlichkeit', star: 'Stern', dist: 'Entfernung',
        found: 'Entdeckt' },
      estimated: 'geschätzt aus dem Radius', computed: 'berechnet aus Bahnabstand und Sternmasse',
      estimatedShort: 'geschätzt', computedShort: 'berechnet',
      earthMasses: ' Erdmassen', jupiterMasses: ' Jupitermassen', earthRadii: ' Erdradien', jupiterRadii: ' Jupiterradien',
      one: { earthMasses: ' Erdmasse', jupiterMasses: ' Jupitermasse', earthRadii: ' Erdradius', jupiterRadii: ' Jupiterradius' },
      hours: ' Stunden', days: ' Tage', au: ' AE', ly: ' Lichtjahre', timesEarth: ' × Erde', kelvin: ' K',
      esiNote: 'Earth Similarity Index aus Radius und Einstrahlung; 1 = wie die Erde',
      hzClass: { unknown: 'nicht bestimmbar', none: 'nicht bestimmbar (Sterntemperatur außerhalb des Modells)',
        hot: 'nein, zu heiß', inner: 'am inneren Rand', yes: 'ja', outer: 'am äußeren Rand', cold: 'nein, zu kalt' },
      storyOf: (i, n) => 'Bericht ' + i + ' von ' + n, prev: 'Vorheriger (älterer) Bericht', next: 'Nächster (neuerer) Bericht',
      planetStories: 'Berichte zu diesem Planeten',
      storyPlanets: 'Im Diagramm', notInChart: 'nicht im Diagramm',
      allFacts: 'Alle Werte zeigen', showStory: (n) => (n === 1 ? 'Bericht zeigen' : n + ' Berichte zeigen'),
      sourcesN: (n) => n + ' Quellen anzeigen',
      loading: 'Bericht wird geladen …', loadError: 'Der Bericht konnte nicht geladen werden.',
      close: 'Schließen: zurück zur Übersicht (Esc)', factSheet: 'Steckbrief',
      resetShort: 'Alles zeigen', regionHint: 'Klicken, um in diese Region zu zoomen',
      clickStory: 'Klicken für Bericht und Steckbrief', clickFacts: 'Klicken für den Steckbrief',
      tileHint: (n) => n + ' Berichte, neueste zuerst',
      footData: 'Daten: ', footText: (date, n, est, comp) => ', Stand ' + date + '. ' + n + ' Planeten, davon ' + est +
        ' mit aus dem Radius geschätzter Masse und ' + comp + ' mit berechneter Umlaufzeit.',
      date: (iso) => iso.split('-').reverse().join('.'),
      hidden: 'Dieser Planet ist mit den aktuellen Filtern ausgeblendet.',
      showAll: 'Filter zurücksetzen', resetView: 'Zoom zurücksetzen: ganzes Diagramm zeigen (Doppelklick)',
      noData: 'Keine Daten gefunden: data.js fehlt. Bitte "node update-data.js" ausführen.',
    },
    en: {
      locale: 'en-US', title: 'Atlas of Exoplanets',
      subtitle: (shown, total, all) => (all ? total + ' planets of other stars at a glance' : shown + ' of ' + total + ' planets'),
      presets: { all: 'All worlds', earth: 'Earth-like rocky planets', news: 'In the news',
        extreme: 'Extreme worlds', imaged: 'Directly imaged' },
      presetHint: {
        all: 'All planets in the catalog with a known mass or radius and a known orbital period.',
        earth: 'Rocky planets (radius below 1.6 Earth radii) in the habitable zone of their star.',
        news: 'Only planets that have a story here.',
        extreme: 'Stories about metal rain, scorching heat, evaporating planets, and other extremes.',
        imaged: 'Planets that can be seen in a photograph, with the picture in the story.',
      },
      search: 'Search planet …', noMatch: 'No planet found',
      fullscreen: 'Full screen (F11)', exitFullscreen: 'Exit full screen (Esc)', language: 'Language',
      fullscreenBlocked: 'Full screen cannot be turned on here. Open the page directly in a browser window or press F11.',
      view: 'View', views: { mp: 'Mass · Orbital period', rs: 'Size · Starlight', mr: 'Mass · Size', sys: 'Planetary systems' },
      viewHints: { mp: 'How heavy the planets are and how long one orbit takes', rs: 'How large the planets are and how much light they receive (habitable zone)',
        mr: 'What the planets are made of: mass, size and density',
        sys: 'Stars with many planets: one system per row, from the inside out' },
      sysGroup: 'Planets per system', sysMin: { 4: '4+', 5: '5+', 6: '6+' },
      gaps: 'Show empty places of the sequence',
      gapsHint: 'Dashed rings: places that stay empty in the Titius-Bode sequence of the system. A result of the calculation, not a discovery.',
      multiOnly: 'Only stars with several planets',
      solarSystem: 'Solar System', systemTitle: 'Planetary system', systemOf: (i, n) => 'System ' + i + ' of ' + n,
      sysPlanets: (n) => n + ' known planets',
      sysLink: (name, n) => name + ' system: ' + n + ' known planets',
      sysStrip: (name) => name + ', from the inside out', sysStar: 'Star: show the whole system',
      sysLegend: { star: 'star', hz: 'habitable zone', gap: 'empty place in the sequence' },
      sysFacts: { starMass: 'Mass of the star', starRadius: 'Radius of the star', hzRange: 'Habitable zone', inHz: 'Planets in the zone', none: 'none' },
      hzRangeNote: 'Distance from the star, generous limits',
      sunMasses: ' solar masses', sunRadii: ' solar radii', range: (a, b) => a + ' to ' + b,
      sysList: 'Planets from the inside out', sysSearch: (n) => 'System, ' + n + ' planets',
      clickSystem: 'Click for the system',
      gapTitle: 'Empty place in the sequence', gapAt: (period) => 'orbital period about ' + period, gapNote: 'calculated from the Titius-Bode sequence, not a discovery',
      tb: {
        title: 'Regular spacing (Titius-Bode relation)',
        few: 'Whether the orbital periods follow a fixed rule can only be tested with at least four known planets.',
        fit: (factor, r2) => 'From one planet to the next, the orbital period grows by a factor of ' + factor + ' on average (goodness of fit: R² = ' + r2 + ').',
        full: 'The sequence works without leaving a place empty.',
        gaps: (n, list) => (n === 1 ? 'For the sequence to work, one place stays empty' : 'For the sequence to work, ' + n + ' places stay empty') +
          ' (orbital period about ' + list + '). These places follow from the calculation alone; whether anything orbits there is not known.',
        solar: 'In the Solar System, the asteroid belt with the dwarf planet Ceres (orbital period 4.6 years) lies there, between Mars and Jupiter.',
        none: 'The orbital periods do not follow such a sequence, not even with up to four empty places.',
        source: 'Method: ', sourceAfter: ', applied here to the current catalog. The paper reports a success rate of 78% for its predictions. An independent search of the Kepler data for 97 planets predicted by a similar study found five candidates (',
        sourceEnd: '). The relation has no physical explanation.',
        and: ' and ',
        dev: (name, pct) => 'Farthest from the sequence: ' + name + ' (' + pct + ').',
        chartTop: 'Orbital period in days', chartBottom: 'Deviation from the sequence', chartX: 'Place',
        chartLabel: 'Chart: orbital periods of the planets and the Titius-Bode sequence',
        chartNote: 'Top: the sequence as a straight line. Bottom: how far each planet lies from it. A planet at an arbitrary position would also fall inside the gray band (up to halfway to the neighboring place): the closer the dots are to the zero line, the better the sequence holds.',
        pointTitle: (name, period, pct) => name + ': ' + period + ', ' + pct + ' off the sequence',
      },
      density: { water: 'water', earth: 'Earth' },
      colorBy: 'Color', colors: { type: 'Type', method: 'Method', star: 'Star' },
      typeGroup: 'Planet type', methodGroup: 'Detection method', hzGroup: 'Habitable zone',
      distGroup: 'Distance', dataGroup: 'Display', moreGroup: 'More filters', moreActive: 'changed',
      types: { rocky: 'Rocky planet', mini: 'Mini-Neptune', neptune: 'Neptune-like', giant: 'Gas giant', bd: 'Brown dwarf' },
      typeHint: { rocky: 'radius below 1.6 Earth radii', mini: '1.6 to 3.5 Earth radii', neptune: '12 to 60 Earth masses',
        giant: '60 Earth masses to 13 Jupiter masses', bd: 'above 13 Jupiter masses' },
      methods: { rv: 'Radial velocity', tr: 'Transit', ti: 'Timing', im: 'Direct imaging', ml: 'Microlensing', other: 'Other' },
      hz: { all: 'All', opt: 'In the zone', con: 'Strict' },
      hzHints: { all: 'Show all planets', opt: 'Only planets where water could be liquid (generous limits)',
        con: 'Only planets safely inside the zone (cautious limits)' },
      dist: { all: 'All', d100: '≤ 100 ly', d50: '≤ 50 ly', d20: '≤ 20 ly' },
      estMass: 'Show estimated values', estPeriod: 'Show computed orbital periods', storiesOnly: 'Only planets with a story',
      estMassHint: 'Planets whose mass or size is not measured but estimated (open rings)',
      estimatedRadius: 'estimated from the mass',
      starCool: 'cool', starHot: 'hot', starUnknown: 'unknown',
      axisMass: 'Mass in Earth masses', axisMassJ: 'Jupiter masses', axisPeriod: 'Orbital period in days',
      axisRadius: 'Radius in Earth radii', axisFlux: 'Starlight received (Earth = 1)',
      year: ' year', years: ' years', hot: 'hotter', cold: 'colder',
      hzBand: 'Habitable zone (Sun-like star)',
      regions: { rockyWorlds: 'Rocky worlds', gasGiants: 'Gas giants: almost the same size', puffy: 'Puffed-up planets',
        hotJupiters: 'Hot Jupiters', superEarths: 'Super-Earths and mini-Neptunes', wide: 'Giants on wide orbits',
        coldGiants: 'Cold gas giants', lava: 'Lava worlds', temperate: 'Temperate worlds', ice: 'Ice worlds' },
      planets: { mercury: 'Mercury', venus: 'Venus', earth: 'Earth', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn',
        uranus: 'Uranus', neptune: 'Neptune' },
      solarNote: 'Planet of our Solar System', solarGroup: 'Our Solar System',
      solarOf: (i, n) => 'Planet ' + i + ' of ' + n + ' of our Solar System', sunDistance: 'Distance from the Sun',
      moons: 'Known moons', noMoons: 'none', asOf: (when) => 'As of: ' + when,
      timeline: 'Discovered by', play: 'Time lapse', pause: 'Pause', stories: 'Stories',
      timeToggle: 'Timeline', timeShow: 'Show timeline and time lapse', timeHide: 'Hide timeline',
      guideTitle: 'Thousands of worlds at a glance',
      guideAxes: { mp: 'Planets get heavier to the right; higher up, one orbit takes longer.',
        rs: 'To the right, planets receive less light from their star; higher up, they are larger.',
        mr: 'Planets get heavier to the right and larger toward the top. The dashed lines connect planets of equal density; only planets with a measured mass and size are shown.',
        sys: 'Each row is a star with its known planets: inner ones on the left, outer ones on the right. The green band is the habitable zone; dashed rings are empty places in the Titius-Bode sequence.' },
      guide: 'Every dot is a planet around another star.',
      facts: { type: 'Type', mass: 'Mass', radius: 'Radius', period: 'Orbital period', axis: 'Distance from star',
        flux: 'Starlight', hz: 'Habitable zone', esi: 'Earth similarity', star: 'Star', dist: 'Distance',
        found: 'Discovered' },
      estimated: 'estimated from the radius', computed: 'computed from orbital distance and stellar mass',
      estimatedShort: 'estimated', computedShort: 'computed',
      earthMasses: ' Earth masses', jupiterMasses: ' Jupiter masses', earthRadii: ' Earth radii', jupiterRadii: ' Jupiter radii',
      one: { earthMasses: ' Earth mass', jupiterMasses: ' Jupiter mass', earthRadii: ' Earth radius', jupiterRadii: ' Jupiter radius' },
      hours: ' hours', days: ' days', au: ' AU', ly: ' light-years', timesEarth: ' × Earth', kelvin: ' K',
      esiNote: 'Earth Similarity Index from radius and irradiation; 1 = like Earth',
      hzClass: { unknown: 'cannot be determined', none: 'cannot be determined (stellar temperature outside the model)',
        hot: 'no, too hot', inner: 'at the inner edge', yes: 'yes', outer: 'at the outer edge', cold: 'no, too cold' },
      storyOf: (i, n) => 'Story ' + i + ' of ' + n, prev: 'Previous (older) story', next: 'Next (newer) story',
      planetStories: 'Stories about this planet',
      storyPlanets: 'In the chart', notInChart: 'not in the chart',
      allFacts: 'Show all values', showStory: (n) => (n === 1 ? 'Show story' : 'Show ' + n + ' stories'),
      sourcesN: (n) => 'Show ' + n + ' sources',
      loading: 'Loading story …', loadError: 'The story could not be loaded.',
      close: 'Close: back to the overview (Esc)', factSheet: 'Fact sheet',
      resetShort: 'Show all', regionHint: 'Click to zoom into this region',
      clickStory: 'Click for story and fact sheet', clickFacts: 'Click for the fact sheet',
      tileHint: (n) => n + ' stories, newest first',
      footData: 'Data: ', footText: (date, n, est, comp) => ', as of ' + date + '. ' + n + ' planets, ' + est +
        ' of them with a mass estimated from the radius and ' + comp + ' with a computed orbital period.',
      date: (iso) => iso,
      hidden: 'This planet is hidden by the current filters.',
      showAll: 'Reset filters', resetView: 'Reset zoom: show the whole chart (double click)',
      noData: 'No data found: data.js is missing. Please run "node update-data.js".',
    },
  };

  // ======================================================== Konfiguration
  let config = {};
  function readConfig(root) {
    let fromAttr = {};
    const raw = root.getAttribute('data-atlas-config');
    if (raw) {
      try { fromAttr = JSON.parse(raw); } catch (e) { console.warn('Atlas: data-atlas-config ist kein gültiges JSON.'); }
    }
    return Object.assign({}, window.EXO_ATLAS_CONFIG || {}, fromAttr);
  }
  // Angaben dürfen je Sprache verschieden sein: "text" oder { de: …, en: … }.
  function localized(value) {
    return (value && typeof value === 'object') ? (value[lang] || value.de || '') : (value || '');
  }
  // Nur gewöhnliche Adressen zulassen (kein "javascript:" und Ähnliches).
  function safeUrl(value) {
    const url = String(localized(value)).trim();
    return /^(https?:|mailto:|\/|\.|#|\?)/i.test(url) || /^[\w-]+([/.?#]|$)/.test(url) ? url : '';
  }
  // Ordner, in dem atlas/ liegt; leer = neben der Seite.
  function assetBase() {
    const base = String(config.base || '');
    return base && !base.endsWith('/') ? base + '/' : base;
  }

  // ============================================================== Zustand
  let lang = 'de';
  let tx = TEXT.de;
  const state = {
    types: TYPES.map(() => true),
    methods: METHODS.map(() => true),
    hz: 'all',            // all | opt | con
    maxDist: null,        // Lichtjahre oder null
    estMass: true,        // Planeten mit geschätzter Masse zeigen
    estPeriod: true,      // Planeten mit berechneter Umlaufzeit zeigen
    storiesOnly: false,
    multiOnly: false,     // nur Sterne mit mindestens zwei bekannten Planeten
    tags: null,           // nur Berichte mit einem dieser Schlagwörter (oder null)
    yearMax: 0,
    colorBy: 'type',      // type | method | star
    view: 'mp',           // mp: Masse/Umlaufzeit, rs: Einstrahlung/Radius, mr: Masse/Radius, sys: Planetensysteme
    sysMin: 5,            // Ansicht "Planetensysteme": Systeme ab so vielen Planeten
    gaps: true,           // freie Plätze der Titius-Bode-Reihe zeigen
    preset: 'all',
  };
  const PRESETS = {
    all: {},
    earth: { types: [true, false, false, false, false], hz: 'opt', view: 'rs', focus: true },
    news: { storiesOnly: true },
    extreme: { storiesOnly: true, tags: ['metal-rain', 'ultra-hot', 'extreme', 'evaporating'] },
    imaged: { storiesOnly: true, tags: ['direct-image'] },
  };

  let points = [];          // alle Planeten
  let stories = [];         // Berichte, nach Datum sortiert
  let multiSystems = [];    // Systeme mit mindestens zwei Planeten, die größten zuerst
  let sysRows = [SUN];      // Zeilen der Ansicht "Planetensysteme", oben das Sonnensystem
  let byName = new Map();
  let minYear = 1988, maxYear = 2026;
  let counts = { total: 0, est: 0, comp: 0 };

  // ---------------------------------------------------------------- Zahlen
  function num(v, digits) { return v.toLocaleString(tx.locale, { maximumSignificantDigits: digits || 3 }); }
  function int(v) { return v.toLocaleString(tx.locale); }
  function pow10Label(e) {
    const v = Math.pow(10, e);
    if (e >= 9) return num(v / 1e9) + (lang === 'de' ? ' Mrd.' : ' billion');
    if (e >= 6) return num(v / 1e6) + (lang === 'de' ? ' Mio.' : ' million');
    return num(v, 1);
  }
  function periodShort(days) {   // ohne den Zusatz in Tagen
    return days < 1000 ? periodText(days) : num(days / DAYS_PER_YEAR) + tx.years;
  }
  function periodText(days) {
    if (days < 1) return num(days * 24) + tx.hours;
    if (days < 1000) return num(days) + tx.days;
    return num(days / DAYS_PER_YEAR) + tx.years + ' (' + num(days) + tx.days + ')';
  }
  function dateText(iso) {
    const parts = String(iso).split('-').map(Number);
    if (parts.length === 1) return String(parts[0]);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] || 1));
    const opt = parts.length === 2 ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
    return d.toLocaleDateString(tx.locale, opt);
  }
  function dateFraction(iso) {   // Jahr als Kommazahl
    const parts = String(iso).split('-').map(Number);
    return parts[0] + ((parts[1] || 7) - 1) / 12 + ((parts[2] || 15) - 1) / 365;
  }

  // ================================================================= Daten
  function starName(name) { return name.replace(/\s?[b-z]$/, ''); }
  // Namen für Planeten (Exoplanet oder Planet der Sonne) und Systeme.
  function bodyName(q) { return q.isSolar ? tx.planets[q.key] : q.name; }
  function shortName(q) { return q.isSolar ? '' : (q.name.slice(q.star.length).trim() || q.name); }
  function sysName(sys) { return sys.solar ? tx.solarSystem : sys.name; }
  function normName(name) { return name.toLowerCase().replace(/[\s'’()]/g, ''); }

  function buildPoints() {
    const data = window.EXOPLANET_DATA, extra = window.EXOPLANET_DATA_EXTRA || {};
    const list = [];
    function add(rows, listKind) {   // 0: gemessen, 1: Umlaufzeit berechnet, 2: Masse geschätzt
      for (const row of rows || []) {
        let kind = listKind;
        const radiusE = row[12] ? row[12] * RE_PER_RJ : null;
        let massE = row[1] ? row[1] * EARTH_PER_JUPITER : null;
        // Der Katalog führt bei manchen kleinen Planeten nur eine Obergrenze
        // als Masse (z. B. 35 Erdmassen für Kepler-62 f mit 1,4 Erdradien).
        // Ist die Masse für den Radius um ein Vielfaches zu groß, wird sie
        // wie eine fehlende Masse behandelt und aus dem Radius geschätzt.
        if (massE !== null && radiusE !== null && radiusE < 4 && massE > UPPER_LIMIT_FACTOR * massFromRadius(radiusE)) {
          massE = null; kind = 2;
        }
        if (massE === null) {
          if (radiusE === null || radiusE > MAX_EST_RADIUS) continue;
          massE = massFromRadius(radiusE);
        }
        const flux = relativeFlux(row[6], row[7], row[8], row[9], row[2]);
        // Für die Ansicht "Größe · Einstrahlung": fehlt der Radius, wird er
        // bei kleinen Planeten aus der Masse geschätzt.
        const estRadius = radiusE === null && massE <= MAX_EST_MASS;
        const plotRadius = estRadius ? radiusFromMass(massE) : radiusE;
        const p = {
          name: row[0], massE: massE, period: row[2], method: row[3], mi: classifyMethod(row[3]),
          year: typeof row[4] === 'number' ? row[4] : null, sp: row[5] || '', teff: row[6] || null,
          axis: row[9] || null, ecc: row[10] || null, distLy: row[11] ? row[11] * LY_PER_PC : null,
          starR: row[7] || null, starM: row[8] || null,
          radiusE: radiusE, plotRadius: plotRadius, estMass: kind === 2, estPeriod: kind === 1, estRadius: estRadius,
          flux: flux, hz: hzClass(flux, row[6]), esi: esi(plotRadius, flux),
          star: starName(row[0]), stories: [], a: 0, vis: false,
        };
        p.ti = classifyType(massE, radiusE, kind !== 2);
        p.pos = {
          mp: [log10(massE), log10(row[2])],
          rs: (plotRadius !== null && flux !== null) ? [-log10(flux), log10(plotRadius)] : null,
          // Masse gegen Größe: nur wo beides gemessen ist (Schätzwerte lägen
          // alle auf der Schätzkurve und würden eine Regel vortäuschen).
          mr: (kind !== 2 && radiusE !== null) ? [log10(massE), log10(radiusE)] : null,
          sys: null,   // Zeile in der Ansicht "Planetensysteme", siehe layoutSystems
        };
        list.push(p);
      }
    }
    add(data.planets, 0);
    add(extra.computed, 1);
    add(extra.radiusOnly, 2);
    counts = { total: list.length, est: list.filter((p) => p.estMass).length, comp: list.filter((p) => p.estPeriod).length };
    const years = list.filter((p) => p.year !== null).map((p) => p.year);
    minYear = Math.min.apply(null, years); maxYear = Math.max.apply(null, years);
    state.yearMax = maxYear;
    byName = new Map();
    list.forEach((p, i) => { p.id = i; byName.set(p.name, p); byName.set(normName(p.name), p); });
    // Geschwister: Planeten desselben Sterns.
    const systems = new Map();
    for (const p of list) (systems.get(p.star) || systems.set(p.star, []).get(p.star)).push(p);
    multiSystems = [];
    for (const entry of systems) {
      const members = entry[1];
      const planets = members.slice().sort((a, b) => a.period - b.period);
      const first = (key) => { const q = planets.find((x) => x[key]); return q ? q[key] : null; };
      const sys = { name: entry[0], solar: false, planets: planets, teff: first('teff'), starR: first('starR'), starM: first('starM'),
        sp: first('sp') || '', distLy: first('distLy'), row: -1 };
      sys.hz = systemHz(sys.teff, sys.starR, sys.starM);
      sys.fit = planets.length >= TB_MIN_PLANETS ? tbFit(planets.map((q) => q.period)) : undefined;
      for (const p of members) { p.system = members; p.sys = sys; }
      if (planets.length > 1) multiSystems.push(sys);
    }
    multiSystems.sort((a, b) => b.planets.length - a.planets.length || a.name.localeCompare(b.name, 'en', { numeric: true }));
    return list;
  }

  function buildStories() {
    const all = window.EXO_DISCOVERIES || [];
    SOLAR.forEach((s) => { s.story = null; });
    for (const entry of all) {
      const body = entry.solar && SOLAR.find((s) => s.key === entry.solar);
      if (body) {
        body.story = { id: entry.id, title: entry.title, img: entry.img || null, solar: entry.solar, date: null,
          moons: typeof entry.moons === 'number' ? entry.moons : null, moonsAsOf: entry.moonsAsOf || '',
          thumb: entry.thumb || '' };
      }
    }
    const raw = all.filter((entry) => !entry.solar);
    raw.sort((a, b) => dateFraction(a.date) - dateFraction(b.date));
    return raw.map((s, i) => {
      const story = { id: s.id, date: s.date, t: dateFraction(s.date), title: s.title, img: s.img || null,
        tags: s.tags || [], index: i, points: [], missing: [], main: [] };
      for (const entry of s.planets || []) {
        const p = byName.get(entry.n) || byName.get(normName(entry.n));
        if (!p) { story.missing.push(entry.n); continue; }
        story.points.push(p);
        if (entry.main) story.main.push(p);
        if (p.stories.indexOf(story) < 0) p.stories.push(story);
      }
      if (!story.main.length) story.main = story.points.slice(0, 1);
      return story;
    });
  }

  // ============================================================== Darstellung
  const dom = {};
  let W = 0, H = 0, dpr = 1;
  const M = { l: 70, r: 64, t: 40, b: 50 };   // Ränder der Zeichenfläche
  let plot = { l: 0, t: 0, w: 1, h: 1, r: 1, b: 1 };
  const home = { mp: null, rs: null, mr: null, sys: null };     // Startausschnitt je Ansicht
  const limits = { mp: null, rs: null, mr: null, sys: null };   // weiter hinaus lässt sich nicht zoomen
  let view = null;                            // aktueller Ausschnitt {x0,x1,y0,y1}
  let morph = null;                           // Übergang zwischen zwei Ansichten
  let viewTween = null, alphaTween = false;
  let staticDirty = true, overlayDirty = true, rafId = 0;
  let hover = null;        // {kind:'planet'|'solar'|'story', ...}
  let pinned = null;
  let shown = null;        // was das Infofeld zeigt
  let hlStory = null;      // Bericht, dessen Planeten hervorgehoben sind
  let playTimer = 0;
  let moreOpen = false;    // "Weitere Filter" aufgeklappt
  let timeOpen = false;    // Zeitleiste unter dem Diagramm aufgeklappt
  const sprites = {};      // Leuchtpunkte je Farbe

  function sprite(color) {
    if (sprites[color]) return sprites[color];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.25, color + 'aa');
    grad.addColorStop(0.6, color + '2a');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return (sprites[color] = c);
  }
  function teffColor(teff) {
    if (!teff) return UNKNOWN_COLOR;
    const t = clamp(teff, TEFF_STOPS[0][0], TEFF_STOPS[TEFF_STOPS.length - 1][0]);
    for (let i = 1; i < TEFF_STOPS.length; i++) {
      if (t <= TEFF_STOPS[i][0]) {
        const a = TEFF_STOPS[i - 1], b = TEFF_STOPS[i], f = (t - a[0]) / (b[0] - a[0]);
        const c = a[1].map((v, k) => Math.round(v + (b[1][k] - v) * f));
        return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
      }
    }
    return UNKNOWN_COLOR;
  }
  const teffPalette = [];
  function teffBucketColor(teff) {
    if (!teff) return UNKNOWN_COLOR;
    const lo = log10(TEFF_STOPS[0][0]), hi = log10(TEFF_STOPS[TEFF_STOPS.length - 1][0]);
    const i = clamp(Math.floor((log10(teff) - lo) / (hi - lo) * TEFF_BUCKETS), 0, TEFF_BUCKETS - 1);
    if (!teffPalette[i]) teffPalette[i] = teffColor(Math.pow(10, lo + (i + 0.5) / TEFF_BUCKETS * (hi - lo)));
    return teffPalette[i];
  }
  // Beruht die Lage des Punktes in der Ansicht auf einer Schätzung?
  function estimateIn(p, name) { return name === 'rs' ? p.estRadius : name === 'mr' ? false : p.estMass; }
  function isEstimate(p) { return estimateIn(p, state.view); }
  function pointColors(p) {   // [Kern, Leuchten]
    if (state.colorBy === 'method') return [METHODS[p.mi].glow, METHODS[p.mi].color];
    if (state.colorBy === 'star') { const c = teffBucketColor(p.teff); return [c, c]; }
    return [TYPES[p.ti].glow, TYPES[p.ti].color];
  }

  function computeHome() {
    function range(values, pad) {
      let lo = Infinity, hi = -Infinity;
      for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
      const d = (hi - lo) * pad;
      return [lo - d, hi + d];
    }
    const mx = range(points.map((p) => p.pos.mp[0]).concat(SOLAR.map((s) => log10(s.m))), 0.03);
    const my = range(points.map((p) => p.pos.mp[1]).concat(SOLAR.map((s) => log10(s.p))), 0.04);
    limits.mp = { x0: mx[0], x1: mx[1], y0: my[0], y1: my[1] };
    // Start: ohne die wenigen Begleiter auf extrem weiten Bahnen, die die
    // Achse sonst um mehrere Größenordnungen strecken würden.
    const py = points.map((p) => p.pos.mp[1]).sort((a, b) => a - b);
    home.mp = { x0: mx[0], x1: mx[1], y0: my[0], y1: Math.min(my[1], py[Math.floor(py.length * 0.992)] + 0.35) };
    const rsPts = points.filter((p) => p.pos.rs);
    // Einstrahlung: 99 % der Werte, damit einzelne Ausreißer die Achse nicht dehnen.
    const fx = rsPts.map((p) => p.pos.rs[0]).sort((a, b) => a - b);
    // Von sehr heiß bis etwas jenseits von Neptun; kältere Begleiter auf
    // weiten Bahnen erreicht man durch Hinauszoomen.
    const x0 = Math.min(fx[Math.floor(fx.length * 0.003)], -log10(8)), x1 = 3.15;
    const ry = range(rsPts.map((p) => p.pos.rs[1]).concat([log10(0.35)]), 0.04);
    home.rs = { x0: x0 - 0.15, x1: x1 + 0.15, y0: ry[0], y1: Math.min(ry[1], log10(30)) };
    limits.rs = { x0: Math.min(fx[0], home.rs.x0) - 0.1, x1: Math.max(fx[fx.length - 1], home.rs.x1) + 0.1, y0: ry[0], y1: ry[1] };
    // Masse gegen Größe.
    const mrPts = points.filter((p) => p.pos.mr);
    const qx = range(mrPts.map((p) => p.pos.mr[0]).concat(SOLAR.map((s) => log10(s.m))), 0.04);
    const qy = range(mrPts.map((p) => p.pos.mr[1]).concat(SOLAR.map((s) => log10(s.r))), 0.06);
    home.mr = { x0: qx[0], x1: qx[1], y0: qy[0], y1: Math.min(qy[1], log10(40)) };
    limits.mr = { x0: qx[0], x1: qx[1], y0: qy[0], y1: qy[1] };
  }

  // ---- Ansicht "Planetensysteme": je Zeile ein Stern, waagrecht die
  // Umlaufzeit. Die Namen stehen in einer festen Spalte am linken Rand, die
  // ein Stück in die Zeichenfläche ragt (sysBand: ihr rechter Rand).
  const SYS_MIN_ROWS = 12;   // so viele Zeilen hoch ist der Ausschnitt mindestens
  let sysKey = '';
  function sysBand() { return Math.max(plot.l, 134); }
  function rowHeight(v) { return plot.h / (v.y1 - v.y0); }
  // Legt fest, welche Systeme eine Zeile bekommen: alle mit mindestens
  // state.sysMin Planeten, von denen wenigstens einer zu den Filtern passt
  // (das Entdeckungsjahr zählt nicht, damit die Zeilen im Zeitraffer stehen
  // bleiben). Liefert true, wenn sich die Zeilen geändert haben.
  function layoutSystems(force) {
    const key = [state.types, state.methods, state.hz, state.maxDist, state.estMass, state.estPeriod, state.storiesOnly,
      state.multiOnly, state.tags, state.sysMin].join('|');
    const changed = key !== sysKey;
    if (changed) {
      sysKey = key;
      for (const s of sysRows) if (!s.solar) { s.row = -1; for (const q of s.planets) q.pos.sys = null; }
      sysRows = [SUN].concat(multiSystems.filter((s) => s.planets.length >= state.sysMin && s.planets.some((q) => filterOk(q, 'sys', true))));
      sysRows.forEach((s, i) => { s.row = i; if (!s.solar) for (const q of s.planets) q.pos.sys = [log10(q.period), -i]; });
    }
    if (changed || force) {
      let lo = Infinity, hi = -Infinity;
      for (const s of sysRows) for (const q of s.planets) { const lx = log10(q.period); if (lx < lo) lo = lx; if (lx > hi) hi = lx; }
      // Der innerste Planet steht knapp rechts der Namensspalte.
      const inner = sysBand() + 18 - plot.l, usable = Math.max(80, plot.w - 18 - inner);
      const span = (hi - lo) * plot.w / usable, x0 = lo - inner / plot.w * span;
      const box = { x0: x0, x1: x0 + span, y0: -Math.max(sysRows.length - 1, SYS_MIN_ROWS - 1) - 0.75, y1: 0.75 };
      home.sys = box; limits.sys = Object.assign({}, box);
    }
    return changed;
  }
  // Kleinster Ausschnitt beim Hineinzoomen (waagrecht bzw. senkrecht).
  function minSpan(axis) {
    if (state.view !== 'sys' || axis === 'x') return 0.08;
    return Math.min(6, limits.sys.y1 - limits.sys.y0);
  }
  // Größter Punktradius: in der Ansicht "Planetensysteme" durch die Zeilenhöhe begrenzt.
  function sizeCap() {
    const of = (name, v) => (name === 'sys' ? Math.max(1.3, rowHeight(v) * 0.44) : 60);
    if (!morph) return of(state.view, view);
    const a = of(morph.from, morph.fromView), b = of(morph.to, morph.toView);
    return a + (b - a) * morph.e;
  }
  function baseR(p) { return Math.min(TYPES[p.ti].size * zoomScale(), sizeCap()); }

  function resize() {
    const box = dom.chart.getBoundingClientRect();
    W = Math.max(320, Math.round(box.width)); H = Math.max(240, Math.round(box.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [dom.base, dom.overlay]) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = W + 'px'; c.style.height = H + 'px';
    }
    const narrow = W < 620;
    M.l = narrow ? 48 : 70; M.r = narrow ? 14 : 96;
    const wasHome = state.view === 'sys' && view && home.sys && isHomeView();
    plot = { l: M.l, t: M.t, w: W - M.l - M.r, h: H - M.t - M.b, r: W - M.r, b: H - M.b };
    // Der Ausschnitt der Systemansicht hängt von der Breite ab (Namensspalte).
    if (points.length) {
      layoutSystems(true);
      if (morph && morph.to === 'sys') morph.toView = Object.assign({}, home.sys);
      else if (wasHome) view = Object.assign({}, home.sys);
    }
    staticDirty = overlayDirty = true;
    schedule();
  }

  const sxOf = (v, lx) => plot.l + (lx - v.x0) / (v.x1 - v.x0) * plot.w;
  const syOf = (v, ly) => plot.b - (ly - v.y0) / (v.y1 - v.y0) * plot.h;

  // Bildschirmposition eines Punktes; während eines Ansichtswechsels gleitet
  // er von der alten zur neuen Position. fade: Sichtbarkeit 0..1.
  function place(p) {
    if (!morph) {
      const q = p.pos[state.view];
      if (!q) { p.fade = 0; return; }
      p.sx = sxOf(view, q[0]); p.sy = syOf(view, q[1]); p.fade = 1;
      return;
    }
    const a = p.pos[morph.from], b = p.pos[morph.to], e = morph.e;
    if (a && b) {
      const ax = sxOf(morph.fromView, a[0]), ay = syOf(morph.fromView, a[1]);
      const bx = sxOf(morph.toView, b[0]), by = syOf(morph.toView, b[1]);
      p.sx = ax + (bx - ax) * e; p.sy = ay + (by - ay) * e; p.fade = 1;
    } else if (a) {
      p.sx = sxOf(morph.fromView, a[0]); p.sy = syOf(morph.fromView, a[1]); p.fade = Math.max(0, 1 - e * 2.5);
    } else if (b) {
      p.sx = sxOf(morph.toView, b[0]); p.sy = syOf(morph.toView, b[1]); p.fade = Math.max(0, e * 2.5 - 1.5);
    } else { p.fade = 0; }
  }

  let sparse = 1;          // größer zeichnen, wenn nur wenige Planeten zu sehen sind
  let visibleCount = 0;
  // Maßstab der Punkte: 1 bei ganzer Ansicht, größer beim Hineinzoomen. In der
  // Ansicht "Planetensysteme" richtet er sich nach der Zeilenhöhe.
  function scaleOf(name, v) {
    if (name === 'sys') return clamp(rowHeight(v) / 7, 0.95, 3.4);
    const h = home[name];
    return clamp(Math.pow((h.x1 - h.x0) / (v.x1 - v.x0), 0.35), 1, 3.2) * sparse;
  }
  function zoomScale() {
    if (!morph) return scaleOf(state.view, view);
    const a = scaleOf(morph.from, morph.fromView), b = scaleOf(morph.to, morph.toView);
    return a + (b - a) * morph.e;
  }

  // --------------------------------------------------------------- Achsen
  const AXES = {
    mp: {
      xTitle: () => tx.axisMass, yTitle: () => tx.axisPeriod,
      xLabel: (e) => pow10Label(e), yLabel: (e) => pow10Label(e),
    },
    rs: {
      xTitle: () => tx.axisFlux, yTitle: () => tx.axisRadius,
      xLabel: (e) => pow10Label(-e), yLabel: (e) => pow10Label(e),
    },
    mr: {
      xTitle: () => tx.axisMass, yTitle: () => tx.axisRadius,
      xLabel: (e) => pow10Label(e), yLabel: (e) => pow10Label(e),
    },
    // Planetensysteme: senkrecht stehen die Zeilen, keine Skala.
    sys: {
      xTitle: () => tx.axisPeriod, yTitle: () => '',
      xLabel: (e) => pow10Label(e), yLabel: () => '',
    },
  };
  // Linien gleicher mittlerer Dichte in der Ansicht Masse/Größe (g/cm³). Auf
  // einer Linie gilt Masse / Radius³ = Dichte / Erddichte.
  const EARTH_DENSITY = 5.51;
  const DENSITY_LINES = [{ rho: 0.3 }, { rho: 1, key: 'water' }, { rho: 3 }, { rho: 5.51, key: 'earth' }, { rho: 10 }];

  function drawAxes(g, name, v, alpha) {
    if (alpha <= 0.01) return;
    const ax = AXES[name];
    g.save();
    g.globalAlpha = alpha;
    g.lineWidth = 1;
    const isSys = name === 'sys';
    const fineX = (v.x1 - v.x0) < 2.4, fineY = !isSys && (v.y1 - v.y0) < 2.4;
    const xMin = isSys ? sysBand() + 12 : -Infinity;   // unter der Namensspalte keine Beschriftung
    // Gitter an jeder Dekade, beim Hineinzoomen zusätzlich bei 2 und 5.
    g.beginPath();
    const xs = [], ys = [];
    for (let e = Math.ceil(v.x0); e <= Math.floor(v.x1); e++) xs.push(e);
    if (!isSys) for (let e = Math.ceil(v.y0); e <= Math.floor(v.y1); e++) ys.push(e);
    for (const e of xs) { const x = Math.round(sxOf(v, e)) + 0.5; g.moveTo(x, plot.t); g.lineTo(x, plot.b); }
    for (const e of ys) { const y = Math.round(syOf(v, e)) + 0.5; g.moveTo(plot.l, y); g.lineTo(plot.r, y); }
    g.strokeStyle = 'rgba(150,170,255,0.13)';
    g.stroke();
    const minor = [];
    if (fineX || fineY) {
      g.beginPath();
      if (fineX) for (let e = Math.floor(v.x0); e <= Math.floor(v.x1); e++) for (const k of [2, 5]) {
        const lx = e + log10(k); if (lx < v.x0 || lx > v.x1) continue;
        const x = Math.round(sxOf(v, lx)) + 0.5; g.moveTo(x, plot.t); g.lineTo(x, plot.b);
        minor.push(['x', lx, name === 'rs' ? num(Math.pow(10, -lx), 2) : num(Math.pow(10, lx), 2)]);
      }
      if (fineY) for (let e = Math.floor(v.y0); e <= Math.floor(v.y1); e++) for (const k of [2, 5]) {
        const ly = e + log10(k); if (ly < v.y0 || ly > v.y1) continue;
        const y = Math.round(syOf(v, ly)) + 0.5; g.moveTo(plot.l, y); g.lineTo(plot.r, y);
        minor.push(['y', ly, num(Math.pow(10, ly), 2)]);
      }
      g.strokeStyle = 'rgba(150,170,255,0.06)';
      g.stroke();
    }
    g.fillStyle = '#8f98bd';
    g.font = '12.5px ' + FONT_UI;
    g.textAlign = 'center'; g.textBaseline = 'top';
    // Platz für den Knopf "Alles zeigen" unten rechts, solange er zu sehen ist.
    const reserved = dom.homeBtn.hidden ? 0 : dom.homeBtn.offsetWidth + 22;
    const clearOfButton = (x) => x > xMin && (x < W - reserved - 18 || (M.r >= 40 && reserved < M.r));
    for (const e of xs) if (clearOfButton(sxOf(v, e))) g.fillText(ax.xLabel(e), sxOf(v, e), plot.b + 8);
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const e of ys) g.fillText(ax.yLabel(e), plot.l - 9, syOf(v, e));
    g.fillStyle = '#6f789c';
    g.font = '11.5px ' + FONT_UI;
    for (const m of minor) {
      if (m[0] === 'x') { g.textAlign = 'center'; g.textBaseline = 'top'; if (clearOfButton(sxOf(v, m[1]))) g.fillText(m[2], sxOf(v, m[1]), plot.b + 8); }
      else { g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(m[2], plot.l - 9, syOf(v, m[1])); }
    }
    // Achsentitel
    g.fillStyle = '#c3c9e6';
    g.font = '600 13px ' + FONT_UI;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText(ax.xTitle(), plot.l + plot.w / 2, H - 9);
    if (!isSys) {
      g.save();
      g.translate(15, plot.t + plot.h / 2); g.rotate(-Math.PI / 2);
      g.fillText(ax.yTitle(), 0, 0);
      g.restore();
    }

    g.font = '11.5px ' + FONT_UI;
    g.fillStyle = '#7f88ad';
    if (name === 'mp' || name === 'mr') {
      // Zweite Skala oben: Jupitermassen.
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      for (let e = -5; e <= 3; e++) {
        const x = sxOf(v, e + log10(EARTH_PER_JUPITER));
        if (x < plot.l + 112 || x > plot.r - 8) continue;   // links steht "Jupitermassen"
        g.fillRect(Math.round(x), plot.t - 4, 1, 4);
        g.fillText(pow10Label(e), x, plot.t - 8);
      }
      g.textAlign = 'left';
      g.fillText(tx.axisMassJ, plot.l, plot.t - 8);
    }
    if (name === 'mr') {
      // Linien gleicher mittlerer Dichte, entlang der Linie beschriftet.
      g.save();
      g.beginPath(); g.rect(plot.l, plot.t, plot.w, plot.h); g.clip();
      g.font = '12px ' + FONT_UI;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      for (const line of DENSITY_LINES) {
        const off = log10(line.rho / EARTH_DENSITY);
        const yAt = (lx) => (lx - off) / 3;
        const ax = sxOf(v, v.x0), ay = syOf(v, yAt(v.x0)), bx = sxOf(v, v.x1), by = syOf(v, yAt(v.x1));
        g.strokeStyle = line.key ? 'rgba(220,228,255,0.42)' : 'rgba(180,195,255,0.24)';
        g.lineWidth = 1; g.setLineDash([5, 5]);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        g.setLineDash([]);
        // Beschriftung dort, wo die Linie den unteren bzw. linken Rand verlässt.
        const lxIn = Math.max(v.x0, 3 * v.y0 + off) + (v.x1 - v.x0) * 0.035;
        const px = sxOf(v, lxIn), py = syOf(v, yAt(lxIn));
        const text = num(line.rho, 2) + ' g/cm³' + (line.key ? ' (' + tx.density[line.key] + ')' : '');
        g.save();
        g.translate(px, py); g.rotate(Math.atan2(by - ay, bx - ax));
        g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = 'rgba(6,9,23,0.8)';
        g.strokeText(text, 0, -5);
        g.fillStyle = line.key ? '#c9d2f2' : '#8f98bd';
        g.fillText(text, 0, -5);
        g.restore();
      }
      g.restore();
    } else if (isSys) {
      // Zweite Skala oben: Jahre.
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      for (let e = -1; e <= 6; e++) {
        const x = sxOf(v, e + log10(DAYS_PER_YEAR));
        if (x < xMin + 20 || x > plot.r - 8) continue;
        g.fillRect(Math.round(x), plot.t - 4, 1, 4);
        g.fillText(pow10Label(e) + (e === 0 ? tx.year : tx.years), x, plot.t - 8);
      }
    } else if (name === 'mp') {
      // Zweite Skala rechts: Jahre.
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      for (let e = -2; e <= 8; e++) {
        const y = syOf(v, e + log10(DAYS_PER_YEAR));
        if (y < plot.t + 8 || y > plot.b - 8 || M.r < 40) continue;
        g.fillRect(plot.r, Math.round(y), 4, 1);
        g.fillText(pow10Label(e) + (e === 0 ? tx.year : tx.years), plot.r + 8, y);
      }
    } else if (name === 'rs') {
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left'; g.fillText('← ' + tx.hot, plot.l, plot.t - 8);
      g.textAlign = 'right'; g.fillText(tx.cold + ' →', plot.r, plot.t - 8);
      // Habitable Zone eines sonnenähnlichen Sterns als Band.
      const xa = sxOf(v, -log10(HZ.recentVenus[0])), xb = sxOf(v, -log10(HZ.earlyMars[0]));
      const xc = sxOf(v, -log10(HZ.runaway[0])), xd = sxOf(v, -log10(HZ.maxGreen[0]));
      g.save();
      g.beginPath(); g.rect(plot.l, plot.t, plot.w, plot.h); g.clip();
      g.fillStyle = 'rgba(63,224,166,0.07)'; g.fillRect(xa, plot.t, xb - xa, plot.h);
      g.fillStyle = 'rgba(63,224,166,0.08)'; g.fillRect(xc, plot.t, xd - xc, plot.h);
      g.fillStyle = 'rgba(120,235,190,0.75)';
      g.font = '500 13px ' + FONT_DISPLAY;
      g.textAlign = 'center';
      if (xb - xa > 150) g.fillText(tx.hzBand, (xa + xb) / 2, plot.t + 18);
      g.restore();
    }
    g.restore();
  }

  // ---- Ansicht "Planetensysteme": Zeilen. layer 'under' liegt unter den
  // Punkten (Leitlinien, habitable Zone, freie Plätze der Reihe), 'over' darüber
  // (die feste Namensspalte am linken Rand mit dem Stern jeder Zeile).
  function fitText(g, text, width) {
    if (g.measureText(text).width <= width) return text;
    let t = text;
    while (t.length > 3 && g.measureText(t + '…').width > width) t = t.slice(0, -1);
    return t + '…';
  }
  function drawSystems(g, v, alpha, layer) {
    if (alpha <= 0.01) return;
    const rowH = rowHeight(v), band = sysBand();
    const live = !morph;
    g.save();
    g.globalAlpha = alpha;
    if (layer === 'under') {
      const showGaps = state.gaps && state.yearMax >= maxYear;
      const hzH = clamp(rowH * 0.62, 2.5, 18), gapR = clamp(rowH * 0.3, 2.2, 5.5);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(150,170,255,0.08)';
      g.beginPath();
      for (const s of sysRows) {
        s.sy = syOf(v, -s.row);
        s.on = s.sy > plot.t - rowH && s.sy < plot.b + rowH;
        if (s.on && rowH >= 5) { const y = Math.round(s.sy) + 0.5; g.moveTo(band, y); g.lineTo(plot.r, y); }
      }
      g.stroke();
      for (const s of sysRows) {
        if (s.fit) for (const gap of s.fit.gaps) gap.sx = NaN;
        if (!s.on) continue;
        if (s.hz) {
          // Habitable Zone: außen die großzügigen, innen die vorsichtigen Grenzen.
          const xa = sxOf(v, log10(s.hz.o0.p)), xb = sxOf(v, log10(s.hz.o1.p));
          const xc = sxOf(v, log10(s.hz.c0.p)), xd = sxOf(v, log10(s.hz.c1.p));
          g.fillStyle = 'rgba(63,224,166,0.15)'; g.fillRect(xa, s.sy - hzH / 2, xb - xa, hzH);
          g.fillStyle = 'rgba(63,224,166,0.18)'; g.fillRect(xc, s.sy - hzH / 2, xd - xc, hzH);
        }
        if (showGaps && s.fit) {
          g.strokeStyle = 'rgba(232,236,255,0.9)'; g.lineWidth = 1.1;
          g.setLineDash([2.2, 2.2]);
          for (const gap of s.fit.gaps) {
            const x = sxOf(v, log10(gap.period));
            g.beginPath(); g.arc(x, s.sy, gapR, 0, 6.2832); g.stroke();
            if (live) { gap.sx = x; gap.sy = s.sy; }
          }
          g.setLineDash([]);
        }
      }
    } else {
      // Namensspalte: verdeckt, was unter sie geschoben wird.
      g.fillStyle = 'rgba(9,14,36,0.95)';
      g.fillRect(plot.l, plot.t, band - plot.l, plot.h);
      g.fillStyle = 'rgba(150,170,255,0.22)';
      g.fillRect(Math.round(band), plot.t, 1, plot.h);
      g.beginPath(); g.rect(0, plot.t, band, plot.h); g.clip();
      const size = rowH >= 15 ? 12 : rowH >= 11.5 ? 11 : 0;
      g.textAlign = 'right'; g.textBaseline = 'middle';
      const starX = band - 13;
      for (const s of sysRows) {
        if (!s.on) continue;
        const col = s.solar ? '#ffd76a' : teffColor(s.teff);
        const r = clamp(rowH * 0.3, 1.5, 5) * (s.starR ? clamp(0.62 + 0.4 * Math.sqrt(s.starR), 0.7, 1.45) : 1);
        g.globalAlpha = alpha * 0.55;
        g.drawImage(sprite(col), starX - r * 2.6, s.sy - r * 2.6, r * 5.2, r * 5.2);
        g.globalAlpha = alpha;
        g.fillStyle = col;
        g.beginPath(); g.arc(starX, s.sy, r, 0, 6.2832); g.fill();
        if (size) {
          g.font = (s.solar ? '600 ' : '') + size + 'px ' + FONT_UI;
          g.fillStyle = s.solar ? '#f4f1e4' : '#c3c9e6';
          g.fillText(fitText(g, sysName(s), band - 34), band - 26, s.sy);
        }
      }
    }
    g.restore();
  }

  // Benannte Regionen. x, y: Ort des Namens; box: Ausschnitt, in den ein Klick
  // auf den Namen zoomt (x0, x1, y0, y1 in den Einheiten der Achsen, log10).
  const REGIONS = {
    mp: [
      { key: 'hotJupiters', x: log10(330), y: log10(0.55), box: [log10(30), log10(4000), log10(0.35), log10(12)] },
      { key: 'superEarths', x: log10(2.2), y: log10(1.0), box: [log10(0.7), log10(25), log10(0.3), log10(120)] },
      { key: 'coldGiants', x: log10(900), y: log10(2400), box: [log10(60), log10(5000), log10(150), log10(30000)] },
      { key: 'wide', x: log10(260), y: log10(4e6), box: [log10(100), log10(12000), log10(2e4), log10(1e8)] },
    ],
    rs: [
      { key: 'lava', x: -log10(1500), y: log10(0.45), box: [-log10(20000), -log10(150), log10(0.3), log10(2.5)] },
      { key: 'ice', x: -log10(0.006), y: log10(0.45), box: [-log10(0.06), -log10(0.0007), log10(0.3), log10(15)] },
    ],
    mr: [
      { key: 'rockyWorlds', x: log10(0.22), y: log10(1.55), box: [log10(0.03), log10(14), log10(0.3), log10(2.4)] },
      { key: 'gasGiants', x: log10(2600), y: log10(5.6), box: [log10(40), log10(9000), log10(5), log10(26)] },
      { key: 'puffy', x: log10(28), y: log10(17), box: [log10(4), log10(400), log10(6), log10(26)] },
    ],
    sys: [],
  };
  function drawRegions(g, name, v, alpha) {
    for (const r of REGIONS[name]) r.rect = null;
    if (alpha <= 0.01 || visibleCount <= 500) return;
    g.save();
    g.globalAlpha = alpha * 0.9;
    g.font = '600 15px ' + FONT_DISPLAY;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = 'rgba(6,9,23,0.72)';
    g.fillStyle = '#e4e9ff';
    for (const r of REGIONS[name]) {
      const x = sxOf(v, r.x), y = syOf(v, r.y);
      r.rect = null;
      if (x < plot.l + 40 || x > plot.r - 40 || y < plot.t + 12 || y > plot.b - 12) continue;
      g.strokeText(tx.regions[r.key], x, y);
      g.fillText(tx.regions[r.key], x, y);
      // Fläche des Namens merken: ein Klick darauf zoomt in die Region.
      const w = g.measureText(tx.regions[r.key]).width;
      if (!morph) r.rect = [x - w / 2 - 4, y - 11, w + 8, 22];
    }
    g.restore();
  }

  // Schwacher, fester Sternenhintergrund (immer dieselben Positionen).
  let starfield = null;
  function drawBackground(g) {
    const grad = g.createRadialGradient(W * 0.56, H * 0.52, 0, W * 0.56, H * 0.52, Math.max(W, H) * 0.75);
    grad.addColorStop(0, '#111a3d');
    grad.addColorStop(0.55, '#0a1029');
    grad.addColorStop(1, '#060917');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    if (!starfield) {
      starfield = [];
      let seed = 20261120;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < 170; i++) starfield.push([rnd(), rnd(), 0.3 + rnd() * 0.9, 0.05 + rnd() * 0.16]);
    }
    g.fillStyle = '#dfe6ff';
    for (const s of starfield) {
      g.globalAlpha = s[3];
      g.fillRect(Math.round(s[0] * W), Math.round(s[1] * H), s[2], s[2]);
    }
    g.globalAlpha = 1;
  }

  SOLAR.forEach((s) => { s.pos = { mp: [log10(s.m), log10(s.p)], rs: [-log10(s.s), log10(s.r)], mr: [log10(s.m), log10(s.r)],
    sys: [log10(s.p), 0] }; });   // das Sonnensystem ist immer die oberste Zeile
  function solarPos(s, name, v) { return [sxOf(v, s.pos[name][0]), syOf(v, s.pos[name][1])]; }
  // Zoomt auf alle sichtbaren Planeten; Erde, Venus und Mars bleiben als
  // Vergleich im Bild.
  function focusVisible(ms) {
    const list = points.filter((p) => p.vis && p.pos[state.view]);
    if (!list.length || state.view === 'sys') { flyTo(home[state.view], ms); return; }
    flyToPoints(list.concat(SOLAR.filter((s) => s.key === 'earth' || s.key === 'venus' || s.key === 'mars')), ms, 0.22);
  }

  function isHomeView() {
    const h = home[state.view];
    return !morph && ['x0', 'x1', 'y0', 'y1'].every((k) => Math.abs(view[k] - h[k]) < 1e-6);
  }
  function renderStatic() {
    dom.homeBtn.hidden = isHomeView();
    const g = dom.base.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(g);
    if (morph) {
      drawAxes(g, morph.from, morph.fromView, 1 - morph.e);
      drawAxes(g, morph.to, morph.toView, morph.e);
    } else {
      drawAxes(g, state.view, view, 1);
    }
    g.save();
    g.beginPath(); g.rect(plot.l, plot.t, plot.w, plot.h); g.clip();
    // Zeilen der Systemansicht; während eines Wechsels blenden sie um.
    const sysLayer = (layer) => {
      if (morph) {
        if (morph.from === 'sys') drawSystems(g, morph.fromView, 1 - morph.e, layer);
        if (morph.to === 'sys') drawSystems(g, morph.toView, morph.e, layer);
      } else if (state.view === 'sys') drawSystems(g, view, 1, layer);
    };
    sysLayer('under');

    const zs = zoomScale(), cap = sizeCap();
    const dense = points.length > 5000 ? 0.8 : 1;
    // 1. Leuchten (additiv): dichte Gebiete werden zu hellen Wolken.
    g.globalCompositeOperation = 'lighter';
    for (const p of points) {
      place(p);
      const a = p.a * p.fade;
      if (a <= 0.01 || p.sx < plot.l - 20 || p.sx > plot.r + 20 || p.sy < plot.t - 20 || p.sy > plot.b + 20) continue;
      const big = p.stories.length ? 1.5 : 1;
      const s = Math.min(TYPES[p.ti].size * zs * 7.5 * big, cap * 6.5);
      g.globalAlpha = a * (isEstimate(p) ? 0.10 : 0.20) * dense * (p.stories.length ? 1.8 : 1);
      g.drawImage(sprite(pointColors(p)[1]), p.sx - s / 2, p.sy - s / 2, s, s);
    }
    // 2. Kerne.
    g.globalCompositeOperation = 'source-over';
    for (const p of points) {
      const a = p.a * p.fade;
      if (a <= 0.01 || p.sx < plot.l - 6 || p.sx > plot.r + 6 || p.sy < plot.t - 6 || p.sy > plot.b + 6) continue;
      const r = Math.min(TYPES[p.ti].size * zs * (p.stories.length ? 1.35 : 1), cap);
      const col = pointColors(p)[0];
      const est = isEstimate(p);
      g.globalAlpha = a * (est ? 0.6 : 0.95);
      if (est) {   // geschätzte Masse bzw. geschätzter Radius: offener Ring
        g.strokeStyle = col; g.lineWidth = Math.max(0.8, r * 0.42);
        g.beginPath(); g.arc(p.sx, p.sy, Math.max(0.9, r * 0.8), 0, 6.2832); g.stroke();
      } else {
        g.fillStyle = col;
        g.beginPath(); g.arc(p.sx, p.sy, r, 0, 6.2832); g.fill();
      }
    }
    g.globalAlpha = 1;

    // Sonnensystem als Vergleich.
    const sAlpha = (name, v, al) => {
      if (al <= 0.01) return;
      g.font = '500 12.5px ' + FONT_UI;
      g.textBaseline = 'middle';
      // In der Systemansicht kleiner (Zeilenhöhe) und ohne Namen: die Zeile heißt "Sonnensystem".
      const inRow = name === 'sys', k = inRow ? clamp(rowHeight(v) * 0.36 / 4.2, 0.5, 1) : 1;
      for (const s of SOLAR) {
        const q = solarPos(s, name, v);
        s.sx = q[0]; s.sy = q[1];
        g.globalAlpha = al;
        g.fillStyle = '#060917'; g.beginPath(); g.arc(q[0], q[1], 5.2 * k, 0, 6.2832); g.fill();
        g.strokeStyle = '#f4f1e4'; g.lineWidth = 1.6 * Math.sqrt(k); g.beginPath(); g.arc(q[0], q[1], 4.2 * k, 0, 6.2832); g.stroke();
        if (s.key === 'earth') { g.fillStyle = '#f4f1e4'; g.beginPath(); g.arc(q[0], q[1], 1.8 * k, 0, 6.2832); g.fill(); }
        if (inRow) { s.label = null; continue; }
        const left = s.key === 'venus' || s.key === 'uranus' || s.key === 'saturn';
        g.textAlign = left ? 'right' : 'left';
        g.lineWidth = 3.5; g.strokeStyle = 'rgba(6,9,23,0.85)'; g.lineJoin = 'round';
        g.strokeText(tx.planets[s.key], q[0] + (left ? -9 : 9), q[1]);
        g.fillStyle = '#f4f1e4';
        g.fillText(tx.planets[s.key], q[0] + (left ? -9 : 9), q[1]);
        // Fläche des Namens merken: auch ein Klick darauf wählt den Planeten.
        const tw = g.measureText(tx.planets[s.key]).width;
        s.label = [left ? q[0] - 9 - tw : q[0] + 9, q[1] - 9, tw, 18];
      }
      g.globalAlpha = 1;
    };
    if (morph) {
      // Die Marken gleiten nicht mit; sie blenden um.
      if (morph.e < 0.5) sAlpha(morph.from, morph.fromView, 1 - morph.e * 2);
      else sAlpha(morph.to, morph.toView, morph.e * 2 - 1);
    } else sAlpha(state.view, view, 1);
    // Namen der Regionen liegen über den Punkten.
    if (morph) {
      drawRegions(g, morph.from, morph.fromView, 1 - morph.e);
      drawRegions(g, morph.to, morph.toView, morph.e);
    } else drawRegions(g, state.view, view, 1);
    g.restore();
    sysLayer('over');

    g.strokeStyle = 'rgba(150,170,255,0.28)';
    g.lineWidth = 1;
    g.strokeRect(plot.l + 0.5, plot.t + 0.5, plot.w, plot.h);
  }

  // ------------------------------------------------------------- Überlagerung
  function storyVisible(story) {
    return story.t <= state.yearMax + 1 && (!state.tags || story.tags.some((t) => state.tags.indexOf(t) >= 0));
  }
  function ringPoints() {   // Planeten mit Bericht, die gerade sichtbar sind
    return points.filter((p) => p.stories.length && p.a * p.fade > 0.3 &&
      p.sx >= plot.l && p.sx <= plot.r && p.sy >= plot.t && p.sy <= plot.b);
  }

  function renderOverlay(time) {
    const g = dom.overlay.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath(); g.rect(plot.l, plot.t, plot.w, plot.h); g.clip();

    const rp = ringPoints();
    const focus = new Set();
    const target = pinned && pinned.kind === 'planet' ? pinned.p : null;
    const hp = hover && hover.kind === 'planet' ? hover.p : null;
    if (hlStory) hlStory.points.forEach((p) => focus.add(p));
    const inSys = state.view === 'sys' && !morph;
    const selSys = pinned && pinned.kind === 'system' ? pinned.sys : null;
    const hovSys = hover && (hover.kind === 'system' || hover.kind === 'gap') ? hover.sys : null;
    if (selSys && !selSys.solar) selSys.planets.forEach((p) => focus.add(p));
    if (inSys) {
      // Gewählte Zeile bzw. Zeile unter dem Mauszeiger.
      const rowH = rowHeight(view);
      for (const s of new Set([selSys, hovSys])) {
        if (!s || s.row < 0) continue;
        g.fillStyle = s === selSys ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)';
        g.fillRect(plot.l, s.sy - rowH / 2, plot.w, rowH);
      }
      if (hover && hover.kind === 'gap' && isFinite(hover.gap.sx)) {
        g.strokeStyle = '#ffffff'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(hover.gap.sx, hover.gap.sy, clamp(rowH * 0.3, 2.2, 5.5) + 3.5, 0, 6.2832); g.stroke();
      }
    }

    // Ringe um Planeten mit Bericht; sie pulsieren langsam.
    for (const p of rp) {
      const base = Math.min(TYPES[p.ti].size * zoomScale() * 1.35, sizeCap()) + 3.5;
      const col = pointColors(p)[0];
      g.lineWidth = 1.3;
      g.strokeStyle = col;
      g.globalAlpha = 0.9;
      g.beginPath(); g.arc(p.sx, p.sy, base, 0, 6.2832); g.stroke();
      if (!reducedMotion) {
        const ph = ((time / 2600) + (p.id % 17) / 17) % 1;
        g.globalAlpha = (1 - ph) * 0.55;
        g.beginPath(); g.arc(p.sx, p.sy, base + ph * 11, 0, 6.2832); g.stroke();
      }
    }
    g.globalAlpha = 1;

    // Geschwister des gewählten Planeten: dünne Ringe.
    const sysOf = hp || target;
    if (sysOf && sysOf.system.length > 1) {
      g.strokeStyle = 'rgba(244,241,228,0.55)';
      g.lineWidth = 1;
      for (const q of sysOf.system) {
        if (q === sysOf || q.a * q.fade < 0.3) continue;
        g.beginPath(); g.arc(q.sx, q.sy, baseR(q) + 5, 0, 6.2832); g.stroke();
      }
    }
    // Hervorgehobener Bericht: kräftige Ringe.
    for (const p of focus) {
      if (p.fade < 0.3) continue;
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.arc(p.sx, p.sy, baseR(p) + (inSys ? 5 : 8), 0, 6.2832); g.stroke();
    }
    // Auswahl und Mauszeiger.
    for (const p of [target, hp]) {
      if (!p || p.fade < 0.3) continue;
      const r = baseR(p) + 7;
      g.strokeStyle = '#ffffff'; g.lineWidth = p === target ? 2.2 : 1.6;
      g.beginPath(); g.arc(p.sx, p.sy, r, 0, 6.2832); g.stroke();
      // Hilfslinien zu den Achsen (in der Systemansicht nur zur Umlaufzeit).
      g.setLineDash([3, 4]);
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(p.sx, p.sy + r); g.lineTo(p.sx, plot.b);
      if (state.view !== 'sys') { g.moveTo(p.sx - r, p.sy); g.lineTo(plot.l, p.sy); }
      g.stroke();
      g.setLineDash([]);
    }

    const solarR = inSys ? clamp(rowHeight(view) * 0.36, 2.1, 4.2) + 5 : 10;
    for (const target0 of [pinned, hover]) {
      if (!target0 || target0.kind !== 'solar' || morph) continue;
      const b0 = target0.s;
      if (b0.sx < plot.l || b0.sx > plot.r || b0.sy < plot.t || b0.sy > plot.b) continue;
      g.strokeStyle = '#f4f1e4'; g.lineWidth = target0 === pinned ? 2.2 : 1.6;
      g.beginPath(); g.arc(b0.sx, b0.sy, solarR, 0, 6.2832); g.stroke();
    }
    // Das Sonnensystem als Ganzes gewählt: alle acht Marken.
    if (selSys && selSys.solar && !morph) {
      g.strokeStyle = '#f4f1e4'; g.lineWidth = 1.6;
      for (const b0 of SOLAR) { g.beginPath(); g.arc(b0.sx, b0.sy, solarR, 0, 6.2832); g.stroke(); }
    }
    // Namen: ausgewählte zuerst, dann Planeten mit Bericht, solange Platz ist.
    const placed = [];
    g.font = '600 12.5px ' + FONT_UI;
    g.textBaseline = 'middle';
    const labeled = new Set();
    function label(p, strong) {
      if (!p || labeled.has(p)) return;
      // Systemansicht: Buchstaben an allen Planeten nur, wenn die Zeilen hoch genug sind.
      if (inSys && p !== target && p !== hp && rowHeight(view) < 26) return;
      labeled.add(p);
      if (p.a * p.fade < 0.3 || p.sx < plot.l || p.sx > plot.r || p.sy < plot.t || p.sy > plot.b) return;
      // In der Systemansicht nennt die Zeile den Stern; am Punkt steht nur der Buchstabe.
      const text = inSys ? shortName(p) : p.name, w = g.measureText(text).width, off = baseR(p) + (inSys ? 7 : 11);
      const options = inSys
        ? [[p.sx, p.sy - off - 6, 'center'], [p.sx, p.sy + off + 6, 'center']]
        : [[p.sx + off, p.sy, 'left'], [p.sx - off, p.sy, 'right'], [p.sx, p.sy - off - 6, 'center'], [p.sx, p.sy + off + 6, 'center']];
      for (const o of options) {
        const x0 = o[2] === 'left' ? o[0] : o[2] === 'right' ? o[0] - w : o[0] - w / 2;
        const rect = [x0 - 3, o[1] - 9, w + 6, 18];
        if (rect[0] < plot.l + 2 || rect[0] + rect[2] > plot.r - 2 || rect[1] < plot.t + 2 || rect[1] + rect[3] > plot.b - 2) continue;
        if (placed.some((r) => rect[0] < r[0] + r[2] && rect[0] + rect[2] > r[0] && rect[1] < r[1] + r[3] && rect[1] + rect[3] > r[1])) continue;
        placed.push(rect);
        g.textAlign = o[2];
        g.lineWidth = 3.5; g.lineJoin = 'round'; g.strokeStyle = 'rgba(6,9,23,0.9)';
        g.strokeText(text, o[0], o[1]);
        g.fillStyle = strong ? '#ffffff' : 'rgba(232,236,255,0.86)';
        g.fillText(text, o[0], o[1]);
        return;
      }
    }
    label(target, true); label(hp, true);
    for (const p of focus) label(p, true);
    if (sysOf && sysOf.system.length > 1 && sysOf.system.length <= 9) for (const q of sysOf.system) label(q, false);
    g.font = '500 12px ' + FONT_UI;
    if (rp.length <= 70 && !inSys) {
      // Neuere Berichte zuerst.
      rp.slice().sort((a, b) => b.stories[b.stories.length - 1].t - a.stories[a.stories.length - 1].t)
        .forEach((p) => label(p, false));
    }
    // Sind nur wenige Planeten zu sehen, bekommen alle einen Namen.
    if (visibleCount <= 60 && !inSys) {
      g.fillStyle = 'rgba(232,236,255,0.8)';
      points.filter((p) => p.vis).sort((a, b) => (b.esi || 0) - (a.esi || 0)).forEach((p) => label(p, false));
    }
    g.restore();
    if (inSys) {
      // Name der gewählten Zeile bzw. der Zeile unter dem Mauszeiger, auch
      // wenn die Zeilen für Namen zu niedrig sind.
      const band = sysBand();
      g.save();
      g.beginPath(); g.rect(0, plot.t, band, plot.h); g.clip();
      g.font = '600 12px ' + FONT_UI;
      g.textAlign = 'right'; g.textBaseline = 'middle';
      for (const s of new Set([selSys, hovSys])) {
        if (!s || s.row < 0 || !s.on) continue;
        const text = fitText(g, sysName(s), band - 34), w = g.measureText(text).width;
        g.fillStyle = 'rgba(9,14,36,0.96)';
        g.fillRect(band - 30 - w, s.sy - 9, w + 8, 18);
        g.fillStyle = '#ffffff';
        g.fillText(text, band - 26, s.sy);
      }
      g.restore();
    }
  }

  // Systemansicht: Planeten einer gezeigten Zeile, die nicht zu den Filtern
  // passen, bleiben blass sichtbar (und anklickbar).
  const GHOST_ALPHA = 0.34;
  function schedule() {
    if (!rafId) rafId = requestAnimationFrame(frame);
  }
  function frame(time) {
    rafId = 0;
    let busy = false;
    if (viewTween) {
      const k = clamp((time - viewTween.start) / viewTween.ms, 0, 1), e = ease(k);
      for (const key of ['x0', 'x1', 'y0', 'y1']) view[key] = viewTween.from[key] + (viewTween.to[key] - viewTween.from[key]) * e;
      if (k >= 1) viewTween = null; else busy = true;
      staticDirty = true;
    }
    if (morph) {
      const k = clamp((time - morph.start) / morph.ms, 0, 1);
      morph.e = ease(k);
      if (k >= 1) {
        const then = morph.then;
        view = Object.assign({}, morph.toView); morph = null;
        if (then) then();
      } else busy = true;
      staticDirty = true;
    }
    if (alphaTween) {
      let moving = false;
      for (const p of points) {
        const target = p.vis ? 1 : p.ghost ? GHOST_ALPHA : 0;
        if (p.a === target) continue;
        p.a += (target - p.a) * (reducedMotion ? 1 : 0.22);
        if (Math.abs(target - p.a) < 0.02) p.a = target; else moving = true;
      }
      alphaTween = moving;
      if (moving) busy = true;
      staticDirty = true;
    }
    if (staticDirty) { renderStatic(); staticDirty = false; overlayDirty = true; }
    const pulsing = !reducedMotion && !document.hidden && points.some((p) => p.stories.length && p.vis);
    if (overlayDirty || pulsing) { renderOverlay(time); overlayDirty = false; }
    if (busy || pulsing) schedule();
  }
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  function flyTo(target, ms) {
    if (morph) return;
    const h = limits[state.view];
    const t = Object.assign({}, target);
    // Nicht weiter hinaus als die ganze Ansicht, nicht tiefer als 1/12 Dekade.
    const fit = (lo, hi, a, b, least) => {
      let span = clamp(b - a, least, (hi - lo));
      let c = clamp((a + b) / 2, lo + span / 2, hi - span / 2);
      return [c - span / 2, c + span / 2];
    };
    const xr = fit(h.x0, h.x1, t.x0, t.x1, minSpan('x')), yr = fit(h.y0, h.y1, t.y0, t.y1, minSpan('y'));
    const to = { x0: xr[0], x1: xr[1], y0: yr[0], y1: yr[1] };
    if (reducedMotion || !ms) { view = to; viewTween = null; staticDirty = true; }
    else viewTween = { from: Object.assign({}, view), to: to, start: performance.now(), ms: ms };
    schedule();
  }
  function flyToPoints(list, ms, pad) {
    const q = list.map((p) => p.pos[state.view]).filter(Boolean);
    if (!q.length) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of q) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }
    const padX = pad ? Math.max(0.25, (x1 - x0) * pad) : Math.max(0.9, (x1 - x0) * 0.6);
    const padY = pad ? Math.max(0.18, (y1 - y0) * pad) : Math.max(0.9, (y1 - y0) * 0.6);
    flyTo({ x0: x0 - padX, x1: x1 + padX, y0: y0 - padY, y1: y1 + padY }, ms);
  }

  function setView(name, then) {
    if (name === state.view) return;
    // Läuft noch ein Wechsel, wird er sofort abgeschlossen.
    if (morph) { view = Object.assign({}, morph.toView); morph = null; }
    const from = state.view;
    state.view = name;
    layoutSystems(false);   // die Zeilen der Systemansicht müssen vor dem Wechsel feststehen
    morph = { from: from, to: name, fromView: Object.assign({}, view), toView: Object.assign({}, home[name]),
      start: performance.now(), ms: reducedMotion ? 1 : 1100, e: 0, then: then || null };
    viewTween = null;
    applyFilters();
    syncControls();
    schedule();
  }

  // ================================================================= Filter
  // Passt der Planet zu den Filtern? name: Ansicht; anyYear: das
  // Entdeckungsjahr nicht prüfen.
  function filterOk(p, name, anyYear) {
    if (!state.types[p.ti] || !state.methods[p.mi]) return false;
    if (!state.estMass && estimateIn(p, name)) return false;
    if (p.estPeriod && !state.estPeriod && (name === 'mp' || name === 'sys')) return false;
    if (!anyYear && p.year !== null && p.year > state.yearMax) return false;
    if (state.multiOnly && p.system.length < 2) return false;
    if (state.hz === 'opt' && !(p.hz === 'inner' || p.hz === 'yes' || p.hz === 'outer')) return false;
    if (state.hz === 'con' && p.hz !== 'yes') return false;
    if (state.maxDist !== null && !(p.distLy !== null && p.distLy <= state.maxDist)) return false;
    if (state.storiesOnly) {
      if (!p.stories.length) return false;
      if (state.tags && !p.stories.some((s) => s.tags.some((t) => state.tags.indexOf(t) >= 0))) return false;
    }
    return true;
  }
  function passes(p) { return filterOk(p, state.view, false); }
  function applyFilters() {
    // Systemansicht: ändern sich die Zeilen, beginnt sie wieder beim ganzen Bild.
    if (layoutSystems(false) && state.view === 'sys') {
      if (morph && morph.to === 'sys') morph.toView = Object.assign({}, home.sys);
      else if (!morph) { view = Object.assign({}, home.sys); viewTween = null; }
    }
    let n = 0;
    const tCount = TYPES.map(() => 0), mCount = METHODS.map(() => 0);
    const perYear = new Array(maxYear - minYear + 1).fill(0);
    // Zähler je Schalter: wie viele es wären, wenn nur dieser Schalter an wäre.
    for (const p of points) {
      const saveT = state.types[p.ti], saveM = state.methods[p.mi], saveY = state.yearMax;
      state.types[p.ti] = true; const okT = passes(p); state.types[p.ti] = saveT;
      state.methods[p.mi] = true; const okM = passes(p); state.methods[p.mi] = saveM;
      state.yearMax = maxYear; const okY = passes(p); state.yearMax = saveY;
      if (okT) tCount[p.ti]++;
      if (okM) mCount[p.mi]++;
      if (okY && p.year !== null) perYear[p.year - minYear]++;
      p.vis = passes(p);
      p.ghost = state.view === 'sys' && !p.vis && !!p.pos.sys && (p.year === null || p.year <= state.yearMax);
      if (p.vis && p.pos[state.view]) n++;
    }
    alphaTween = true;
    visibleCount = n;
    sparse = n <= 80 ? 2.1 : n <= 500 ? 1.5 : 1;
    staticDirty = true;
    const untouched = filtersAtDefault();
    dom.count.textContent = tx.subtitle(int(n), int(points.length), untouched && n === points.length);
    dom.resetBtn.hidden = untouched;
    dom.resetBtn.textContent = tx.showAll;
    dom.typeCounts.forEach((el, i) => { el.textContent = int(tCount[i]); });
    dom.methodCounts.forEach((el, i) => { el.textContent = int(mCount[i]); });
    const top = Math.max(1, Math.max.apply(null, perYear));
    dom.yearBars.forEach((bar, i) => {
      bar.style.height = Math.max(perYear[i] ? 3 : 0, perYear[i] / top * 100) + '%';
      bar.classList.toggle('is-off', minYear + i > state.yearMax);
    });
    // Dieselben Berichte wie in den Kacheln der Übersicht.
    const listed = new Set(listedStories());
    dom.markers.forEach((m) => { m.el.classList.toggle('is-off', !listed.has(m.story)); });
    overlayDirty = true;
    if (!shown && dom.panelBody) renderPanel();
    schedule();
  }

  function matchesPreset(name) {
    const base = { types: TYPES.map(() => true), methods: METHODS.map(() => true), hz: 'all', maxDist: null,
      storiesOnly: false, multiOnly: false, tags: null };
    const want = Object.assign(base, PRESETS[name]);
    return ['hz', 'maxDist', 'storiesOnly', 'multiOnly'].every((k) => state[k] === want[k]) &&
      String(state.types) === String(want.types) && String(state.methods) === String(want.methods) &&
      String(state.tags) === String(want.tags);
  }
  // Sind alle Filter im Ausgangszustand? (Die Ansicht zählt nicht dazu.)
  function filtersAtDefault() {
    return matchesPreset('all') && state.estMass && state.estPeriod && state.yearMax >= maxYear;
  }
  // Alle Filter in den Ausgangszustand (ohne neu zu zeichnen).
  function openFilters() {
    state.types = TYPES.map(() => true); state.methods = METHODS.map(() => true);
    state.hz = 'all'; state.maxDist = null; state.storiesOnly = false; state.multiOnly = false; state.tags = null;
    state.estMass = state.estPeriod = true;
    stopPlay(); state.yearMax = maxYear;
  }
  function resetFilters() {
    openFilters();
    applyFilters(); syncControls();
    flyTo(home[state.view], 700);
  }
  function applyPreset(name) {
    const preset = PRESETS[name];
    state.types = (preset.types || TYPES.map(() => true)).slice();
    state.methods = METHODS.map(() => true);
    state.hz = preset.hz || 'all';
    state.maxDist = preset.maxDist || null;
    state.storiesOnly = !!preset.storiesOnly;
    state.multiOnly = !!preset.multiOnly;
    state.tags = preset.tags || null;
    stopPlay();
    state.yearMax = maxYear;
    // Ein Filtersatz wechselt die Ansicht nur, wenn er eine eigene braucht.
    const wantView = preset.view || state.view;
    applyFilters();
    syncControls();
    const after = preset.focus ? () => focusVisible(900) : null;
    if (wantView !== state.view) setView(wantView, after);
    else if (after) after();
    else flyTo(home[state.view], 700);
  }

  // =============================================================== Bedienung
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(className, text, onClick) {
    const b = el('button', className, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  const FONT_UI = '"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,"Helvetica Neue",Ubuntu,Roboto,sans-serif';
  const FONT_DISPLAY = '"Bricolage Grotesque",' + FONT_UI;

  function buildUi(root) {
    root.replaceChildren();
    root.setAttribute('lang', lang);
    root.setAttribute('data-atlas-version', VERSION);

    // ---- Kopfzeile
    const head = el('header', 'atlas-head');
    const brand = el('div', 'atlas-brand');
    dom.title = el('h1', 'atlas-title');
    dom.titleText = el('span', '', tx.title);
    dom.version = el('span', 'atlas-version', VERSION);
    dom.title.append(dom.titleText, ' ', dom.version);
    dom.count = el('p', 'atlas-count');
    dom.count.setAttribute('aria-live', 'polite');
    dom.resetBtn = button('atlas-link atlas-reset', '', resetFilters);
    dom.resetBtn.hidden = true;
    const sub = el('div', 'atlas-sub');
    sub.append(dom.count, dom.resetBtn);
    brand.append(dom.title, sub);

    dom.presets = el('div', 'atlas-presets');
    dom.presets.setAttribute('role', 'group');
    dom.presetButtons = Object.keys(PRESETS).map((name) => {
      const b = button('atlas-pill', '', () => applyPreset(name));
      b.dataset.preset = name;
      dom.presets.appendChild(b);
      return b;
    });

    const tools = el('div', 'atlas-tools');
    const searchWrap = el('div', 'atlas-search');
    dom.search = el('input');
    dom.search.type = 'search';
    dom.search.autocomplete = 'off';
    dom.search.spellcheck = false;
    dom.searchList = el('div', 'atlas-search-list');
    dom.searchList.hidden = true;
    searchWrap.append(dom.search, dom.searchList);
    if (config.langUrls && typeof config.langUrls === 'object') {
      // Die einbettende Seite hat je Sprache eine eigene Adresse.
      dom.langBtn = el('a', 'atlas-tool');
    } else {
      dom.langBtn = button('atlas-tool', '', () => setLang(lang === 'de' ? 'en' : 'de'));
    }
    dom.fullBtn = button('atlas-tool atlas-tool-icon', '', toggleFullscreen);
    dom.fullBtn.innerHTML = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    tools.append(searchWrap, dom.langBtn, dom.fullBtn);
    head.append(brand, dom.presets, tools);

    // ---- Filterleiste links
    const side = el('aside', 'atlas-side');
    const sideScroll = el('div', 'atlas-side-scroll');
    side.appendChild(sideScroll);
    function group(key, parent) {
      const box = el('section', 'atlas-group');
      const title = el('h2', 'atlas-group-title');
      title.dataset.tx = key;
      box.appendChild(title);
      (parent || sideScroll).appendChild(box);
      return box;
    }
    // Platz der einbettenden Website: Logo und Links (z. B. Impressum).
    dom.site = null;
    const site = config.site;
    if (site && (site.logo || (Array.isArray(site.links) && site.links.length))) {
      dom.site = el('div', 'atlas-site');
      side.appendChild(dom.site);
    }
    function segmented(box, options, get, set) {
      const row = el('div', 'atlas-seg');
      row.setAttribute('role', 'group');
      const buttons = options.map((opt) => {
        const b = button('atlas-seg-btn', '', () => { set(opt.value); });
        b.dataset.txPath = opt.tx;
        row.appendChild(b);
        return { b: b, value: opt.value };
      });
      box.appendChild(row);
      dom.syncers.push(() => buttons.forEach((o) => o.b.setAttribute('aria-pressed', String(get() === o.value))));
      return buttons;
    }
    dom.syncers = [];

    const gView = group('view');
    dom.viewButtons = segmented(gView, [{ value: 'mp', tx: 'views.mp' }, { value: 'rs', tx: 'views.rs' }, { value: 'mr', tx: 'views.mr' },
      { value: 'sys', tx: 'views.sys' }], () => state.view, (v) => setView(v));
    gView.querySelector('.atlas-seg').classList.add('atlas-seg-stack');

    // Nur in der Ansicht "Planetensysteme": wie viele Planeten ein System
    // mindestens haben muss, und ob die freien Plätze der Reihe zu sehen sind.
    dom.sysGroup = group('sysGroup');
    segmented(dom.sysGroup, [{ value: 4, tx: 'sysMin.4' }, { value: 5, tx: 'sysMin.5' }, { value: 6, tx: 'sysMin.6' }],
      () => state.sysMin, (v) => { state.sysMin = v; applyFilters(); syncControls(); if (shown) renderPanel(); });
    {
      const b = button('atlas-check atlas-check-small atlas-switch atlas-gaps', '', () => {
        state.gaps = !state.gaps; staticDirty = true; syncControls(); schedule(); if (shown) renderPanel();
      });
      b.setAttribute('role', 'checkbox');
      const name = el('span', 'atlas-check-name');
      name.dataset.tx = 'gaps';
      b.append(el('i', 'atlas-box'), name, el('i', 'atlas-ring is-dashed'));
      b.dataset.txTitle = 'gapsHint';
      dom.sysGroup.appendChild(b);
      dom.syncers.push(() => b.setAttribute('aria-checked', String(state.gaps)));
    }

    const gType = group('typeGroup');
    dom.typeCounts = [];
    dom.typeRows = TYPES.map((t, i) => {
      const b = button('atlas-check', '', () => { state.types[i] = !state.types[i]; applyFilters(); syncControls(); });
      b.setAttribute('role', 'checkbox');
      const dot = el('i', 'atlas-dot');
      dot.dataset.color = 'type';
      const name = el('span', 'atlas-check-name');
      name.dataset.txPath = 'types.' + t.key;
      const hint = el('span', 'atlas-check-hint');
      hint.dataset.txPath = 'typeHint.' + t.key;
      const n = el('span', 'atlas-check-n');
      const textBox = el('span', 'atlas-check-text');
      textBox.append(name, hint);
      b.append(dot, textBox, n);
      gType.appendChild(b);
      dom.typeCounts.push(n);
      return { b: b, dot: dot };
    });

    const gHz = group('hzGroup');
    dom.hzButtons = [];
    segmented(gHz, [{ value: 'all', tx: 'hz.all' }, { value: 'opt', tx: 'hz.opt' }, { value: 'con', tx: 'hz.con' }],
      () => state.hz, (v) => { state.hz = v; applyFilters(); syncControls(); }).forEach((o) => dom.hzButtons.push(o));

    const gDist = group('distGroup');
    segmented(gDist, [{ value: null, tx: 'dist.all' }, { value: 100, tx: 'dist.d100' }, { value: 50, tx: 'dist.d50' }, { value: 20, tx: 'dist.d20' }],
      () => state.maxDist, (v) => { state.maxDist = v; applyFilters(); syncControls(); });

    // Selten gebrauchte Einstellungen stehen eingeklappt unter "Weitere Filter".
    dom.moreBtn = button('atlas-more-toggle', '', () => { moreOpen = !moreOpen; syncControls(); });
    dom.moreLabel = el('span');
    dom.moreBadge = el('span', 'atlas-more-badge');
    dom.moreBtn.append(dom.moreLabel, dom.moreBadge, el('i', 'atlas-more-chevron'));
    dom.more = el('div', 'atlas-more');
    dom.more.id = 'atlas-more';
    dom.moreBtn.setAttribute('aria-controls', 'atlas-more');
    sideScroll.append(dom.moreBtn, dom.more);

    const gMethod = group('methodGroup', dom.more);
    dom.methodCounts = [];
    dom.methodRows = METHODS.map((m, i) => {
      const b = button('atlas-check atlas-check-small', '', () => { state.methods[i] = !state.methods[i]; applyFilters(); syncControls(); });
      b.setAttribute('role', 'checkbox');
      const dot = el('i', 'atlas-dot');
      dot.dataset.color = 'method';
      const name = el('span', 'atlas-check-name');
      name.dataset.txPath = 'methods.' + m.key;
      const n = el('span', 'atlas-check-n');
      b.append(dot, name, n);
      gMethod.appendChild(b);
      dom.methodCounts.push(n);
      return { b: b, dot: dot };
    });

    const gData = group('dataGroup', dom.more);
    function toggle(key, txKey) {
      const b = button('atlas-check atlas-check-small atlas-switch', '', () => { state[key] = !state[key]; applyFilters(); syncControls(); });
      b.setAttribute('role', 'checkbox');
      const dot = el('i', 'atlas-box');
      const name = el('span', 'atlas-check-name');
      name.dataset.tx = txKey;
      b.append(dot, name);
      if (key === 'estMass') { b.appendChild(el('i', 'atlas-ring')); b.dataset.txTitle = 'estMassHint'; }   // so sehen geschätzte Punkte aus
      gData.appendChild(b);
      dom.syncers.push(() => b.setAttribute('aria-checked', String(state[key])));
    }
    toggle('estMass', 'estMass');
    toggle('estPeriod', 'estPeriod');
    toggle('storiesOnly', 'storiesOnly');
    toggle('multiOnly', 'multiOnly');

    // Die Farbe ist keine Filterung, sondern eine Darstellungsfrage: Sie steht
    // deshalb offen, unter der Entfernung und über "Weitere Filter".
    const gColor = group('colorBy');
    dom.moreBtn.before(gColor);
    segmented(gColor, [{ value: 'type', tx: 'colors.type' }, { value: 'method', tx: 'colors.method' }, { value: 'star', tx: 'colors.star' }],
      () => state.colorBy, (v) => { state.colorBy = v; staticDirty = true; syncControls(); schedule(); });
    dom.starLegend = el('div', 'atlas-star-legend');
    dom.starLegend.innerHTML = '<span data-tx="starCool"></span><i></i><span data-tx="starHot"></span>';
    gColor.appendChild(dom.starLegend);

    // ---- Diagramm
    const main = el('main', 'atlas-main');
    dom.chart = el('div', 'atlas-chart');
    dom.base = el('canvas', 'atlas-canvas');
    dom.overlay = el('canvas', 'atlas-canvas atlas-canvas-top');
    dom.overlay.tabIndex = 0;
    dom.tip = el('div', 'atlas-tip');
    dom.tip.hidden = true;
    // Zoom zurücksetzen: Symbolknopf in der freien Ecke unten rechts, außerhalb
    // der Zeichenfläche. Symbol: vier Pfeile von der Mitte in die Ecken.
    dom.homeBtn = button('atlas-home', '', () => flyTo(home[state.view], 600));
    dom.homeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H4v5M4 4l6 6M15 4h5v5M20 4l-6 6M9 20H4v-5M4 20l6-6M15 20h5v-5M20 20l-6-6"/></svg><span></span>';
    dom.toast = el('div', 'atlas-toast');
    dom.toast.setAttribute('role', 'status');
    dom.toast.hidden = true;
    dom.chart.append(dom.base, dom.overlay, dom.tip, dom.homeBtn, dom.toast);

    // ---- Zeitleiste
    // Anfangs eingeklappt: nur der Knopf "Zeitleiste" und das Jahr.
    const time = el('div', 'atlas-time');
    dom.time = time;
    dom.timeBtn = button('atlas-time-toggle', '', () => { timeOpen = !timeOpen; syncControls(); });
    dom.timeLabel = el('span');
    dom.timeBtn.append(dom.timeLabel, el('i', 'atlas-more-chevron'));
    dom.timeBtn.setAttribute('aria-controls', 'atlas-track');
    dom.playBtn = button('atlas-play', '', togglePlay);
    const timeLeft = el('div', 'atlas-time-left');
    timeLeft.append(dom.timeBtn, dom.playBtn);
    const track = el('div', 'atlas-track');
    track.id = 'atlas-track';
    dom.track = track;
    dom.markerLayer = el('div', 'atlas-markers');
    const bars = el('div', 'atlas-bars');
    bars.setAttribute('aria-hidden', 'true');
    dom.yearBars = [];
    for (let y = minYear; y <= maxYear; y++) {
      const bar = el('i');
      bars.appendChild(bar);
      dom.yearBars.push(bar);
    }
    dom.yearInput = el('input', 'atlas-year');
    dom.yearInput.type = 'range';
    dom.yearInput.min = minYear; dom.yearInput.max = maxYear; dom.yearInput.step = 1; dom.yearInput.value = maxYear;
    dom.yearInput.addEventListener('input', () => { stopPlay(); state.yearMax = Number(dom.yearInput.value); applyFilters(); syncControls(); });
    const ticks = el('div', 'atlas-ticks');
    for (let y = Math.ceil(minYear / 5) * 5; y <= maxYear; y += 5) {
      const t = el('span', '', String(y));
      t.style.left = ((y - minYear + 0.5) / (maxYear - minYear + 1) * 100) + '%';
      ticks.appendChild(t);
    }
    track.append(dom.markerLayer, bars, dom.yearInput, ticks);
    dom.yearLabel = el('div', 'atlas-year-label');
    time.append(timeLeft, track, dom.yearLabel);
    main.append(dom.chart, time);

    // ---- Infofeld rechts
    dom.panel = el('aside', 'atlas-panel');
    dom.panelHead = el('div', 'atlas-panel-head');   // Blättern und Schließen; steht fest über dem Inhalt
    dom.panelHead.hidden = true;
    dom.panelBody = el('div', 'atlas-panel-body');
    dom.foot = el('p', 'atlas-foot');
    dom.panel.append(dom.panelHead, dom.panelBody, dom.foot);

    root.append(head, side, main, dom.panel);
    buildMarkers();
  }

  // Marken der Berichte auf der Zeitleiste; eng beieinander liegende werden
  // gestapelt.
  function buildMarkers() {
    dom.markerLayer.replaceChildren();
    dom.markers = [];
    const span = maxYear - minYear + 1;
    const rows = [];   // je Zeile: letzte belegte Position in %
    const MIN_GAP = 0.92;
    for (const s of stories) {
      const x = clamp((s.t - minYear) / span * 100, 0.4, 99.6);
      let row = 0;
      while (rows[row] !== undefined && x - rows[row] < MIN_GAP) row++;
      rows[row] = x;
      const b = button('atlas-marker', '', () => selectStory(s, true));
      b.tabIndex = -1;   // per Tastatur erreicht man die Berichte über die Kacheln
      b.style.left = x + '%';
      b.style.bottom = (row * 11) + 'px';
      const main = s.main[0];
      b.style.setProperty('--c', main ? TYPES[main.ti].glow : '#c9cfe8');
      const peek = (on) => { if (!pinned) { hlStory = on ? s : null; overlayDirty = true; schedule(); } };
      b.addEventListener('pointerenter', () => peek(true));
      b.addEventListener('pointerleave', () => peek(false));
      b.addEventListener('focus', () => peek(true));
      b.addEventListener('blur', () => peek(false));
      dom.markerLayer.appendChild(b);
      dom.markers.push({ el: b, story: s });
    }
    dom.markerLayer.style.height = (Math.max(1, rows.length) * 11 + 4) + 'px';
    const label = el('span', 'atlas-markers-label');
    label.dataset.tx = 'stories';
    dom.markerLayer.appendChild(label);
  }

  function txPath(path) { return path.split('.').reduce((o, k) => o[k], tx); }

  // Logo und Links der einbettenden Website; folgt der Sprache.
  function renderSite() {
    const site = config.site;
    dom.site.replaceChildren();
    if (site.logo && safeUrl(site.logo.src)) {
      const img = el('img');
      img.src = safeUrl(site.logo.src);
      img.alt = localized(site.logo.alt);
      img.decoding = 'async';
      const href = safeUrl(site.logo.href);
      if (href) {
        const a = el('a', 'atlas-site-logo');
        a.href = href;
        a.appendChild(img);
        dom.site.appendChild(a);
      } else {
        const box = el('span', 'atlas-site-logo');
        box.appendChild(img);
        dom.site.appendChild(box);
      }
    }
    const links = (Array.isArray(site.links) ? site.links : []).filter((l) => l && localized(l.text) && safeUrl(l.href));
    if (links.length) {
      const nav = el('nav', 'atlas-site-links');
      links.forEach((l) => {
        const a = el('a', '', localized(l.text));
        a.href = safeUrl(l.href);
        nav.appendChild(a);
      });
      dom.site.appendChild(nav);
    }
  }

  function syncControls() {
    document.documentElement.lang = lang;
    if (config.setTitle !== false) document.title = tx.title;
    dom.titleText.textContent = tx.title;
    dom.version.title = 'Version ' + VERSION;
    dom.sysGroup.hidden = state.view !== 'sys';
    dom.root.querySelectorAll('[data-tx]').forEach((n) => { n.textContent = tx[n.dataset.tx]; });
    dom.root.querySelectorAll('[data-tx-path]').forEach((n) => { n.textContent = txPath(n.dataset.txPath); });
    dom.presetButtons.forEach((b) => {
      b.textContent = tx.presets[b.dataset.preset];
      b.title = tx.presetHint[b.dataset.preset];
      b.setAttribute('aria-pressed', String(matchesPreset(b.dataset.preset)));
    });
    dom.search.placeholder = tx.search;
    dom.search.setAttribute('aria-label', tx.search);
    const otherLang = lang === 'de' ? 'en' : 'de';
    dom.langBtn.textContent = otherLang === 'en' ? 'English' : 'Deutsch';
    dom.langBtn.title = tx.language;
    if (dom.langBtn.tagName === 'A') {
      const target = safeUrl(config.langUrls[otherLang]);
      if (target) { dom.langBtn.href = target; dom.langBtn.hreflang = otherLang; dom.langBtn.lang = otherLang; }
      else dom.langBtn.removeAttribute('href');
    }
    if (dom.site) renderSite();
    const full = !!fullscreenElement();
    dom.fullBtn.title = full ? tx.exitFullscreen : tx.fullscreen;
    dom.fullBtn.setAttribute('aria-label', dom.fullBtn.title);
    dom.fullBtn.setAttribute('aria-pressed', String(full));
    dom.typeRows.forEach((r, i) => {
      r.b.setAttribute('aria-checked', String(state.types[i]));
      r.dot.style.background = state.colorBy === 'type' ? TYPES[i].glow : '';
    });
    dom.methodRows.forEach((r, i) => {
      r.b.setAttribute('aria-checked', String(state.methods[i]));
      r.dot.style.background = state.colorBy === 'method' ? METHODS[i].glow : '';
    });
    dom.starLegend.hidden = state.colorBy !== 'star';
    // "Weitere Filter": Zustand und Hinweis, wenn darin etwas vom Standard abweicht.
    const moreChanged = !state.methods.every(Boolean) || !state.estMass || !state.estPeriod || state.storiesOnly || state.multiOnly;
    dom.more.hidden = !moreOpen;
    dom.moreBtn.setAttribute('aria-expanded', String(moreOpen));
    dom.moreLabel.textContent = tx.moreGroup;
    dom.moreBadge.textContent = moreChanged ? tx.moreActive : '';
    dom.root.querySelectorAll('[data-tx-title]').forEach((n) => { n.title = tx[n.dataset.txTitle]; });
    dom.hzButtons.forEach((o) => { o.b.title = tx.hzHints[o.value]; });
    dom.viewButtons.forEach((o) => { o.b.title = tx.viewHints[o.value]; });
    dom.syncers.forEach((f) => f());
    dom.yearInput.value = state.yearMax;
    dom.yearInput.setAttribute('aria-label', tx.timeline);
    dom.yearLabel.textContent = tx.timeline + ' ' + state.yearMax;
    dom.playBtn.textContent = (playTimer ? '❚❚ ' + tx.pause : '▶ ' + tx.play);
    dom.time.classList.toggle('is-collapsed', !timeOpen);
    dom.playBtn.hidden = dom.track.hidden = !timeOpen;
    dom.timeLabel.textContent = tx.timeToggle;
    dom.timeBtn.title = timeOpen ? tx.timeHide : tx.timeShow;
    dom.timeBtn.setAttribute('aria-expanded', String(timeOpen));
    dom.homeBtn.title = tx.resetView;
    dom.homeBtn.setAttribute('aria-label', tx.resetView);
    dom.homeBtn.querySelector('span').textContent = tx.resetShort;
    dom.overlay.setAttribute('aria-label', tx.title);
    dom.markers.forEach((m) => {
      const text = dateText(m.story.date) + ': ' + (m.story.title[lang] || m.story.title.de);
      m.el.setAttribute('aria-label', text);
      m.el.title = text;
    });
    dom.foot.replaceChildren(tx.footData);
    const link = el('a', '', 'exoplanet.eu');
    link.href = 'https://exoplanet.eu/catalog/'; link.target = '_blank'; link.rel = 'noopener';
    dom.foot.append(link, tx.footText(tx.date(String(window.EXOPLANET_DATA.fetched)), int(counts.total), int(counts.est), int(counts.comp)));
  }

  function setLang(next) {
    lang = TEXT[next] ? next : 'de';
    tx = TEXT[lang];
    try { localStorage.setItem('atlas-lang', lang); } catch (e) { /* ohne Speicher geht es auch */ }
    dom.root.setAttribute('lang', lang);
    syncControls();
    applyFilters();
    renderPanel();
    staticDirty = true;
    schedule();
  }

  // Kurze Meldung über dem Diagramm, die von selbst wieder verschwindet.
  let toastTimer = 0;
  function toast(text) {
    dom.toast.textContent = text;
    dom.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 6000);
  }
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  function toggleFullscreen() {
    const root = document.documentElement;
    if (fullscreenElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    // In eingebetteten Vorschauen (Rahmen ohne Erlaubnis) ist Vollbild gesperrt.
    if (!request || document.fullscreenEnabled === false) { toast(tx.fullscreenBlocked); return; }
    let result;
    try { result = request.call(root); } catch (e) { toast(tx.fullscreenBlocked); return; }
    if (result && result.catch) result.catch(() => toast(tx.fullscreenBlocked));
    // Meldet der Browser nach kurzer Zeit kein Vollbild, hat es nicht geklappt.
    setTimeout(() => { if (!fullscreenElement()) toast(tx.fullscreenBlocked); }, 1200);
  }

  // Zeitraffer: das Jahr läuft vom ersten bis zum letzten Fund.
  function stopPlay() {
    if (!playTimer) return;
    clearInterval(playTimer);
    playTimer = 0;
    if (dom.playBtn) dom.playBtn.textContent = '▶ ' + tx.play;
  }
  function togglePlay() {
    if (playTimer) { stopPlay(); return; }
    if (state.yearMax >= maxYear) state.yearMax = minYear;
    playTimer = setInterval(() => {
      if (state.yearMax >= maxYear) { stopPlay(); syncControls(); return; }
      state.yearMax++;
      applyFilters();
      syncControls();
    }, 260);
    applyFilters();
    syncControls();
  }

  // ------------------------------------------------------------------ Suche
  function searchMatches(q) {
    const n = normName(q);
    if (n.length < 2) return [];
    const starts = [], contains = [];
    for (const body0 of SOLAR) {
      if (normName(tx.planets[body0.key]).startsWith(n)) starts.push({ solar: body0 });
    }
    // Systeme: das Sonnensystem und Sterne mit mehreren Planeten (höchstens zwei Treffer).
    const sysHits = [];
    if (normName(tx.solarSystem).startsWith(n)) sysHits.push({ isSystem: true, sys: SUN });
    for (const sys of multiSystems) {
      if (sysHits.length >= 2) break;
      if (normName(sys.name).startsWith(n)) sysHits.push({ isSystem: true, sys: sys });
    }
    for (const p of points) {
      const k = normName(p.name);
      if (k.startsWith(n)) starts.push(p); else if (k.indexOf(n) >= 0) contains.push(p);
      if (starts.length >= 8) break;
    }
    return sysHits.concat(starts, contains).slice(0, 8);
  }
  function renderSearch() {
    const list = searchMatches(dom.search.value);
    dom.searchList.replaceChildren();
    if (!dom.search.value.trim()) { dom.searchList.hidden = true; return; }
    if (!list.length) dom.searchList.appendChild(el('div', 'atlas-search-none', tx.noMatch));
    list.forEach((p, i) => {
      const done = () => { dom.search.value = ''; dom.searchList.hidden = true; };
      const b = button('atlas-search-item' + (i === 0 ? ' is-first' : ''), '', () => {
        if (p.isSystem) selectSystem(p.sys, true); else if (p.solar) selectSolar(p.solar, true); else selectPlanet(p, true);
        done();
      });
      const dot = el('i', 'atlas-dot');
      if (p.isSystem) {
        dot.classList.add('atlas-dot-star');
        dot.style.background = p.sys.solar ? '#ffd76a' : teffColor(p.sys.teff);
        b.append(dot, el('span', '', sysName(p.sys)), el('span', 'atlas-search-type', tx.sysSearch(p.sys.planets.length)));
      } else if (p.solar) {
        dot.classList.add('atlas-dot-solar');
        b.append(dot, el('span', '', tx.planets[p.solar.key]), el('span', 'atlas-search-type', tx.solarGroup));
      } else {
        dot.style.background = TYPES[p.ti].glow;
        b.append(dot, el('span', '', p.name), el('span', 'atlas-search-type', tx.types[TYPES[p.ti].key]));
      }
      dom.searchList.appendChild(b);
    });
    dom.searchList.hidden = false;
  }

  // ---------------------------------------------------------------- Auswahl
  // Systemansicht: hat das System nur wegen der Mindestzahl keine Zeile, wird
  // die Mindestzahl gesenkt.
  function ensureRow(sys) {
    const n = sys.planets.length;
    if (state.view !== 'sys' || sys.solar || sys.row >= 0 || n < 4 || n >= state.sysMin) return;
    state.sysMin = n;
    applyFilters();
    syncControls();
  }
  function selectPlanet(p, fly) {
    ensureRow(p.sys);
    if ((!p.vis && !p.ghost) || !p.pos[state.view]) {
      // Ausgeblendete Planeten: Filter öffnen, damit die Auswahl sichtbar wird.
      openFilters();
      applyFilters();
      if (!p.pos[state.view]) setView('mp');
      syncControls();
    }
    pinned = { kind: 'planet', p: p, storyIndex: 0 };
    hlStory = null;
    show(pinned);
    revealPanel();
    if (fly) {
      const q = p.pos[state.view];
      const sys = p.system.length > 1 && p.system.length < 10 ? p.system : [p];
      if (q) flyToPoints(sys, 800);
    }
    overlayDirty = true;
    schedule();
  }
  function selectStory(story, fly) {
    pinned = { kind: 'story', story: story };
    hlStory = story;
    if (story.points.length && story.points.some((p) => !p.vis || !p.pos[state.view])) {
      state.types = TYPES.map(() => true); state.methods = METHODS.map(() => true);
      state.hz = 'all'; state.maxDist = null; state.multiOnly = false; state.estMass = state.estPeriod = true;
      stopPlay(); state.yearMax = maxYear;
      if (state.tags && !story.tags.some((t) => state.tags.indexOf(t) >= 0)) { state.tags = null; }
      applyFilters();
      if (story.points.some((p) => !p.pos[state.view])) setView('mp');
      syncControls();
    }
    show(pinned);
    revealPanel();
    if (fly && story.points.length) flyToPoints(story.points, 900);
    overlayDirty = true;
    schedule();
  }
  // Liegt das Infofeld unter dem Diagramm (schmale Bildschirme), nach einer
  // Auswahl dorthin scrollen.
  function revealPanel() {
    if (!window.matchMedia('(max-width: 980px)').matches) return;
    dom.panel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }
  function selectSolar(body0, fly) {
    pinned = { kind: 'solar', s: body0 };
    hlStory = null;
    show(pinned);
    revealPanel();
    if (fly) flyToPoints([body0], 800);
    overlayDirty = true;
    schedule();
  }
  function selectSystem(sys, fly) {
    ensureRow(sys);
    pinned = { kind: 'system', sys: sys };
    hlStory = null;
    syncControls();
    show(pinned);
    revealPanel();
    if (fly && sys.planets.some((q) => q.pos[state.view])) flyToPoints(sys.planets, 900);
    overlayDirty = true;
    schedule();
  }
  function unpin() {
    returnStory = shown ? lastStory : null;   // die Übersicht zeigt gleich dessen Kachel
    pinned = null; hlStory = null;
    show(null);
    overlayDirty = true;
    schedule();
  }
  function stepStory(delta) {
    const visible = stories.filter(storyVisible);
    if (!visible.length) return;
    const current = shown && (shown.kind === 'story' ? shown.story : (shown.kind === 'planet' && shown.p.stories[shown.storyIndex || 0]));
    let i = current ? visible.indexOf(current) : (delta > 0 ? -1 : 0);
    i = (i + delta + visible.length) % visible.length;
    selectStory(visible[i], true);
  }

  // =============================================================== Infofeld
  const snippetCache = new Map();
  // Holt den Inhalt des Berichts aus dem Text der Datei. Adressen von
  // Bildern und Links gelten relativ zur Datei und werden ausgeschrieben.
  function parseSnippet(text, url) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const article = doc.querySelector('.exo-story');
    if (!article) throw new Error('format');
    article.querySelectorAll('script').forEach((n) => n.remove());
    article.querySelectorAll('img[src]').forEach((n) => n.setAttribute('src', new URL(n.getAttribute('src'), url).href));
    article.querySelectorAll('a[href]').forEach((n) => n.setAttribute('href', new URL(n.getAttribute('href'), url).href));
    return article.innerHTML;
  }
  // Lädt discoveries/<sprache>/<id>.html. Über einen Webserver direkt; ohne
  // Server (file://, dort ist fetch gesperrt) in einem unsichtbaren Rahmen:
  // das Skript snippet.js in der Datei schickt den Inhalt als Nachricht zurück.
  function loadSnippet(id, language) {
    const key = language + '/' + id;
    if (snippetCache.has(key)) return snippetCache.get(key);
    const url = new URL(assetBase() + 'atlas/discoveries/' + language + '/' + id + '.html', document.baseURI).href;
    const viaFrame = () => new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.className = 'atlas-loader';
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      let done = false;
      const finish = (fn, value) => {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMessage);
        clearTimeout(timer);
        frame.remove();
        fn(value);
      };
      function onMessage(event) {
        if (event.source !== frame.contentWindow) return;
        const d = event.data;
        if (!d || d.exoSnippet !== true || typeof d.html !== 'string') return;
        finish(resolve, d.html);
      }
      const timer = setTimeout(() => finish(reject, new Error('timeout')), 8000);
      window.addEventListener('message', onMessage);
      frame.addEventListener('error', () => finish(reject, new Error('load')));
      frame.src = url;
      document.body.appendChild(frame);
    });
    const promise = /^https?:$/.test(location.protocol)
      ? fetch(url).then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
        .then((text) => parseSnippet(text, url)).catch(viaFrame)
      : viaFrame();
    snippetCache.set(key, promise);
    promise.catch(() => snippetCache.delete(key));
    return promise;
  }

  function show(target) {
    shown = target;
    renderPanel();
  }

  function factRows(p) {
    const rows = [];
    const f = tx.facts;
    rows.push([f.type, tx.types[TYPES[p.ti].key], TYPES[p.ti].glow]);
    const mj = p.massE / EARTH_PER_JUPITER;
    rows.push([f.mass + (p.estMass ? ' (' + tx.estimatedShort + ')' : ''),
      p.massE < 100 ? num(p.massE) + tx.earthMasses : num(mj) + tx.jupiterMasses, null, p.estMass ? tx.estimated : '']);
    if (p.radiusE !== null) rows.push([f.radius, p.radiusE > 6 ? num(p.radiusE / RE_PER_RJ) + tx.jupiterRadii : num(p.radiusE) + tx.earthRadii]);
    else if (p.estRadius) rows.push([f.radius + ' (' + tx.estimatedShort + ')', num(p.plotRadius, 2) + tx.earthRadii, null, tx.estimatedRadius]);
    rows.push([f.period + (p.estPeriod ? ' (' + tx.computedShort + ')' : ''), periodShort(p.period), null, p.estPeriod ? tx.computed : '']);
    if (p.axis) rows.push([f.axis, num(p.axis) + tx.au]);
    if (p.flux !== null) rows.push([f.flux, num(p.flux) + tx.timesEarth, null, num(p.flux * SOLAR_CONSTANT) + ' W/m²']);
    rows.push([f.hz, tx.hzClass[p.hz]]);
    if (p.esi !== null && p.plotRadius < 2.5) rows.push([f.esi, num(p.esi, 2), null, tx.esiNote]);
    const star = [p.sp, p.teff ? int(Math.round(p.teff)) + tx.kelvin : ''].filter(Boolean).join(', ');
    if (star) rows.push([f.star, star, teffColor(p.teff)]);
    if (p.distLy !== null) rows.push([f.dist, num(p.distLy) + tx.ly]);
    rows.push([f.found, (p.year === null ? '–' : String(p.year)) + ', ' + tx.methods[METHODS[p.mi].key]]);
    return rows;
  }
  function factTable(p) {
    const box = el('dl', 'atlas-facts');
    for (const r of factRows(p)) {
      const cell = el('div', 'atlas-fact');
      const dd = el('dd');
      if (r[2]) { const dot = el('i', 'atlas-dot'); dot.style.background = r[2]; dd.appendChild(dot); }
      dd.append(r[1]);
      if (r[3]) cell.title = r[3];
      cell.append(el('dt', '', r[0]), dd);
      box.appendChild(cell);
    }
    return box;
  }

  // Passt der Inhalt nicht ohne Scrollen ins Infofeld, wird er stufenweise
  // verdichtet: erst weniger Werte im Steckbrief, dann ein kleineres Bild.
  const FIT_STEPS = ['fit-1', 'fit-2', 'fit-3', 'fit-4'];
  function fitPanel() {
    const body = dom.panelBody;
    FIT_STEPS.forEach((c) => body.classList.remove(c));
    const more = body.querySelector('.atlas-more');
    if (more) more.hidden = true;
    for (const step of FIT_STEPS) {
      if (body.scrollHeight <= body.clientHeight + 1) break;
      body.classList.add(step);
      if (more) more.hidden = false;   // der Steckbrief ist jetzt gekürzt
    }
  }

  // Berichte, die zu den aktuellen Filtern gehören, älteste zuerst. Ohne
  // Filter alle; sonst nur die, deren Planeten gerade zu sehen sind.
  function listedStories() {
    const unfiltered = points.every((p) => p.vis);
    return stories.filter((s) => storyVisible(s) && (unfiltered || s.points.some((p) => p.vis)));
  }

  // Cursortasten in den Kacheln: links/rechts zur Nachbarkachel, hoch/runter
  // zur Zeile darüber bzw. darunter, Pos1/Ende zur ersten bzw. letzten.
  function galleryKey(event) {
    const grid = event.currentTarget;
    const tiles = Array.from(grid.children);
    const i = tiles.indexOf(document.activeElement);
    if (i < 0) return;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[event.key];
    let j = step !== undefined ? i + step : event.key === 'Home' ? 0 : event.key === 'End' ? tiles.length - 1 : -1;
    if (j < 0 || j >= tiles.length || j === i) { if (step !== undefined) event.preventDefault(); return; }
    event.preventDefault();
    event.stopPropagation();
    tiles[j].focus();
    tiles[j].scrollIntoView({ block: 'nearest' });
  }

  // Baut den Rahmen für einen Bericht und lädt dessen Inhalt nach.
  function storyHolder(story, compact, token) {
    const holder = el('div', 'atlas-story' + (compact ? ' is-compact' : ''));
    const content = el('div', 'atlas-story-content');
    const skeleton = el('div', 'atlas-skeleton');
    if (story.date) skeleton.appendChild(el('p', 'date', dateText(story.date)));
    skeleton.append(el('h2', '', story.title[lang] || story.title.de), el('p', 'atlas-loading', tx.loading));
    content.appendChild(skeleton);
    holder.appendChild(content);
    loadSnippet(story.id, lang).then((html) => {
      if (token !== panelToken) return;
      content.innerHTML = html;
      content.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
      const dateEl = content.querySelector('.date');
      if (dateEl && story.date) dateEl.textContent = dateText(story.date);
      // Lange Quellenlisten einklappen, damit der Bericht ohne Scrollen passt.
      const sources = content.querySelector('.sources');
      const count = sources ? sources.querySelectorAll('a').length : 0;
      if (count > 3) {
        const fold = el('details', 'atlas-sources');
        fold.appendChild(el('summary', '', tx.sourcesN(count)));
        sources.replaceWith(fold);
        fold.appendChild(sources);
      }
      fitPanel();
    }).catch(() => {
      if (token !== panelToken) return;
      skeleton.querySelector('.atlas-loading').textContent = tx.loadError;
    });
    return holder;
  }
  // Saturn für die Leiste im Infofeld: Kugel mit geneigtem Ringband. Die
  // hintere Ringhälfte liegt hinter der Kugel, die vordere davor; zwischen
  // Kugel und Ring bleibt eine Lücke, im Ring die Cassini-Teilung.
  function saturnSvg(diameter) {
    const k = diameter / 12;   // die Kugel hat in der Zeichnung den Radius 6
    const band = 'M-13 0a13 4.3 0 1 0 26 0a13 4.3 0 1 0-26 0ZM-8.4 0a8.4 2.5 0 1 1 16.8 0a8.4 2.5 0 1 1-16.8 0Z';
    const gap = '<ellipse rx="11.1" ry="3.55" class="atlas-ring-gap"/>';
    return '<svg viewBox="-15 -9 30 18" width="' + (30 * k).toFixed(1) + '" height="' + (18 * k).toFixed(1) + '" aria-hidden="true">' +
      '<defs><clipPath id="atlas-ring-back"><rect x="-15" y="-9" width="30" height="9"/></clipPath>' +
      '<clipPath id="atlas-ring-front"><rect x="-15" y="0" width="30" height="9"/></clipPath></defs>' +
      '<g transform="rotate(-20)">' +
      '<g clip-path="url(#atlas-ring-back)"><path class="atlas-ring" fill-rule="evenodd" d="' + band + '"/>' + gap + '</g>' +
      '<circle r="6" class="atlas-ring-disc"/>' +
      '<g clip-path="url(#atlas-ring-front)"><path class="atlas-ring" fill-rule="evenodd" d="' + band + '"/>' + gap + '</g>' +
      '</g></svg>';
  }
  // Steckbrief eines Planeten des Sonnensystems.
  function solarFacts(s) {
    const f = tx.facts, rows = [];
    // Genau 1 (Erde, Jupiter): Einzahl, z. B. "1 Erdmasse".
    const qty = (v, unit) => num(v) + (num(v) === '1' ? tx.one[unit] : tx[unit]);
    rows.push([f.type, tx.types[TYPES[s.ti].key], TYPES[s.ti].glow]);
    rows.push([f.mass, s.m < 100 ? qty(s.m, 'earthMasses') : qty(s.m / EARTH_PER_JUPITER, 'jupiterMasses')]);
    rows.push([f.radius, s.r > 6 ? qty(s.r / RE_PER_RJ, 'jupiterRadii') : qty(s.r, 'earthRadii')]);
    rows.push([f.period, periodShort(s.p)]);
    rows.push([tx.sunDistance, num(s.a) + tx.au]);
    if (s.story && s.story.moons !== null) {
      rows.push([tx.moons, s.story.moons === 0 ? tx.noMoons : int(s.story.moons), null, s.story.moonsAsOf ? tx.asOf(dateText(s.story.moonsAsOf)) : '']);
    }
    rows.push([f.flux, num(s.s) + tx.timesEarth, null, num(s.s * SOLAR_CONSTANT) + ' W/m²']);
    rows.push([f.hz, tx.hzClass[s.hz]]);
    if (s.r < 2.5) rows.push([f.esi, num(s.esi, 2), null, tx.esiNote]);
    const box = el('dl', 'atlas-facts');
    for (const r of rows) {
      const cell = el('div', 'atlas-fact');
      const dd = el('dd');
      if (r[2]) { const dot = el('i', 'atlas-dot'); dot.style.background = r[2]; dd.appendChild(dot); }
      dd.append(r[1]);
      if (r[3]) cell.title = r[3];
      cell.append(el('dt', '', r[0]), dd);
      box.appendChild(cell);
    }
    return box;
  }

  // Zelle für eine Wertetabelle (wie im Steckbrief).
  function factCell(label, value, color, note) {
    const cell = el('div', 'atlas-fact');
    const dd = el('dd');
    if (color) { const dot = el('i', 'atlas-dot'); dot.style.background = color; dd.appendChild(dot); }
    dd.append(value);
    if (note) cell.title = note;
    cell.append(el('dt', '', label), dd);
    return cell;
  }
  // Größe eines Planeten in Worten: der Radius, wo er gemessen ist, sonst die Masse.
  function sizeText(q) {
    const r = q.isSolar ? q.r : q.radiusE, m = q.isSolar ? q.m : q.massE;
    if (r !== null && r !== undefined) return r > 6 ? num(r / RE_PER_RJ) + tx.jupiterRadii : num(r) + tx.earthRadii;
    return m < 100 ? num(m) + tx.earthMasses : num(m / EARTH_PER_JUPITER) + tx.jupiterMasses;
  }
  function selectBody(q, fly) { if (q.isSolar) selectSolar(q, fly); else selectPlanet(q, fly); }
  // Schematische Leiste eines Planetensystems: links der Stern, rechts davon
  // die Planeten nach ihrer Umlaufzeit (logarithmisch), dahinter die
  // habitable Zone, gestrichelt die freien Plätze der Reihe. current: der gerade
  // gezeigte Planet (dann führt ein Klick auf den Stern zum System).
  function systemStrip(sys, current, big) {
    const box = el('div', 'atlas-sys-strip' + (big ? ' is-big' : ''));
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', tx.sysStrip(sysName(sys)));
    const star = current ? button('atlas-sys-star', '', () => selectSystem(sys, true)) : el('i', 'atlas-sys-star');
    star.style.setProperty('--c', sys.solar ? '#ffd76a' : teffColor(sys.teff));
    star.style.setProperty('--d', Math.round(clamp(14 + 7 * log10(sys.starR || 1), 9, 22)) + 'px');
    if (current) { star.title = tx.sysStar; star.setAttribute('aria-label', tx.sysStar); }
    const track = el('div', 'atlas-sys-track');
    let lo = log10(sys.planets[0].period), hi = log10(sys.planets[sys.planets.length - 1].period);
    if (sys.hz) {
      // Die habitable Zone gehört ins Bild, solange sie nicht weit abseits liegt.
      lo = Math.min(lo, Math.max(log10(sys.hz.o0.p), lo - 1.2));
      hi = Math.max(hi, Math.min(log10(sys.hz.o1.p), hi + 1.2));
    }
    const pad = Math.max(0.05, (hi - lo) * 0.04);
    lo -= pad; hi += pad;
    const at = (period) => clamp((log10(period) - lo) / (hi - lo) * 100, 0, 100);
    if (sys.hz) {
      for (const part of [['o0', 'o1', ''], ['c0', 'c1', ' is-core']]) {
        const a = at(sys.hz[part[0]].p), b = at(sys.hz[part[1]].p);
        if (b - a < 0.6) continue;
        const band = el('i', 'atlas-sys-hz' + part[2]);
        band.style.left = a + '%'; band.style.width = (b - a) + '%';
        band.title = tx.hzGroup;
        track.appendChild(band);
      }
    }
    track.appendChild(el('i', 'atlas-sys-line'));
    if (state.gaps && sys.fit) {
      for (const gap of sys.fit.gaps) {
        const mark = el('i', 'atlas-sys-gap');
        mark.style.left = at(gap.period) + '%';
        mark.title = tx.gapTitle + ': ' + tx.gapAt(periodShort(gap.period)) + ' (' + tx.gapNote + ')';
        track.appendChild(mark);
      }
    }
    sys.planets.forEach((q) => {
      const b = button('atlas-sys-planet' + (q === current ? ' is-current' : ''), '', () => selectBody(q, q.isSolar));
      b.style.left = at(q.period) + '%';
      const d = q.plotRadius ? 5.5 + 4.2 * log10(Math.max(0.3, q.plotRadius) * 10) : 4 + TYPES[q.ti].size * 3;
      b.style.setProperty('--d', Math.round(d * (big ? 1.2 : 1)) + 'px');
      b.style.setProperty('--c', TYPES[q.ti].glow);
      const text = bodyName(q) + ': ' + tx.types[TYPES[q.ti].key] + ', ' + periodShort(q.period);
      b.title = text;
      b.setAttribute('aria-label', text);
      if (q === current) b.setAttribute('aria-current', 'true');
      const letter = shortName(q);
      if (letter && letter.length <= 2) b.appendChild(el('span', '', letter));
      const peek = (on) => { hover = on ? (q.isSolar ? { kind: 'solar', s: q } : { kind: 'planet', p: q }) : null; overlayDirty = true; schedule(); };
      b.addEventListener('pointerenter', () => peek(true));
      b.addEventListener('pointerleave', () => peek(false));
      track.appendChild(b);
    });
    box.append(star, track);
    return box;
  }
  // Abweichung in Prozent mit Vorzeichen, z. B. "+12 %".
  function percentText(v) {
    const text = num(Math.abs(v), 2);
    return (text === '0' ? '' : v > 0 ? '+' : '−') + text + (lang === 'de' ? '\u00a0%' : '%');   // geschütztes Leerzeichen: kein Umbruch vor dem Prozentzeichen
  }
  // Diagramm zur Titius-Bode-Reihe eines Systems. Oben: Umlaufzeit
  // (logarithmisch) über dem Platz n; die Reihe ist dort eine Gerade.
  // Unten: Abweichung jedes Planeten von der Reihe in Prozent. Das graue Band
  // reicht bis zum halben Weg zum Nachbarplatz; dort läge auch ein Planet an
  // beliebiger Stelle, es ist der Maßstab für "gut" oder "schlecht".
  function tbChart(sys) {
    const fit = sys.fit, NS = 'http://www.w3.org/2000/svg';
    const node = (tag, attrs, text) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      if (text !== undefined) n.textContent = text;
      return n;
    };
    const Wc = 400, L = 40, R = 8, topY = 16, topH = 92, botY = 132, botH = 54, Hc = 202;
    const svg = node('svg', { viewBox: '0 0 ' + Wc + ' ' + Hc, class: 'atlas-tb-chart', role: 'img', 'aria-label': tx.tb.chartLabel });
    const last = fit.ns[fit.ns.length - 1];
    const xOf = (n) => L + (n - 0.5) / last * (Wc - L - R);
    const model = (n) => fit.p0 * Math.exp(fit.b * n);
    const pts = sys.planets.map((q, i) => ({ q: q, n: fit.ns[i], dev: (q.period / model(fit.ns[i]) - 1) * 100 }));

    // ---- oben: Umlaufzeit je Platz
    let lo = Math.min(log10(model(0.5)), log10(sys.planets[0].period)), hi = Math.max(log10(model(last + 0.5)), log10(sys.planets[sys.planets.length - 1].period));
    const padY = (hi - lo) * 0.06; lo -= padY; hi += padY;
    const yOf = (lp) => topY + topH - (lp - lo) / (hi - lo) * topH;
    svg.appendChild(node('rect', { x: L, y: topY, width: Wc - L - R, height: topH, class: 'atlas-tb-frame' }));
    const ticks = [];
    for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) ticks.push(e);
    if (ticks.length < 3) for (let e = Math.floor(lo); e <= Math.floor(hi); e++) for (const k of [2, 5]) { const v = e + log10(k); if (v >= lo && v <= hi) ticks.push(v); }
    for (const t of ticks) {
      const y = yOf(t);
      svg.appendChild(node('line', { x1: L, x2: Wc - R, y1: y, y2: y, class: 'atlas-tb-grid' }));
      svg.appendChild(node('text', { x: L - 5, y: y + 3.5, 'text-anchor': 'end' }, num(Math.pow(10, t), 2)));
    }
    svg.appendChild(node('text', { x: L, y: topY - 5 }, tx.tb.chartTop));
    svg.appendChild(node('line', { x1: xOf(0.5), y1: yOf(log10(model(0.5))), x2: xOf(last + 0.5), y2: yOf(log10(model(last + 0.5))), class: 'atlas-tb-line' }));

    // ---- unten: Abweichung in Prozent
    const half = [(Math.exp(-fit.b / 2) - 1) * 100, (Math.exp(fit.b / 2) - 1) * 100];   // halber Weg zum Nachbarplatz
    const reach = Math.max(half[1], Math.max.apply(null, pts.map((p) => Math.abs(p.dev)))) * 1.12;
    const dOf = (d) => botY + botH / 2 - d / reach * (botH / 2);
    svg.appendChild(node('rect', { x: L, y: botY, width: Wc - L - R, height: botH, class: 'atlas-tb-frame' }));
    svg.appendChild(node('rect', { x: L, y: dOf(half[1]), width: Wc - L - R, height: dOf(half[0]) - dOf(half[1]), class: 'atlas-tb-band' }));
    svg.appendChild(node('line', { x1: L, x2: Wc - R, y1: dOf(0), y2: dOf(0), class: 'atlas-tb-zero' }));
    const step = [5, 10, 20, 25, 50, 100, 200].find((v) => v >= reach * 0.55) || 500;
    for (const d of [-step, 0, step]) {
      if (Math.abs(d) > reach) continue;
      svg.appendChild(node('text', { x: L - 5, y: dOf(d) + 3.5, 'text-anchor': 'end' }, percentText(d)));
    }
    svg.appendChild(node('text', { x: L, y: botY - 5 }, tx.tb.chartBottom));
    // Plätze: Beschriftung unten, feine Linie durch beide Teile.
    for (let n = 1; n <= last; n++) {
      svg.appendChild(node('line', { x1: xOf(n), x2: xOf(n), y1: topY, y2: topY + topH, class: 'atlas-tb-grid' }));
      svg.appendChild(node('text', { x: xOf(n), y: botY + botH + 12, 'text-anchor': 'middle' }, String(n)));
    }
    svg.appendChild(node('text', { x: L - 5, y: botY + botH + 12, 'text-anchor': 'end' }, tx.tb.chartX));
    // Freie Plätze: gestrichelte Ringe auf der Reihe.
    for (const gap of fit.gaps) {
      const title = tx.gapTitle + ': ' + tx.gapAt(periodShort(gap.period));
      for (const y of [yOf(log10(gap.period)), dOf(0)]) {
        const ring = node('circle', { cx: xOf(gap.n), cy: y, r: 4, class: 'atlas-tb-gap' });
        ring.appendChild(node('title', {}, title));
        svg.appendChild(ring);
      }
    }
    // Planeten.
    for (const p of pts) {
      const col = TYPES[p.q.ti].glow;
      const title = tx.tb.pointTitle(bodyName(p.q), periodShort(p.q.period), percentText(p.dev));
      svg.appendChild(node('line', { x1: xOf(p.n), x2: xOf(p.n), y1: dOf(0), y2: dOf(p.dev), stroke: col, class: 'atlas-tb-stem' }));
      for (const y of [yOf(log10(p.q.period)), dOf(p.dev)]) {
        const dot = node('circle', { cx: xOf(p.n), cy: y, r: 4, fill: col, class: 'atlas-tb-dot' });
        dot.appendChild(node('title', {}, title));
        svg.appendChild(dot);
      }
    }
    return { svg: svg, worst: pts.reduce((a, b) => (Math.abs(b.dev) > Math.abs(a.dev) ? b : a)) };
  }

  // Infofeld eines Planetensystems.
  function systemCard(sys) {
    const card = el('div', 'atlas-system');
    card.appendChild(el('h2', 'atlas-planet-name atlas-system-name', sysName(sys)));
    card.appendChild(el('p', 'atlas-planet-sub', tx.sysPlanets(sys.planets.length)));
    card.appendChild(systemStrip(sys, null, true));
    const legend = el('p', 'atlas-sys-legend');
    const key = (cls, text) => { const item = el('span'); item.append(el('i', cls), text); legend.appendChild(item); };
    key('atlas-key-star', tx.sysLegend.star);
    if (sys.hz) key('atlas-key-hz', tx.sysLegend.hz);
    if (state.gaps && sys.fit && sys.fit.gaps.length) key('atlas-key-gap', tx.sysLegend.gap);
    card.appendChild(legend);

    const facts = el('dl', 'atlas-facts');
    const starText = [sys.sp, sys.teff ? int(Math.round(sys.teff)) + tx.kelvin : ''].filter(Boolean).join(', ');
    if (starText) facts.appendChild(factCell(tx.facts.star, starText, sys.solar ? '#ffd76a' : teffColor(sys.teff)));
    if (!sys.solar && sys.starM) facts.appendChild(factCell(tx.sysFacts.starMass, num(sys.starM) + tx.sunMasses));
    if (!sys.solar && sys.starR) facts.appendChild(factCell(tx.sysFacts.starRadius, num(sys.starR) + tx.sunRadii));
    if (sys.distLy !== null) facts.appendChild(factCell(tx.facts.dist, num(sys.distLy) + tx.ly));
    if (sys.hz) {
      facts.appendChild(factCell(tx.sysFacts.hzRange, tx.range(num(sys.hz.o0.a, 2), num(sys.hz.o1.a, 2)) + tx.au, null, tx.hzRangeNote));
      const inside = sys.planets.filter((q) => q.hz === 'inner' || q.hz === 'yes' || q.hz === 'outer');
      facts.appendChild(factCell(tx.sysFacts.inHz, inside.length ? inside.map((q) => shortName(q) || bodyName(q)).join(', ') : tx.sysFacts.none));
    }
    card.appendChild(facts);

    card.appendChild(el('h3', 'atlas-system-title', tx.sysList));
    const list = el('div', 'atlas-sys-list');
    sys.planets.forEach((q) => {
      const b = button('atlas-sys-row', '', () => selectBody(q, false));
      const name = el('span', 'atlas-sys-row-name');
      const dot = el('i', 'atlas-dot'); dot.style.background = TYPES[q.ti].glow;
      name.append(dot, shortName(q) || bodyName(q));
      b.title = bodyName(q);
      b.append(name, el('span', '', tx.types[TYPES[q.ti].key]), el('span', '', periodShort(q.period)), el('span', '', sizeText(q)));
      const peek = (on) => { hover = on ? (q.isSolar ? { kind: 'solar', s: q } : { kind: 'planet', p: q }) : null; overlayDirty = true; schedule(); };
      b.addEventListener('pointerenter', () => peek(true));
      b.addEventListener('pointerleave', () => peek(false));
      list.appendChild(b);
    });
    card.appendChild(list);

    // Titius-Bode-Reihe: was die Anpassung ergibt, in Worten.
    const tb = el('section', 'atlas-tb');
    tb.appendChild(el('h3', 'atlas-system-title', tx.tb.title));
    const fit = sys.fit;
    if (fit === undefined) tb.appendChild(el('p', '', tx.tb.few));
    else if (!fit) tb.appendChild(el('p', '', tx.tb.none));
    else {
      let text = tx.tb.fit(num(Math.exp(fit.b), 3), num(fit.r2, 3)) + ' ';
      if (!fit.gaps.length) text += tx.tb.full;
      else {
        const parts = fit.gaps.map((gap) => periodShort(gap.period).trim());
        const listText = parts.length > 1 ? parts.slice(0, -1).join(', ') + tx.tb.and + parts[parts.length - 1] : parts[0];
        text += tx.tb.gaps(fit.gaps.length, listText);
        if (sys.solar) text += ' ' + tx.tb.solar;
      }
      const chart = tbChart(sys);
      text += ' ' + tx.tb.dev(shortName(chart.worst.q) || bodyName(chart.worst.q), percentText(chart.worst.dev));
      tb.appendChild(el('p', '', text));
      tb.appendChild(chart.svg);
      tb.appendChild(el('p', 'atlas-tb-note atlas-tb-chart-note', tx.tb.chartNote));
    }
    if (fit !== undefined) {
      const note = el('p', 'atlas-tb-note', tx.tb.source);
      const link = el('a', '', 'Lara, Cordero-Tercero & Allen (2020)');
      link.href = 'https://arxiv.org/abs/2003.05121'; link.target = '_blank'; link.rel = 'noopener';
      // Gegenprüfung: Huang & Bakos 2014 (MNRAS 442, 674) suchten nach den
      // Vorhersagen von Bovaird & Lineweaver 2013.
      const check = el('a', '', 'Huang & Bakos 2014');
      check.href = 'https://arxiv.org/abs/1405.2259'; check.target = '_blank'; check.rel = 'noopener';
      note.append(link, tx.tb.sourceAfter, check, tx.tb.sourceEnd);
      tb.appendChild(note);
    }
    card.appendChild(tb);
    return card;
  }

  let lastStory = null;      // zuletzt gezeigter Bericht (für die Rückkehr zur Übersicht)
  let returnStory = null;    // Bericht, aus dem man gerade zur Übersicht zurückkehrt
  let returnFocus = false;   // Übersicht wurde per Tastatur geöffnet
  let panelToken = 0;
  function renderPanel() {
    const body = dom.panelBody;
    const token = ++panelToken;
    body.replaceChildren();
    body.scrollTop = 0;
    const bar = dom.panelHead;
    bar.replaceChildren();
    bar.hidden = !shown;
    dom.panel.classList.toggle('is-solar', !!shown && (shown.kind === 'solar' || (shown.kind === 'system' && shown.sys.solar)));
    if (!shown) {
      const box = el('div', 'atlas-guide');
      const active = Object.keys(PRESETS).find((name) => name !== 'all' && matchesPreset(name));
      if (active) {
        // Aktiver Filtersatz: was er zeigt und welche Planeten dazugehören.
        box.appendChild(el('h2', 'atlas-guide-title', tx.presets[active]));
        box.appendChild(el('p', '', tx.presetHint[active]));
        box.appendChild(el('p', '', tx.guideAxes[state.view]));
        const list = points.filter((p) => p.vis && p.pos[state.view]);
        if (list.length && list.length <= 45) {
          const chips = el('div', 'atlas-chips');
          list.sort((a, b) => (b.esi || 0) - (a.esi || 0) || a.name.localeCompare(b.name)).forEach((q) => {
            const b = button('atlas-chip', q.name, () => selectPlanet(q, false));
            if (q.esi !== null) b.title = tx.facts.esi + ': ' + num(q.esi, 2);
            const dot = el('i', 'atlas-dot'); dot.style.background = TYPES[q.ti].glow;
            b.prepend(dot);
            b.addEventListener('pointerenter', () => { hover = { kind: 'planet', p: q }; overlayDirty = true; schedule(); });
            b.addEventListener('pointerleave', () => { hover = null; overlayDirty = true; schedule(); });
            chips.appendChild(b);
          });
          box.appendChild(chips);
        }
      } else {
        box.appendChild(el('h2', 'atlas-guide-title', tx.guideTitle));
        box.appendChild(el('p', '', tx.guide + ' ' + tx.guideAxes[state.view]));
      }
      body.appendChild(box);
      // Unser Sonnensystem: eigene Reihe, von innen nach außen.
      let focusTile = null;
      {
        const boxSolar = el('section', 'atlas-solar-box');
        boxSolar.appendChild(el('h3', 'atlas-solar-title', tx.solarGroup));
        const grid = el('div', 'atlas-solar-grid');
        grid.addEventListener('keydown', galleryKey);
        SOLAR.forEach((body0) => {
          // Rundes Planetenbild mit dem Namen darunter (die Berichte über
          // Exoplaneten haben eckige Kacheln).
          const b = button('atlas-planet-tile', '', () => selectSolar(body0, true));
          const disc = el('span', 'atlas-planet-disc');
          if (body0.story && body0.story.img) {
            disc.style.backgroundImage = 'url("' + assetBase() + 'atlas/images/' + body0.story.img + '")';
            // Ausschnitt so legen, dass die Planetenscheibe den Kreis füllt.
            const t = body0.story.thumb.split(/\s+/);
            if (t.length === 3) { disc.style.backgroundPosition = t[0] + ' ' + t[1]; disc.style.backgroundSize = t[2]; }
          }
          const text = tx.planets[body0.key] + (body0.story ? ': ' + (body0.story.title[lang] || body0.story.title.de) : '');
          b.setAttribute('aria-label', text);
          b.title = text;
          b.append(disc, el('span', 'atlas-planet-tile-name', tx.planets[body0.key]));
          if (body0.story && body0.story === returnStory) focusTile = b;
          const peek = (on) => { hover = on ? { kind: 'solar', s: body0 } : null; overlayDirty = true; schedule(); };
          b.addEventListener('pointerenter', () => peek(true));
          b.addEventListener('pointerleave', () => peek(false));
          b.addEventListener('focus', () => peek(true));
          b.addEventListener('blur', () => peek(false));
          grid.appendChild(b);
        });
        boxSolar.appendChild(grid);
        body.appendChild(boxSolar);
      }
      // Kacheln für alle Berichte, neueste zuerst. Sind Filter aktiv, nur die
      // Berichte, deren Planeten gerade zu sehen sind.
      const list = listedStories().reverse();
      if (list.length) {
        body.appendChild(el('h3', 'atlas-gallery-title', tx.stories));
        body.appendChild(el('p', 'atlas-gallery-hint', tx.tileHint(list.length)));
        const grid = el('div', 'atlas-gallery');
        grid.addEventListener('keydown', galleryKey);
        list.forEach((s) => {
          const b = button('atlas-tile', '', () => selectStory(s, true));
          const main = s.main[0];
          if (s.img) b.style.backgroundImage = 'url("' + assetBase() + 'atlas/images/' + s.img + '")';
          else { b.classList.add('is-plain'); b.style.setProperty('--c', main ? TYPES[main.ti].glow : '#c9cfe8'); }
          const text = dateText(s.date) + ': ' + (s.title[lang] || s.title.de);
          b.setAttribute('aria-label', text);
          b.title = text;
          b.append(el('span', 'atlas-tile-year', s.date.slice(0, 4)), el('span', 'atlas-tile-name', main ? main.name : (s.missing[0] || '')));
          if (s === returnStory) focusTile = b;
          const peek = (on) => { hlStory = on ? s : null; overlayDirty = true; schedule(); };
          b.addEventListener('pointerenter', () => peek(true));
          b.addEventListener('pointerleave', () => peek(false));
          b.addEventListener('focus', () => peek(true));
          b.addEventListener('blur', () => peek(false));
          grid.appendChild(b);
        });
        body.appendChild(grid);
      }
      // Zurück aus einem Bericht: dessen Kachel wieder ins Bild holen; kam
      // man per Tastatur zurück, bekommt sie auch den Fokus.
      if (focusTile) {
        focusTile.scrollIntoView({ block: 'center' });
        if (returnFocus) focusTile.focus({ preventScroll: true });
      }
      returnFocus = false;
      returnStory = null;   // nur einmal: spätere Neuaufbauten beginnen wieder oben
      return;
    }
    // Kopf des Infofelds: rechts immer der sichtbare Rückweg zur Übersicht.
    const closeBtn = button('atlas-tool atlas-close', '✕', () => { unpin(); });
    closeBtn.title = tx.close;
    closeBtn.setAttribute('aria-label', tx.close);
    if (shown.kind === 'system') {
      // Planetensystem: Blättern durch die Zeilen der Ansicht "Planetensysteme".
      const sys = shown.sys, i = sysRows.indexOf(sys);
      if (i >= 0) {
        const nav = (delta, glyph) => {
          const other = sysRows[i + delta];
          const b = button('atlas-tool atlas-nav', glyph, () => selectSystem(other, true));
          b.disabled = !other;
          if (other) { b.title = sysName(other); b.setAttribute('aria-label', sysName(other)); }
          return b;
        };
        bar.append(nav(-1, '‹'), el('span', 'atlas-nav-pos', tx.systemOf(i + 1, sysRows.length)), nav(1, '›'), closeBtn);
      } else {
        bar.append(el('span', 'atlas-nav-pos atlas-nav-title', tx.systemTitle), closeBtn);
      }
      lastStory = null;
      body.appendChild(systemCard(sys));
      fitPanel();
      return;
    }
    if (shown.kind === 'solar') {
      // Planet unseres Sonnensystems: eigene Aufmachung, Blättern von innen nach außen.
      const body0 = shown.s, i = SOLAR.indexOf(body0);
      const nav = (delta, glyph) => {
        const other = SOLAR[i + delta];
        const b = button('atlas-tool atlas-nav', glyph, () => selectSolar(other, true));
        b.disabled = !other;
        if (other) { b.title = tx.planets[other.key]; b.setAttribute('aria-label', tx.planets[other.key]); }
        return b;
      };
      // Zwischen den Knöpfen: die Sonne und die acht Planeten von innen nach
      // außen; der gewählte ist hervorgehoben, ein Klick springt zum Planeten.
      const strip = el('div', 'atlas-solar-strip');
      strip.setAttribute('role', 'group');
      strip.setAttribute('aria-label', tx.solarOf(i + 1, SOLAR.length));
      strip.appendChild(el('i', 'atlas-solar-sun'));
      SOLAR.forEach((other) => {
        const dot = button('atlas-solar-dot' + (other === body0 ? ' is-current' : '') + (other.key === 'saturn' ? ' is-ringed' : ''), '',
          () => selectSolar(other, true));
        const size = Math.round(5.5 + 4.2 * log10(other.r * 10));
        dot.style.setProperty('--d', size + 'px');
        if (other.key === 'saturn') dot.innerHTML = saturnSvg(size);
        dot.title = tx.planets[other.key];
        dot.setAttribute('aria-label', tx.planets[other.key]);
        if (other === body0) dot.setAttribute('aria-current', 'true');
        strip.appendChild(dot);
      });
      bar.append(nav(-1, '‹'), strip, nav(1, '›'), closeBtn);
      lastStory = body0.story || null;
      if (body0.story) body.appendChild(storyHolder(body0.story, true, token));
      const card = el('div', 'atlas-planet' + (body0.story ? ' has-story' : ''));
      card.appendChild(el('h2', 'atlas-planet-name', tx.planets[body0.key]));
      if (!body0.story) card.appendChild(el('p', 'atlas-planet-sub', tx.solarNote));
      card.appendChild(solarFacts(body0));
      body.appendChild(card);
      fitPanel();
      return;
    }
    const p = shown.kind === 'planet' ? shown.p : null;
    const list = p ? p.stories.slice().reverse() : [shown.story];   // neueste zuerst
    const index = p ? clamp(shown.storyIndex || 0, 0, Math.max(0, list.length - 1)) : 0;
    const story = (p && shown.factsOnly) ? null : (list[index] || null);

    lastStory = story || null;
    if (story) {
      // Zwischen den Berichten blättern (zeitlich geordnet, ältere links).
      const listed = listedStories();
      const all = listed.indexOf(story) >= 0 ? listed : stories;
      const pos = all.indexOf(story);
      const nav = (delta, glyph, label) => {
        const b = button('atlas-tool atlas-nav', glyph, () => selectStory(all[pos + delta], true));
        b.disabled = !all[pos + delta];
        b.title = label;
        b.setAttribute('aria-label', label);
        return b;
      };
      bar.append(nav(-1, '‹', tx.prev), el('span', 'atlas-nav-pos', tx.storyOf(pos + 1, all.length)), nav(1, '›', tx.next), closeBtn);
    } else {
      bar.append(el('span', 'atlas-nav-pos atlas-nav-title', tx.factSheet), closeBtn);
    }

    if (story) {
      const holder = storyHolder(story, !!p, token);
      if (p && list.length > 1) {
        // Mehrere Berichte zu diesem Planeten: Auswahl nach Jahr.
        const tabs = el('div', 'atlas-chips atlas-story-tabs');
        tabs.appendChild(el('span', 'atlas-chips-label', tx.planetStories));
        list.forEach((other, i) => {
          const b = button('atlas-chip' + (i === index ? ' is-current' : ''), other.date.slice(0, 4), () => { shown.storyIndex = i; renderPanel(); });
          b.title = dateText(other.date) + ': ' + (other.title[lang] || other.title.de);
          tabs.appendChild(b);
        });
        holder.prepend(tabs);
      }
      body.appendChild(holder);
      // Planeten des Berichts als Sprungmarken.
      if (!p || story.points.length > 1 || story.missing.length) {
        const chips = el('div', 'atlas-chips');
        chips.appendChild(el('span', 'atlas-chips-label', tx.storyPlanets));
        story.points.forEach((q) => {
          const b = button('atlas-chip' + (q === p ? ' is-current' : ''), q.name, () => selectPlanet(q, true));
          const dot = el('i', 'atlas-dot'); dot.style.background = TYPES[q.ti].glow;
          b.prepend(dot);
          chips.appendChild(b);
        });
        story.missing.forEach((name) => {
          const c = el('span', 'atlas-chip is-missing', name);
          c.title = tx.notInChart;
          chips.appendChild(c);
        });
        if (story.points.length || story.missing.length) body.appendChild(chips);
      }
    }
    if (p) {
      const card = el('div', 'atlas-planet' + (story ? ' has-story' : ''));
      card.appendChild(el('h2', 'atlas-planet-name', p.name));
      if (!p.vis) card.appendChild(el('p', 'atlas-planet-sub', tx.hidden));
      card.appendChild(factTable(p));
      if (story) {
        // Erscheint nur, wenn der Steckbrief gekürzt wurde (siehe fitPanel).
        const more = button('atlas-link atlas-more', tx.allFacts, () => { shown.factsOnly = true; renderPanel(); });
        more.hidden = true;
        card.appendChild(more);
      } else if (p.stories.length) {
        card.appendChild(button('atlas-link', tx.showStory(p.stories.length), () => { shown.factsOnly = false; renderPanel(); }));
      }
      if (p.sys.planets.length > 1) {
        // Das System des Planeten als Leiste; ein Klick springt zum Nachbarn.
        const sysBox = el('div', 'atlas-sys');
        sysBox.append(button('atlas-link atlas-sys-link', tx.sysLink(p.sys.name, p.sys.planets.length), () => selectSystem(p.sys, true)),
          systemStrip(p.sys, p, false));
        card.appendChild(sysBox);
      }
      body.appendChild(card);
    }
    fitPanel();
  }

  // ============================================================ Mausbedienung
  function pick(x, y) {
    const inSys = state.view === 'sys' && !morph;
    const band = inSys ? sysBand() : -Infinity;
    if (inSys && x <= band && y >= plot.t && y <= plot.b) {
      // Namensspalte: die Zeile unter dem Mauszeiger.
      const half = Math.max(rowHeight(view) / 2, 6);
      let hit = null, hitD = half;
      for (const s of sysRows) { const d = Math.abs(s.sy - y); if (d <= hitD) { hitD = d; hit = s; } }
      return hit ? { kind: 'system', sys: hit } : null;
    }
    if (x < plot.l || x > plot.r || y < plot.t || y > plot.b) return null;
    let best = null, bestD = 13 * 13, bestStory = null, bestStoryD = 16 * 16;
    for (const p of points) {
      if (p.a * p.fade < 0.3 || p.sx < band) continue;
      const dx = p.sx - x, dy = p.sy - y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = p; }
      if (p.stories.length && d < bestStoryD) { bestStoryD = d; bestStory = p; }
    }
    if (bestStory) return { kind: 'planet', p: bestStory };
    if (inSys && state.gaps) {
      // Freier Platz der Reihe, wenn kein Planet näher liegt.
      let gapHit = null, gapD = Math.min(bestD, 9 * 9);
      for (const s of sysRows) {
        if (!s.fit || !s.on) continue;
        for (const gap of s.fit.gaps) {
          const dx = gap.sx - x, dy = gap.sy - y, d = dx * dx + dy * dy;
          if (d < gapD) { gapD = d; gapHit = { kind: 'gap', sys: s, gap: gap }; }
        }
      }
      if (gapHit) return gapHit;
    }
    // Planeten des Sonnensystems: die Marke selbst oder ihr Name daneben.
    for (const s of SOLAR) {
      const d = Math.hypot(s.sx - x, s.sy - y);
      const onLabel = s.label && x >= s.label[0] && x <= s.label[0] + s.label[2] && y >= s.label[1] && y <= s.label[1] + s.label[3];
      if (d <= 9 || (onLabel && !(best && bestD < 36))) return { kind: 'solar', s: s };
    }
    if (best) return { kind: 'planet', p: best };
    for (const r of REGIONS[state.view]) {
      if (r.rect && x >= r.rect[0] && x <= r.rect[0] + r.rect[2] && y >= r.rect[1] && y <= r.rect[1] + r.rect[3]) return { kind: 'region', r: r };
    }
    return null;
  }

  function showTip(target, x, y) {
    if (!target) { dom.tip.hidden = true; return; }
    dom.tip.replaceChildren();
    if (target.kind === 'region') {
      dom.tip.append(el('strong', '', tx.regions[target.r.key]), el('small', '', tx.regionHint));
    } else if (target.kind === 'system') {
      dom.tip.append(el('strong', '', sysName(target.sys)), el('span', '', tx.sysPlanets(target.sys.planets.length)),
        el('small', '', tx.clickSystem));
    } else if (target.kind === 'gap') {
      dom.tip.append(el('strong', '', tx.gapTitle), el('span', '', sysName(target.sys) + ': ' + tx.gapAt(periodShort(target.gap.period))),
        el('small', '', tx.gapNote));
    } else if (target.kind === 'solar') {
      dom.tip.append(el('strong', '', tx.planets[target.s.key]), el('span', '', tx.solarNote),
        el('small', '', target.s.story ? tx.clickStory : tx.clickFacts));
    } else {
      const p = target.p;
      // In der Systemansicht zählt die Umlaufzeit, sonst die Masse.
      dom.tip.append(el('strong', '', p.name), el('span', '', tx.types[TYPES[p.ti].key] + ', ' + (state.view === 'sys' ? periodShort(p.period)
        : p.massE < 100 ? num(p.massE) + tx.earthMasses : num(p.massE / EARTH_PER_JUPITER) + tx.jupiterMasses)));
      if (p.stories.length) {
        const s = p.stories[p.stories.length - 1];
        dom.tip.appendChild(el('em', '', s.title[lang] || s.title.de));
      }
      dom.tip.appendChild(el('small', '', p.stories.length ? tx.clickStory : tx.clickFacts));
    }
    dom.tip.hidden = false;
    const w = dom.tip.offsetWidth, h = dom.tip.offsetHeight;
    let tx0 = x + 16, ty0 = y + 16;
    if (tx0 + w > W - 6) tx0 = x - w - 16;
    if (ty0 + h > H - 6) ty0 = y - h - 16;
    dom.tip.style.left = Math.max(6, tx0) + 'px';
    dom.tip.style.top = Math.max(6, ty0) + 'px';
  }

  function bindPointer() {
    const c = dom.overlay;
    let drag = null;
    const local = (event) => { const b = c.getBoundingClientRect(); return [event.clientX - b.left, event.clientY - b.top]; };
    c.addEventListener('pointermove', (event) => {
      const q = local(event);
      if (drag) {
        const dx = q[0] - drag.x, dy = q[1] - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved && !morph) {
          const h = limits[state.view];
          const kx = (drag.view.x1 - drag.view.x0) / plot.w, ky = (drag.view.y1 - drag.view.y0) / plot.h;
          let x0 = drag.view.x0 - dx * kx, y0 = drag.view.y0 + dy * ky;
          const sx = drag.view.x1 - drag.view.x0, sy = drag.view.y1 - drag.view.y0;
          x0 = clamp(x0, h.x0, h.x1 - sx); y0 = clamp(y0, h.y0, h.y1 - sy);
          view = { x0: x0, x1: x0 + sx, y0: y0, y1: y0 + sy };
          viewTween = null; staticDirty = true; schedule();
          dom.tip.hidden = true;
        }
        return;
      }
      const target = morph ? null : pick(q[0], q[1]);
      const same = (target && hover && target.kind === hover.kind && target.p === hover.p && target.s === hover.s && target.r === hover.r &&
        target.sys === hover.sys && target.gap === hover.gap) || (!target && !hover);
      hover = target;
      c.style.cursor = target ? 'pointer' : 'grab';
      showTip(target, q[0], q[1]);
      if (!same) {
        overlayDirty = true; schedule();
      }
    });
    c.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const q = local(event);
      drag = { x: q[0], y: q[1], view: Object.assign({}, view), moved: false };
      c.setPointerCapture(event.pointerId);
      c.style.cursor = 'grabbing';
    });
    c.addEventListener('pointerup', (event) => {
      const d = drag; drag = null;
      c.style.cursor = hover ? 'pointer' : 'grab';
      if (!d || d.moved) return;
      const q = local(event);
      const target = pick(q[0], q[1]);
      // Klick auf einen Planeten wählt ihn aus, Klick ins Freie hebt die Auswahl auf.
      if (target && target.kind === 'planet') selectPlanet(target.p, false);
      else if (target && target.kind === 'solar') selectSolar(target.s, false);
      else if (target && (target.kind === 'system' || target.kind === 'gap')) selectSystem(target.sys, false);
      else if (target && target.kind === 'region') {
        const b = target.r.box;
        flyTo({ x0: b[0], x1: b[1], y0: b[2], y1: b[3] }, 800);
      } else if (pinned) unpin();
    });
    c.addEventListener('pointerleave', () => { hover = null; dom.tip.hidden = true; overlayDirty = true; schedule(); });
    c.addEventListener('dblclick', (event) => { event.preventDefault(); flyTo(home[state.view], 600); });
    c.addEventListener('wheel', (event) => {
      if (morph) return;
      event.preventDefault();
      const q = local(event);
      const k = Math.exp(clamp(event.deltaY, -240, 240) * 0.0016);
      const fx = clamp((q[0] - plot.l) / plot.w, 0, 1), fy = clamp((plot.b - q[1]) / plot.h, 0, 1);
      const cx = view.x0 + fx * (view.x1 - view.x0), cy = view.y0 + fy * (view.y1 - view.y0);
      const h = limits[state.view];
      const sx = clamp((view.x1 - view.x0) * k, minSpan('x'), h.x1 - h.x0), sy = clamp((view.y1 - view.y0) * k, minSpan('y'), h.y1 - h.y0);
      const x0 = clamp(cx - fx * sx, h.x0, h.x1 - sx), y0 = clamp(cy - fy * sy, h.y0, h.y1 - sy);
      view = { x0: x0, x1: x0 + sx, y0: y0, y1: y0 + sy };
      viewTween = null; staticDirty = true; dom.tip.hidden = true; schedule();
    }, { passive: false });
    c.addEventListener('keydown', (event) => {
      if (!shown && event.key === 'ArrowRight') { stepStory(1); event.preventDefault(); }
      if (!shown && event.key === 'ArrowLeft') { stepStory(-1); event.preventDefault(); }
      if (event.key === '0' || event.key === 'Home') flyTo(home[state.view], 600);
    });
    document.addEventListener('keydown', (event) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((event.target && event.target.tagName) || '');
      if (event.key === 'Escape' && document.activeElement !== dom.search) {
        if (shown) returnFocus = true;
        unpin();
        return;
      }
      // Im Bericht blättern die Pfeiltasten zum vorherigen bzw. nächsten Bericht.
      if (!typing && shown && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const nav = dom.panelHead.querySelectorAll('.atlas-nav');
        const b = nav[event.key === 'ArrowLeft' ? 0 : 1];
        if (b && !b.disabled) { event.preventDefault(); b.click(); }
      }
    });
  }

  // ================================================================== Start
  function start() {
    const root = document.querySelector('[data-exo-atlas]');
    if (!root) return;
    dom.root = root;
    let stored = null;
    try { stored = localStorage.getItem('atlas-lang'); } catch (e) { /* kein Speicher */ }
    config = readConfig(root);
    const fromUrl = new URLSearchParams(location.search).get('lang');
    const wanted = fromUrl || config.lang || root.getAttribute('data-lang') || stored || document.documentElement.lang || navigator.language || 'de';
    lang = String(wanted).toLowerCase().slice(0, 2) === 'en' ? 'en' : 'de';
    tx = TEXT[lang];
    const data = window.EXOPLANET_DATA;
    if (!data || !Array.isArray(data.planets)) { root.textContent = tx.noData; return; }

    points = buildPoints();
    stories = buildStories();
    // Zeichenreihenfolge: Planeten mit Bericht zuletzt (liegen oben).
    points.sort((a, b) => (a.stories.length ? 1 : 0) - (b.stories.length ? 1 : 0) || (a.estMass ? 0 : 1) - (b.estMass ? 0 : 1));
    computeHome();
    layoutSystems(true);
    view = Object.assign({}, home.mp);
    buildUi(root);
    bindPointer();
    dom.search.addEventListener('input', renderSearch);
    dom.search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { const first = dom.searchList.querySelector('.atlas-search-item'); if (first) first.click(); }
      if (event.key === 'Escape') { dom.search.value = ''; dom.searchList.hidden = true; }
    });
    document.addEventListener('pointerdown', (event) => { if (!event.target.closest('.atlas-search')) dom.searchList.hidden = true; });
    document.addEventListener('fullscreenchange', syncControls);
    document.addEventListener('webkitfullscreenchange', syncControls);
    document.addEventListener('visibilitychange', schedule);
    new ResizeObserver(resize).observe(dom.chart);
    syncControls();
    applyFilters();
    show(null);
    resize();
    if (document.fonts && document.fonts.load) {
      document.fonts.load('500 15px "Bricolage Grotesque"').then(() => { staticDirty = true; schedule(); }).catch(() => {});
    }

    // Auftakt: die Funde erscheinen einmal im Zeitraffer.
    if (!reducedMotion && config.intro !== false && !new URLSearchParams(location.search).has('still')) {
      state.yearMax = minYear;
      applyFilters(); syncControls();
      setTimeout(() => {
        const t0 = performance.now(), ms = 3200;
        playTimer = setInterval(() => {
          const k = clamp((performance.now() - t0) / ms, 0, 1);
          const y = Math.round(minYear + (maxYear - minYear) * k * k * (3 - 2 * k) * 1.0);
          if (y !== state.yearMax) { state.yearMax = y; applyFilters(); syncControls(); }
          if (k >= 1) { stopPlay(); state.yearMax = maxYear; applyFilters(); syncControls(); }
        }, 60);
      }, 350);
    }

    window.ExoAtlas = { version: VERSION, state: state, points: points, stories: stories,
      selectPlanet: (name) => { const p = byName.get(name) || byName.get(normName(name)); if (p) selectPlanet(p, true); return !!p; },
      selectStory: (id) => { const s = stories.find((x) => x.id === id); if (s) selectStory(s, true); return !!s; },
      // Planetensystem über den Namen des Sterns (z. B. "TRAPPIST-1"; "Sun" für das Sonnensystem).
      selectSystem: (name) => {
        const sys = /^(sun|sonne)$/i.test(name) ? SUN : multiSystems.find((x) => normName(x.name) === normName(name));
        if (sys) selectSystem(sys, true);
        return !!sys;
      },
      systems: () => [SUN].concat(multiSystems), rows: () => sysRows,
      applyPreset: applyPreset, setLang: setLang, setView: setView };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

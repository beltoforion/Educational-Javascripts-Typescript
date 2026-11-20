// Exoplaneten-Applet: Masse vs. Umlaufzeit, interaktiv.
//
// Einbinden:
//   <div data-exoplaneten></div>
//   <script src="data.js"></script>
//   <script src="exoplaneten.js"></script>
//
// oder von Hand:  Exoplaneten.mount('#mein-element', { title: 'Überschrift' });
//
// Daten: window.EXOPLANET_DATA aus data.js (Katalog von exoplanet.eu,
// erzeugt mit "node update-data.js"). Läuft ohne Server (file://).

(function () {
  'use strict';

  // ================================================================ Layout
  // Koordinatensystem der SVG-Grafik. Beide Histogramme teilen die Achsen in
  // gleich breite Klassen von BIN_PX Einheiten - dadurch sind die Balken oben
  // und rechts optisch gleich dick.
  const W = 1000, H = 832;
  const BIN_PX = 20;
  const PLOT = { left: 78, right: 858, top: 132, bottom: 772 };   // 39 x 32 Klassen
  const HIST_TOP = { base: 108, max: 92 };
  const HIST_RIGHT = { base: 866, max: 120 };
  const NX = (PLOT.right - PLOT.left) / BIN_PX;
  const NY = (PLOT.bottom - PLOT.top) / BIN_PX;
  const EARTH_PER_JUPITER = 317.83;
  const DAYS_PER_YEAR = 365.25;
  const SOLAR_CONSTANT = 1361;   // Einstrahlung an der Erdbahn in W/m²
  const SUN_TEFF = 5772;         // Temperatur der Sonne in Kelvin

  // ================================================== Entdeckungsmethoden
  // Farben mit dem Paletten-Validator geprüft (alle Paare, heller Grund);
  // zusätzlich hat jede Methode eine eigene Markerform.
  const METHODS = [
    { key: 'rv', label: 'Radialgeschwindigkeit', wrapLabel: 'Radial\u00ADgeschwindigkeit', color: '#e34948',
      d: 'M0-4.8L4 0 0 4.8-4 0Z' },
    { key: 'tr', label: 'Transit', color: '#6250d6',
      d: 'M-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0Z' },
    { key: 'ti', label: 'Timing (Pulsar, TTV)', color: '#008300',
      d: 'M0-4.6L4.6 3.6H-4.6Z' },
    { key: 'im', label: 'Direkte Abbildung', color: '#eda100',
      d: 'M-3.3-3.3H3.3V3.3H-3.3Z' },
    { key: 'ml', label: 'Microlensing', color: '#12a3b8',
      d: 'M-3.4 0a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0-6.8 0ZM-3.4 0H3.4M0-3.4V3.4' },
  ];
  // Zusätzliche Kontur über die Funde aller Verfahren zusammen.
  const ALL_METHODS = { key: 'all', label: 'Alle Verfahren',
    d: 'M-3.6 0a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0Z' };
  const CONTOUR_SETS = METHODS.concat([ALL_METHODS]);
  // Bezeichnungen aus der Katalogspalte "detection_type".
  const METHOD_OF = {
    'Radial Velocity': 0, 'Primary Transit': 1, 'Timing': 2, 'Pulsar': 2, 'TTV': 2,
    'Imaging': 3, 'Microlensing': 4,
  };

  // Bei mehreren Methoden ("Radial Velocity, Astrometry") zählt die erste, die
  // eine eigene Kategorie hat. Nur Astrometrie/"Other"/"Kinematic" -> -1.
  function classifyMethod(detectionType) {
    for (const part of String(detectionType).split(',')) {
      const i = METHOD_OF[part.trim()];
      if (i !== undefined) return i;
    }
    return -1;
  }

  // ============================================================ Sterntypen
  // life: ungefähre Lebensdauer auf der Hauptreihe (Phase des
  // Wasserstoffbrennens). Weiße Zwerge und Pulsare sind Sternreste und
  // bekommen deshalb keine Angabe.
  const STARS = [
    { key: 'A', label: 'A, B (heiß)', life: '≈ 0,01–2 Mrd. Jahre' },
    { key: 'F', label: 'F', life: '≈ 2–7 Mrd. Jahre' },
    { key: 'G', label: 'G (sonnenähnlich)', life: '≈ 10 Mrd. Jahre' },
    { key: 'K', label: 'K', life: '≈ 20–70 Mrd. Jahre' },
    { key: 'M', label: 'M (Rote Zwerge)', life: '> 100 Mrd. Jahre' },
    { key: 'WD', label: 'Weiße Zwerge' },
    { key: 'PSR', label: 'Pulsare' },
    { key: 'X', label: 'Andere / unbekannt' },
  ];
  const STAR_INDEX = { O: 0, B: 0, A: 0, F: 1, G: 2, K: 3, M: 4 };
  const STAR_OTHER = 7;

  // Ordnet den Stern nach Spektraltyp ein; fehlt der, nach der Temperatur.
  // Rückgabe: { i: Index in STARS, text: Beschreibung für den Tooltip }
  function classifyStar(spType, teff) {
    const s = String(spType || '').trim();
    if (s) {
      if (/^(PSR|Pulsar|X-ray Pulsar)/i.test(s)) return { i: 6, text: s };
      if (/^(D[A-Z]|WD)/.test(s)) return { i: 5, text: s };
      // Unterzwerge (sd...), kataklysmische Systeme, Braune Zwerge (L/T/Y)
      if (/^sd/i.test(s) || /^(AM |AmC|Catac)/.test(s) || /^[LTY]\d/.test(s)) {
        return { i: STAR_OTHER, text: s };
      }
      const letter = s.replace(/^[dg](?=[OBAFGKM])/, '').charAt(0);
      if (STAR_INDEX[letter] !== undefined) return { i: STAR_INDEX[letter], text: s };
      return { i: STAR_OTHER, text: s };
    }
    if (teff) {
      const i = teff < 3900 ? 4 : teff < 5300 ? 3 : teff < 6000 ? 2 : teff < 7500 ? 1 : 0;
      return { i: i, text: 'Typ ' + STARS[i].key + ' (aus Temperatur ' + int(Math.round(teff)) + ' K)' };
    }
    return { i: STAR_OTHER, text: 'unbekannt' };
  }

  // ========================================================= Habitable Zone
  // Grenzen der habitablen Zone als Einstrahlung relativ zur Erde, abhängig
  // von der Sterntemperatur: S = S0 + a·T + b·T² + c·T³ + d·T⁴ mit
  // T = Teff - 5780 K, gültig für 2600-7200 K.
  // Quelle: Kopparapu et al. 2014 (ApJL 787, L29), Datei HZ_coefficients.dat.
  const HZ = {
    recentVenus: [1.776, 2.136e-4, 2.533e-8, -1.332e-11, -3.097e-15],   // optimistisch, innen
    runaway:     [1.107, 1.332e-4, 1.580e-8, -8.308e-12, -1.931e-15],   // konservativ, innen
    maxGreen:    [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16],   // konservativ, außen
    earlyMars:   [0.320, 5.547e-5, 1.526e-9, -2.874e-12, -5.011e-16],   // optimistisch, außen
  };
  function hzLimit(c, teff) {
    const t = Math.min(7200, Math.max(2600, teff)) - 5780;
    return c[0] + c[1] * t + c[2] * t * t + c[3] * t * t * t + c[4] * t * t * t * t;
  }
  // Einordnung eines Planeten; flux = Einstrahlung relativ zur Erde.
  function hzText(flux, teff) {
    if (!teff || teff < 2300 || teff > 7600) return 'nicht bestimmbar (Sterntemperatur außerhalb des Modells)';
    if (flux > hzLimit(HZ.recentVenus, teff)) return 'nein, zu heiß';
    if (flux > hzLimit(HZ.runaway, teff)) return 'am inneren Rand (optimistische Zone)';
    if (flux >= hzLimit(HZ.maxGreen, teff)) return 'ja (konservative Zone)';
    if (flux >= hzLimit(HZ.earlyMars, teff)) return 'am äußeren Rand (optimistische Zone)';
    return 'nein, zu kalt';
  }
  // Einstrahlung am Ort des Planeten relativ zur Erde, oder null.
  // Leuchtkraft aus Sternradius und -temperatur; Bahnabstand aus dem Katalog,
  // sonst aus Umlaufzeit und Sternmasse (3. Keplersches Gesetz).
  function relativeFlux(teff, starRadius, starMass, axis, periodDays) {
    if (!teff || !starRadius) return null;
    const a = axis || (starMass ? Math.cbrt(starMass * Math.pow(periodDays / DAYS_PER_YEAR, 2)) : null);
    if (!a) return null;
    return starRadius * starRadius * Math.pow(teff / SUN_TEFF, 4) / (a * a);
  }
  // Wert, unter dem der Anteil q einer Liste liegt (null bei leerer Liste).
  function quantile(values, q) {
    if (!values.length) return null;
    values.sort((a, b) => a - b);
    return values[Math.min(values.length - 1, Math.floor(q * values.length))];
  }
  // ------------------------------------------------------------ Konturen
  // Dichteschätzung der Punkte auf einem Gitter (Summe von Gauß-Glocken) und
  // daraus Linien gleicher Dichte. Eine Linie "q außerhalb" liegt auf der
  // Dichte, die der Anteil q der Punkte unterschreitet.
  //
  // Die Glättungsbreite ist an die Punktdichte angepasst: Abgelegene Funde
  // bekommen eine breitere, flachere Glocke (Abramson-Regel). Dadurch wachsen
  // Ausreißer mit der Hauptwolke zusammen, ohne dass der dichte Kern
  // verschmiert. Die 0-%-Linie liegt auf der höchsten Dichte, bei der noch
  // alle Funde in EINER zusammenhängenden Fläche liegen (siehe mergeLevel).
  const CELL = 8;          // Gitterweite in Grafik-Einheiten
  const GRID_PAD = 8;      // Gitterzellen Rand um die Zeichenfläche
  const KERNEL_REACH = 4;  // Glocke wird bis zum 4-fachen der Breite ausgewertet
  const MAX_WIDEN = 6;     // abgelegene Funde: höchstens 6-fache Glättungsbreite

  function splat(grid, x0, y0, cols, rows, pts, widths) {
    for (let n = 0; n < pts.length; n++) {
      const p = pts[n], h = widths[n];
      const reach = Math.ceil(KERNEL_REACH * h / CELL), k = 1 / (2 * h * h);
      const amp = 1 / (h * h);   // jede Glocke hat dasselbe Gewicht
      const ci = Math.round((p.x - x0) / CELL), cj = Math.round((p.y - y0) / CELL);
      for (let j = Math.max(0, cj - reach); j <= Math.min(rows - 1, cj + reach); j++) {
        const dy = y0 + j * CELL - p.y;
        for (let i = Math.max(0, ci - reach); i <= Math.min(cols - 1, ci + reach); i++) {
          const dx = x0 + i * CELL - p.x;
          grid[j * cols + i] += amp * Math.exp(-(dx * dx + dy * dy) * k);
        }
      }
    }
  }
  function sampleGrid(grid, x0, y0, cols, rows, p) {   // bilinear
    const fx = (p.x - x0) / CELL, fy = (p.y - y0) / CELL;
    const i = Math.min(cols - 2, Math.max(0, Math.floor(fx))), j = Math.min(rows - 2, Math.max(0, Math.floor(fy)));
    const u = fx - i, v = fy - j, a = j * cols + i;
    return grid[a] * (1 - u) * (1 - v) + grid[a + 1] * u * (1 - v) +
      grid[a + cols] * (1 - u) * v + grid[a + cols + 1] * u * v;
  }

  // Höchste Dichte, bei der alle Punkte in einer zusammenhängenden Fläche
  // liegen: Gitterknoten von dicht nach dünn hinzufügen und verbinden, bis
  // alle Punkte in derselben Fläche sind.
  function mergeLevel(grid, x0, y0, cols, rows, pts) {
    const targets = new Set();
    for (const p of pts) {
      const i = Math.min(cols - 2, Math.max(1, Math.round((p.x - x0) / CELL)));
      const j = Math.min(rows - 2, Math.max(1, Math.round((p.y - y0) / CELL)));
      targets.add(j * cols + i);
    }
    const order = [];
    for (let j = 1; j < rows - 1; j++) for (let i = 1; i < cols - 1; i++) order.push(j * cols + i);
    order.sort((a, b) => grid[b] - grid[a]);
    const parent = new Int32Array(cols * rows).fill(-1);   // -1 = noch nicht hinzugefügt
    const count = new Int32Array(cols * rows);             // Punkte je Fläche (an der Wurzel)
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    for (const node of order) {
      parent[node] = node;
      count[node] = targets.has(node) ? 1 : 0;
      for (const nb of [node - 1, node + 1, node - cols, node + cols]) {
        if (parent[nb] === -1) continue;
        const a = find(node), b = find(nb);
        if (a !== b) { parent[b] = a; count[a] += count[b]; }
      }
      if (count[find(node)] === targets.size) return grid[node];
    }
    return 0;
  }

  // Liefert das Dichtegitter, die Dichte an den Punkten (sortiert) und die
  // Dichte der 0-%-Linie.
  function densityField(pts, x0, y0, cols, rows) {
    const n = pts.length;
    let h0 = Math.min(30, Math.max(14, 60 * Math.pow(n, -1 / 6)));   // Grund-Glättungsbreite
    for (let attempt = 0; ; attempt++) {
      // 1. Vorschätzung mit fester Breite, 2. Breite je Punkt daraus ableiten.
      const pilot = new Float32Array(cols * rows);
      splat(pilot, x0, y0, cols, rows, pts, pts.map(() => h0));
      const fp = pts.map((p) => Math.max(1e-12, sampleGrid(pilot, x0, y0, cols, rows, p)));
      const geoMean = Math.exp(fp.reduce((a, v) => a + Math.log(v), 0) / n);
      const widths = fp.map((v) => h0 * Math.min(MAX_WIDEN, Math.max(1, Math.sqrt(geoMean / v))));
      const grid = new Float32Array(cols * rows);
      splat(grid, x0, y0, cols, rows, pts, widths);
      const sorted = pts.map((p) => sampleGrid(grid, x0, y0, cols, rows, p)).sort((a, b) => a - b);
      const merge = mergeLevel(grid, x0, y0, cols, rows, pts);
      // Liegen Gruppen so weit auseinander, dass sie erst in den äußersten
      // Ausläufern der Glocken zusammenfinden, wird insgesamt stärker geglättet.
      if (merge >= 0.05 * sorted[0] || attempt >= 12) {
        return { grid: grid, sorted: sorted, hullLevel: Math.min(merge, sorted[0]) * 0.97 };
      }
      h0 *= 1.35;
    }
  }

  // Geschlossene Linienzüge der Dichte "level" (Marching Squares). Der
  // Gitterrand gilt als außerhalb, dadurch schließt sich jede Linie.
  function contourRings(grid, x0, y0, cols, rows, level) {
    const val = (i, j) => (i <= 0 || j <= 0 || i >= cols - 1 || j >= rows - 1) ? -1 : grid[j * cols + i];
    const pos = new Map();      // Kanten-Schlüssel -> [x, y]
    const links = new Map();    // Kanten-Schlüssel -> verbundene Kanten-Schlüssel
    function edge(i, j, vertical) {   // Kante ab Knoten (i, j) nach rechts bzw. unten
      const key = (j * cols + i) * 2 + (vertical ? 1 : 0);
      if (!pos.has(key)) {
        const a = val(i, j), b = vertical ? val(i, j + 1) : val(i + 1, j);
        const t = (level - a) / (b - a);
        pos.set(key, vertical ? [x0 + i * CELL, y0 + (j + t) * CELL] : [x0 + (i + t) * CELL, y0 + j * CELL]);
      }
      return key;
    }
    function link(a, b) {
      (links.get(a) || links.set(a, []).get(a)).push(b);
      (links.get(b) || links.set(b, []).get(b)).push(a);
    }
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const tl = val(i, j) >= level, tr = val(i + 1, j) >= level;
        const br = val(i + 1, j + 1) >= level, bl = val(i, j + 1) >= level;
        const c = (tl ? 8 : 0) + (tr ? 4 : 0) + (br ? 2 : 0) + (bl ? 1 : 0);
        if (c === 0 || c === 15) continue;
        const T = () => edge(i, j, false), B = () => edge(i, j + 1, false);
        const L = () => edge(i, j, true), R = () => edge(i + 1, j, true);
        const mid = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 >= level;
        switch (c) {
          case 1: case 14: link(L(), B()); break;
          case 2: case 13: link(B(), R()); break;
          case 3: case 12: link(L(), R()); break;
          case 4: case 11: link(T(), R()); break;
          case 6: case 9: link(T(), B()); break;
          case 7: case 8: link(T(), L()); break;
          case 5: if (mid) { link(T(), L()); link(B(), R()); } else { link(T(), R()); link(L(), B()); } break;
          case 10: if (mid) { link(T(), R()); link(L(), B()); } else { link(T(), L()); link(B(), R()); } break;
        }
      }
    }
    const rings = [], seen = new Set();
    for (const start of links.keys()) {
      if (seen.has(start)) continue;
      const ring = [];
      let prev = -1, cur = start;
      while (cur !== undefined && !seen.has(cur)) {
        seen.add(cur);
        ring.push(pos.get(cur));
        const next = links.get(cur).find((k) => k !== prev && !seen.has(k));
        prev = cur; cur = next;
      }
      if (ring.length >= 3) rings.push(ring);
    }
    return rings;
  }
  function ringsPath(rings) {
    return rings.map((ring) => 'M' + ring.map((q) => f(q[0]) + ' ' + f(q[1])).join('L') + 'Z').join('');
  }

  function fluxText(flux) {
    return num(flux * SOLAR_CONSTANT) + ' W/m² = ' + num(flux) + ' × Erde';
  }

  // ====================================================== Sonnensystem
  // Masse in Jupitermassen, Umlaufzeit in Tagen, Radius in Grafik-Einheiten.
  const SOLAR = [
    { name: 'Mars', mass: 3.381e-4, period: 686.98, r: 8.7, side: 1 },
    { name: 'Venus', mass: 2.564e-3, period: 224.70, r: 8.7, side: -1 },
    { name: 'Erde', mass: 3.146e-3, period: 365.26, r: 9.4, side: 1 },
    { name: 'Uranus', mass: 4.574e-2, period: 30688.5, r: 8.7, side: -1 },
    { name: 'Neptun', mass: 5.395e-2, period: 60189, r: 8.7, side: 1 },
    { name: 'Saturn', mass: 0.2994, period: 10759.2, r: 9.8, side: -1, extent: 2.05 },
    { name: 'Jupiter', mass: 1, period: 4332.59, r: 10.8, side: 1 },
  ];

  // Jeder Planet ist auf einen Kreis mit Radius 1 gezeichnet.
  // back/front liegen hinter bzw. vor der Scheibe (Saturnring, Venus-Dunst).
  const SATURN_RING = ' fill="none" stroke="#c9b589" stroke-width="0.36" transform="rotate(-18)"';
  const PLANET_ART = {
    Mars: { disc:
      '<circle r="1" fill="#c1663a"/>' +
      '<path d="M-1-.25C-.5-.45-.1-.1.35-.2C.7-.28.9 0 1 .1V.4C.5.2.1.5-.4.35C-.7.26-.9.1-1 .1Z" fill="#7a3a1e" opacity=".6"/>' +
      '<path d="M-.6.62C-.2.5.3.7.7.58L.5.9H-.4Z" fill="#8b4424" opacity=".5"/>' +
      '<ellipse cx=".05" cy="-.93" rx=".36" ry=".1" fill="#f6e6da" opacity=".85"/>' },
    Venus: { back: '<circle r="1.16" fill="#b4bcd8" opacity=".75"/>', disc:
      '<circle r="1" fill="#ead9ab"/>' +
      '<path d="M-1-.3C-.4-.5.3-.1 1-.35V-.1C.3.12-.4-.25-1-.05Z" fill="#fff6dc" opacity=".7"/>' +
      '<path d="M-1 .3C-.3.1.4.5 1 .25V.5C.4.72-.3.35-1 .55Z" fill="#c9b27c" opacity=".6"/>' },
    Erde: { disc:
      '<circle r="1" fill="#1f56c0"/>' +
      '<path d="M-.5-.9C-.15-.75.15-.8.3-.55C.4-.35.1-.3.05-.1C0 .1.3.15.25.4C.2.7-.05.9-.2.75C-.35.6-.2.35-.35.15C-.5-.05-.75-.1-.8-.4C-.83-.6-.7-.85-.5-.9Z" fill="#3f9a3a"/>' +
      '<path d="M.55-.2C.8-.3.95-.05.9.2C.85.4.6.35.55.15Z" fill="#3f9a3a"/>' +
      '<path d="M-.15-.5C0-.45.05-.3-.05-.2C-.2-.2-.3-.4-.15-.5Z" fill="#b99a4a" opacity=".8"/>' +
      '<path d="M-.9.05C-.5-.05-.2.2.3.05" stroke="#fff" stroke-width=".09" fill="none" opacity=".55"/>' },
    Jupiter: { disc:
      '<circle r="1" fill="#d9c4a5"/>' +
      '<rect x="-1" y="-.82" width="2" height=".14" fill="#a98f74"/>' +
      '<rect x="-1" y="-.52" width="2" height=".22" fill="#8f6548"/>' +
      '<rect x="-1" y="-.3" width="2" height=".3" fill="#efe6d3"/>' +
      '<rect x="-1" y=".05" width="2" height=".24" fill="#99694a"/>' +
      '<rect x="-1" y=".46" width="2" height=".1" fill="#b39a80"/>' +
      '<rect x="-1" y=".7" width="2" height=".3" fill="#a08c7a"/>' +
      '<ellipse cx=".38" cy=".2" rx=".24" ry=".13" fill="#b5482c"/>' },
    Saturn: {
      back: '<ellipse rx="2" ry=".5"' + SATURN_RING + '/>',
      disc:
        '<circle r="1" fill="#e3cf9f"/>' +
        '<rect x="-1" y="-.6" width="2" height=".2" fill="#cdb685"/>' +
        '<rect x="-1" y="-.15" width="2" height=".16" fill="#d3bd8c"/>' +
        '<rect x="-1" y=".35" width="2" height=".25" fill="#c4ab7a"/>',
      front: '<path d="M-2 0A2 .5 0 0 0 2 0"' + SATURN_RING + '/>' },
    Uranus: { disc:
      '<circle r="1" fill="#a5dde2"/>' +
      '<rect x="-1" y="-.35" width="2" height=".3" fill="#c3ecee" opacity=".7"/>' +
      '<rect x="-1" y=".3" width="2" height=".25" fill="#8fcdd4" opacity=".7"/>' },
    Neptun: { disc:
      '<circle r="1" fill="#3f66d8"/>' +
      '<rect x="-1" y="-.2" width="2" height=".3" fill="#2f50b8" opacity=".8"/>' +
      '<path d="M-.5-.5C-.2-.6.1-.55.35-.45" stroke="#fff" stroke-width=".1" fill="none" opacity=".7"/>' +
      '<ellipse cx="-.3" cy=".35" rx=".25" ry=".12" fill="#22408f"/>' },
  };

  // Beschriftete Regionen im Diagramm (Position in Masse / Umlaufzeit).
  const NOTES = [
    { text: 'Heiße Jupiter', mass: 1.1, period: 0.36, anchor: 'middle' },
    { text: 'Supererden und Mini-Neptune', mass: 0.0015, period: 9, anchor: 'end' },
    { text: 'Direkt abgebildete Begleiter auf weiten Bahnen', mass: 2.4, period: 4.5e6, anchor: 'end' },
    { text: 'Enge Begleiter von Pulsaren und Weißen Zwergen', mass: 5.5, period: 0.07, anchor: 'end' },
  ];

  // ========================================================== Hilfsmittel
  const log10 = Math.log10;
  const f = (v) => (Math.round(v * 100) / 100).toString();

  function num(v, digits) {
    return v.toLocaleString('de-DE', { maximumSignificantDigits: digits || 3 });
  }
  function int(v) { return v.toLocaleString('de-DE'); }

  function pow10Label(e) {
    if (e >= 9) return num(Math.pow(10, e - 9)) + ' Mrd.';
    if (e >= 6) return num(Math.pow(10, e - 6)) + ' Mio.';
    return num(Math.pow(10, e), 1);
  }
  // Kurze Zahl für sehr große und sehr kleine Werte: 2,4 Mio. / 7·10⁻⁶.
  function compact(v) {
    if (v >= 1e9) return num(v / 1e9, 2) + ' Mrd.';
    if (v >= 1e6) return num(v / 1e6, 2) + ' Mio.';
    if (v >= 0.001) return num(v, 2);
    const e = Math.floor(log10(v));
    const sup = String(e).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
    const mant = num(v / Math.pow(10, e), 1);
    return (mant === '1' ? '' : mant + '·') + '10' + sup;
  }
  function massText(m) {
    return num(m) + ' Jupitermassen = ' + num(m * EARTH_PER_JUPITER) + ' Erdmassen';
  }
  function periodText(days) {
    if (days < 1) return num(days * 24) + ' Stunden';
    if (days < 1000) return num(days) + ' Tage';
    return num(days / DAYS_PER_YEAR) + ' Jahre (' + num(days) + ' Tage)';
  }

  function extent(values) {
    let lo = Infinity, hi = -Infinity;
    for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return [lo, hi];
  }
  // Achsenbereich: Datenbereich plus 4 % Rand auf jeder Seite.
  function paddedRange(logValues) {
    const [lo, hi] = extent(logValues);
    const pad = (hi - lo) * 0.04;
    return [lo - pad, hi + pad];
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function markerSvg(m) {
    return '<svg class="exo-key" viewBox="-6 -6 12 12" aria-hidden="true">' +
      '<path class="exo-m exo-m-' + m.key + '" d="' + m.d + '"/></svg>';
  }

  // ================================================================== CSS
  const CSS = [
    '.exo-root{--exo-surface:#fcfcfb;--exo-ink:#0b0b0b;--exo-ink2:#52514e;--exo-muted:#898781;',
    '--exo-grid:#e1e0d9;--exo-axis:#c3c2b7;--exo-border:rgba(11,11,11,.12);',
    METHODS.map((m) => '--exo-c-' + m.key + ':' + m.color + ';').join(''),
    'position:relative;box-sizing:border-box;max-width:1100px;margin:0 auto;padding:18px 20px 14px;',
    'background:var(--exo-surface);color:var(--exo-ink);border:1px solid var(--exo-border);border-radius:12px;',
    'font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left}',
    '.exo-root *{box-sizing:border-box}',
    '.exo-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 16px;margin-bottom:12px}',
    '.exo-title{margin:0;font-size:20px;font-weight:650;line-height:1.25;color:var(--exo-ink)}',
    '.exo-sub{font-size:13.5px;color:var(--exo-ink2);font-variant-numeric:tabular-nums}',
    '.exo-reset{margin-left:auto;font:inherit;font-size:13px;color:var(--exo-ink2);background:none;',
    'border:1px solid var(--exo-border);border-radius:999px;padding:3px 11px;cursor:pointer}',
    '.exo-reset:hover:not(:disabled){background:rgba(11,11,11,.05)}',
    '.exo-reset:disabled{opacity:.4;cursor:default}',
    '.exo-filters{display:flex;flex-wrap:wrap;align-items:flex-start;gap:14px 36px;margin-bottom:10px}',
    '.exo-group{min-width:0}',
    '.exo-group-range{margin:14px 0 4px}',
    '.exo-label{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--exo-muted);margin-bottom:5px}',
    '.exo-chips{display:flex;flex-direction:column;align-items:stretch;gap:1px}',
    '.exo-chip{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;line-height:1.2;',
    'color:var(--exo-ink);background:none;border:0;border-radius:6px;padding:3px 8px 3px 5px;cursor:pointer;text-align:left}','.exo-chip-label,.exo-chip-n{white-space:nowrap}',
    '.exo-chip:hover{background:rgba(11,11,11,.05)}',
    '.exo-chip:focus-visible,.exo-cell:focus-visible,.exo-reset:focus-visible,.exo-play:focus-visible{outline:2px solid var(--exo-ink);outline-offset:2px}',
    // Matrix der Verfahren: Name, Anzahl und je eine Spalte für Punkte und Kontur.
    '.exo-matrix{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;row-gap:1px}',
    '.exo-mrow{display:grid;grid-template-columns:subgrid;grid-column:1/-1;align-items:center;border-radius:6px;font-size:13px;line-height:1.2}',
    '.exo-mrow:not(.exo-mhead):hover{background:rgba(11,11,11,.05)}',
    '.exo-mhead{align-items:end;margin-bottom:4px}',
    '.exo-mhead .exo-label{margin:0}',
    '.exo-mhead .exo-label:first-child{grid-column:1/span 2;overflow-wrap:anywhere}',
    '.exo-mhead .exo-mcol{text-align:center;padding:0 5px}',
    '.exo-mname{display:flex;align-items:center;gap:6px;padding:3px 0 3px 5px;cursor:pointer}',
    // Auf schmalen Bildschirmen darf der Name umbrechen, die Schalter bleiben stehen.
    '.exo-mname .exo-chip-label{white-space:normal;overflow-wrap:anywhere}',
    '.exo-matrix .exo-chip-n{padding-left:10px}',
    '.exo-mrow.exo-off .exo-mname{color:var(--exo-muted)}',
    '.exo-mrow.exo-off .exo-key{opacity:.3}',
    '.exo-cell{display:flex;justify-content:center;align-items:center;align-self:stretch;min-height:22px;margin:0;padding:3px 5px;',
    'font:inherit;background:none;border:0;border-radius:6px;cursor:pointer}',
    '.exo-cell:hover .exo-check{border-color:var(--exo-ink)}',
    '.exo-cell[aria-checked="true"] .exo-check,.exo-cell[aria-checked="mixed"] .exo-check{background:var(--exo-ink);border-color:var(--exo-ink)}',
    '.exo-cell[aria-checked="true"] .exo-check::after{content:"";position:absolute;left:3.5px;top:.5px;width:4px;height:8px;',
    'border:solid var(--exo-surface);border-width:0 2px 2px 0;transform:rotate(45deg)}',
    '.exo-cell[aria-checked="mixed"] .exo-check::after{content:"";position:absolute;left:2px;top:4.5px;width:7px;height:2px;background:var(--exo-surface)}',
    '.exo-cell[aria-disabled="true"]{cursor:default}',
    '.exo-cell[aria-disabled="true"] .exo-check{opacity:.3;border-style:dashed}',
    '.exo-check{flex:none;width:14px;height:14px;border:1.5px solid var(--exo-muted);border-radius:3px;position:relative}',
    '.exo-chip[aria-checked="true"] .exo-check{background:var(--exo-ink);border-color:var(--exo-ink)}',
    '.exo-chip[aria-checked="true"] .exo-check::after{content:"";position:absolute;left:3.5px;top:.5px;width:4px;height:8px;',
    'border:solid var(--exo-surface);border-width:0 2px 2px 0;transform:rotate(45deg)}',
    '.exo-chip[aria-checked="false"]{color:var(--exo-muted)}',
    '.exo-chip[aria-checked="false"] .exo-key{opacity:.3}',
    '.exo-chip-n{margin-left:auto;padding-left:14px;color:var(--exo-muted);font-size:12px;font-variant-numeric:tabular-nums}',
    '.exo-chip-life{color:var(--exo-ink2);font-size:12px}','.exo-chip[aria-checked="false"] .exo-chip-life{color:var(--exo-muted)}',
    '.exo-key{flex:none;width:14px;height:14px}',
    '.exo-range-head{display:flex;align-items:center;gap:10px;margin-bottom:2px}',
    '.exo-range-head .exo-label{margin:0}',
    '.exo-range-val{font-size:14px;font-weight:650;font-variant-numeric:tabular-nums}',
    '.exo-play{margin-left:auto;font:inherit;font-size:13px;color:var(--exo-ink);background:none;',
    'border:1px solid var(--exo-border);border-radius:999px;padding:3px 11px;cursor:pointer}',
    '.exo-play:hover{background:rgba(11,11,11,.05)}',
    '.exo-spark{position:relative;height:40px;margin:4px 8px 0}',
    '.exo-spark i{position:absolute;bottom:0;min-height:1px;background:var(--exo-grid);transform:translateX(-50%);border-radius:1px 1px 0 0}',
    '.exo-spark i.exo-in{background:var(--exo-ink2)}',
    '.exo-range{position:relative;height:22px}',
    '.exo-range-track,.exo-range-fill{position:absolute;top:9px;height:4px;border-radius:2px}',
    '.exo-range-track{left:8px;right:8px;background:var(--exo-grid)}',
    '.exo-range-fill{background:var(--exo-ink2)}',
    '.exo-range input{position:absolute;left:0;top:0;width:100%;height:22px;margin:0;padding:0;background:none;',
    'pointer-events:none;-webkit-appearance:none;appearance:none;outline:none}',
    '.exo-range input::-webkit-slider-runnable-track{height:22px;background:none}',
    '.exo-range input::-moz-range-track{height:22px;background:none}',
    '.exo-range input::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:16px;height:16px;margin-top:3px;',
    'border-radius:50%;background:var(--exo-surface);border:2px solid var(--exo-ink);cursor:grab}',
    '.exo-range input::-moz-range-thumb{pointer-events:auto;width:12px;height:12px;border-radius:50%;',
    'background:var(--exo-surface);border:2px solid var(--exo-ink);cursor:grab}',
    '.exo-range input:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px rgba(11,11,11,.25)}',
    '.exo-range input:focus-visible::-moz-range-thumb{box-shadow:0 0 0 3px rgba(11,11,11,.25)}',
    '.exo-range-wrap{position:relative}',
    '.exo-hz{position:absolute;top:0;bottom:0;border-radius:3px;pointer-events:none}',
    '.exo-hz-opt{background:rgba(12,163,12,.15)}',
    '.exo-hz-con{background:rgba(12,163,12,.28)}',
    '.exo-range-marks,.exo-range-ticks{position:relative;height:16px;margin:0 8px;font-size:11.5px;font-variant-numeric:tabular-nums}',
    '.exo-range-marks{color:var(--exo-ink2);font-weight:600;margin-top:4px}',
    '.exo-range-ticks{color:var(--exo-muted)}',
    '.exo-range-marks span,.exo-range-ticks span{position:absolute;top:0;white-space:nowrap;transform:translateX(-50%)}',
    '.exo-range-ticks span.exo-start{transform:none}',
    '.exo-range-ticks span.exo-end{transform:translateX(-100%)}',
    '.exo-range-note{margin:2px 0 0;font-size:12px;color:var(--exo-muted)}',
    '.exo-plot{overflow-x:auto}',
    '.exo-plot svg{display:block;width:100%;min-width:620px;height:auto;touch-action:pan-y}',
    '.exo-plot text{font-family:inherit}',
    '.exo-grid{stroke:var(--exo-grid);stroke-width:1;fill:none}',
    '.exo-frame{stroke:var(--exo-axis);stroke-width:1;fill:none}',
    '.exo-tick{font-size:12.5px;fill:var(--exo-muted);font-variant-numeric:tabular-nums}',
    '.exo-axis-title{font-size:13.5px;font-weight:600;fill:var(--exo-ink2)}',
    '.exo-halo{paint-order:stroke;stroke:var(--exo-surface);stroke-width:4px;stroke-linejoin:round}',
    '.exo-note{font-size:12.5px;font-style:italic;fill:var(--exo-ink2)}',
    '.exo-sol{font-size:13px;font-weight:500;fill:var(--exo-ink)}',
    '.exo-m{stroke:var(--exo-surface);stroke-width:.7;fill-opacity:.88}',
    METHODS.map((m) => m.key === 'ml'
      ? '.exo-m-ml{fill:none;stroke:var(--exo-c-ml);stroke-width:1.4}'
      : '.exo-m-' + m.key + '{fill:var(--exo-c-' + m.key + ')}').join(''),
    METHODS.map((m) => '.exo-b-' + m.key + '{fill:var(--exo-c-' + m.key + ')}').join(''),
    '.exo-m-all{fill:none;stroke:var(--exo-ink);stroke-width:1.4}.exo-b-all{fill:var(--exo-ink2)}.exo-l-all{stroke:var(--exo-ink)}',
    METHODS.map((m) => '.exo-l-' + m.key + '{stroke:var(--exo-c-' + m.key + ')}').join(''),
    '.exo-limit-key{max-width:330px;margin-top:8px}',
    '.exo-limit-row{display:flex;gap:8px;align-items:baseline;font-size:12.5px;line-height:1.35;color:var(--exo-ink2);padding:2px 0 2px 5px}',
    '.exo-limit-row i{flex:none;width:18px;height:3px;border-radius:2px;transform:translateY(-3px)}',
    '.exo-limit-row i.exo-faint{opacity:.5}',
    '.exo-limit-row i.exo-ring-key{height:10px;width:18px;border-radius:5px;background:none;border:1.5px solid var(--exo-ink2);transform:translateY(1px)}',
    '.exo-cfill{stroke:none;fill-opacity:.075;fill-rule:evenodd;pointer-events:none}',
    '.exo-cline{fill:none;stroke-width:1.1;pointer-events:none}',
    '.exo-cline-hull{stroke-width:1.7}',
    '.exo-ccase{fill:none;stroke:var(--exo-surface);stroke-width:3.2;stroke-opacity:.75;pointer-events:none}',
    '.exo-clabel{font-size:11px;font-weight:600;fill:var(--exo-ink);pointer-events:none}',
    '.exo-band{fill:var(--exo-ink);opacity:.06;pointer-events:none}',
    '.exo-ring{fill:none;stroke:var(--exo-ink);stroke-width:1.6;pointer-events:none}',
    '.exo-tip{position:absolute;z-index:5;pointer-events:none;max-width:300px;padding:8px 11px;font-size:12.5px;line-height:1.45;',
    'background:var(--exo-surface);color:var(--exo-ink);border:1px solid var(--exo-border);border-radius:8px;',
    'box-shadow:0 4px 14px rgba(11,11,11,.14)}',
    '.exo-tip[hidden]{display:none}',
    '.exo-tip-head{font-weight:650;font-size:13.5px;margin-bottom:3px}',
    '.exo-tip-row{display:flex;gap:10px;justify-content:space-between;align-items:baseline}',
    '.exo-tip-row span:first-child{color:var(--exo-ink2);white-space:nowrap}',
    '.exo-tip-row span:last-child{font-weight:600;text-align:right;font-variant-numeric:tabular-nums}',
    '.exo-tip-line{display:inline-block;width:10px;height:3px;border-radius:2px;margin-right:6px;vertical-align:middle}',
    '.exo-foot{margin:6px 0 0;font-size:12px;color:var(--exo-muted)}',
    '.exo-foot a{color:var(--exo-ink2)}',
  ].join('');

  function injectCss() {
    if (document.getElementById('exo-style')) return;
    const style = document.createElement('style');
    style.id = 'exo-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  let instanceCount = 0;

  // ================================================================ mount
  function mount(target, options) {
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) throw new Error('Exoplaneten.mount: Element nicht gefunden');
    options = options || {};
    const data = options.data || window.EXOPLANET_DATA;
    if (!data || !Array.isArray(data.planets)) {
      root.textContent = 'Keine Daten gefunden: data.js fehlt. Bitte "node update-data.js" ausführen.';
      return null;
    }
    injectCss();
    const uid = 'exo' + (++instanceCount);

    // ------------------------------------------------------------ Daten
    const points = [];
    let skipped = 0;
    for (const row of data.planets) {
      const mi = classifyMethod(row[3]);
      if (mi < 0) { skipped++; continue; }
      const star = classifyStar(row[5], row[6]);
      points.push({
        name: row[0], mass: row[1], period: row[2], method: row[3],
        year: typeof row[4] === 'number' ? row[4] : null,
        mi: mi, si: star.i, starText: star.text, teff: row[6] || null,
        flux: relativeFlux(row[6], row[7], row[8], row[9], row[2]),
        lx: log10(row[1]), ly: log10(row[2]), vis: true, id: points.length,
      });
    }
    const xRange = paddedRange(points.map((p) => p.lx).concat(SOLAR.map((p) => log10(p.mass))));
    const yRange = paddedRange(points.map((p) => p.ly).concat(SOLAR.map((p) => log10(p.period))));
    const sx = (lx) => PLOT.left + (lx - xRange[0]) / (xRange[1] - xRange[0]) * (PLOT.right - PLOT.left);
    const sy = (ly) => PLOT.bottom - (ly - yRange[0]) / (yRange[1] - yRange[0]) * (PLOT.bottom - PLOT.top);
    for (const p of points) {
      p.x = sx(p.lx); p.y = sy(p.ly);
      p.bx = Math.min(NX - 1, Math.max(0, Math.floor((p.x - PLOT.left) / BIN_PX)));
      p.by = Math.min(NY - 1, Math.max(0, Math.floor((PLOT.bottom - p.y) / BIN_PX)));
    }
    const solar = SOLAR.map((p) => Object.assign({ x: sx(log10(p.mass)), y: sy(log10(p.period)) }, p));
    const years = extent(points.filter((p) => p.year !== null).map((p) => p.year));
    const minYear = years[0], maxYear = years[1], nYears = maxYear - minYear + 1;

    // Einstrahlung: lf = log10 der Einstrahlung in W/m² (null = nicht berechenbar).
    let noFlux = 0;
    for (const p of points) {
      p.lf = p.flux === null ? null : log10(p.flux * SOLAR_CONSTANT);
      if (p.lf === null) noFlux++;
    }
    // Der Regler deckt 99 % der Werte ab; die wenigen Ausreißer darüber und
    // darunter zählen zum jeweiligen Rand (lf wird auf den Bereich begrenzt).
    const allFlux = points.filter((p) => p.lf !== null).map((p) => p.lf);
    const fMin = Math.floor(quantile(allFlux, 0.005)), fMax = Math.ceil(quantile(allFlux, 0.995));
    const FLUX_BIN = 0.25, nFluxBins = Math.round((fMax - fMin) / FLUX_BIN);
    for (const p of points) {
      if (p.lf === null) { p.fb = -1; continue; }
      p.lf = Math.min(fMax, Math.max(fMin, p.lf));
      p.fb = Math.min(nFluxBins - 1, Math.floor((p.lf - fMin) / FLUX_BIN));
    }
    // Habitable Zone eines sonnenähnlichen Sterns, als log10(W/m²).
    const hzOpt = [log10(HZ.earlyMars[0] * SOLAR_CONSTANT), log10(HZ.recentVenus[0] * SOLAR_CONSTANT)];
    const hzCon = [log10(HZ.maxGreen[0] * SOLAR_CONSTANT), log10(HZ.runaway[0] * SOLAR_CONSTANT)];

    const state = {
      methods: METHODS.map(() => true),
      stars: STARS.map(() => true),
      lo: minYear, hi: maxYear,      // Entdeckungsjahr
      flo: fMin, fhi: fMax,          // Einstrahlung, log10(W/m²)
      contours: CONTOUR_SETS.map(() => true),   // Kontur je Verfahren und für alle zusammen
    };

    // -------------------------------------------------------------- DOM
    root.classList.add('exo-root');
    root.replaceChildren();

    const head = el('div', 'exo-head');
    const title = options.title === undefined ? 'Exoplaneten: Masse und Umlaufzeit' : options.title;
    if (title) head.appendChild(el('h2', 'exo-title', title));
    const sub = el('span', 'exo-sub');
    sub.setAttribute('aria-live', 'polite');
    const resetBtn = el('button', 'exo-reset', 'Filter zurücksetzen');
    resetBtn.type = 'button';
    head.append(sub, resetBtn);

    const filters = el('div', 'exo-filters');

    function chipGroup(labelText, items, flags, withMarker) {
      const group = el('div', 'exo-group');
      group.appendChild(el('div', 'exo-label', labelText));
      const box = el('div', 'exo-chips');
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', labelText);
      const chips = items.map((item, i) => {
        const b = el('button', 'exo-chip');
        b.type = 'button';
        b.setAttribute('role', 'checkbox');
        b.setAttribute('aria-checked', 'true');
        b.appendChild(el('span', 'exo-check'));
        if (withMarker) b.insertAdjacentHTML('beforeend', markerSvg(item));
        b.appendChild(el('span', 'exo-chip-label', item.label));
        if (item.life) {
          const life = el('span', 'exo-chip-life', item.life);
          life.title = 'Ungefähre Lebensdauer des Sterns';
          b.appendChild(life);
        }
        const n = el('span', 'exo-chip-n', '');
        b.appendChild(n);
        b.addEventListener('click', () => {
          flags[i] = !flags[i];
          b.setAttribute('aria-checked', String(flags[i]));
          update();
        });
        box.appendChild(b);
        return { button: b, count: n };
      });
      group.appendChild(box);
      filters.appendChild(group);
      return chips;
    }
    // Verfahren als Matrix: je Zeile ein Verfahren, je Spalte ein Schalter
    // (Punkte, Kontur). Die Konturen sind unabhängig von den Punkten schaltbar.
    // Die letzte Zeile schaltet alle Punkte gemeinsam und die Kontur über die
    // Funde aller Verfahren zusammen.
    const methodGroup = el('div', 'exo-group');
    const matrix = el('div', 'exo-matrix');
    matrix.setAttribute('role', 'group');
    matrix.setAttribute('aria-label', 'Entdeckungsmethode');
    const matrixHead = el('div', 'exo-mrow exo-mhead');
    matrixHead.setAttribute('aria-hidden', 'true');   // steht in den Namen der Schalter
    matrixHead.append(el('div', 'exo-label', 'Entdeckungsmethode'),
      el('div', 'exo-label exo-mcol', 'Punkte'), el('div', 'exo-label exo-mcol', 'Kontur'));
    matrix.appendChild(matrixHead);
    function matrixCell(label, title, toggle) {
      const b = el('button', 'exo-cell');
      b.type = 'button';
      b.setAttribute('role', 'checkbox');
      b.setAttribute('aria-checked', 'true');
      b.setAttribute('aria-label', label);
      b.title = title;
      b.appendChild(el('span', 'exo-check'));
      b.addEventListener('click', () => {
        if (b.getAttribute('aria-disabled') === 'true') return;
        toggle();
        update();
      });
      return b;
    }
    const methodRows = CONTOUR_SETS.map((item, i) => {
      const all = item === ALL_METHODS;
      const row = el('div', 'exo-mrow');
      const name = el('span', 'exo-mname');
      name.insertAdjacentHTML('beforeend', markerSvg(item));
      // wrapLabel: Name mit weicher Trennstelle für schmale Bildschirme.
      name.appendChild(el('span', 'exo-chip-label', item.wrapLabel || item.label));
      const count = el('span', 'exo-chip-n', '');
      const togglePoints = all
        ? () => { state.methods.fill(!state.methods.every(Boolean)); }
        : () => { state.methods[i] = !state.methods[i]; };
      const contourTitle = all ? 'Kontur über die Funde aller Verfahren zusammen'
        : 'Kontur des Nachweisbereichs: ' + item.label;
      const pointsCell = matrixCell('Punkte: ' + item.label,
        all ? 'Punkte aller Verfahren ein- oder ausblenden' : 'Punkte: ' + item.label, togglePoints);
      const contourCell = matrixCell(contourTitle, contourTitle,
        () => { state.contours[i] = !state.contours[i]; });
      // Ein Klick auf den Namen schaltet die Punkte (große Zielfläche für die Maus).
      name.addEventListener('click', () => { togglePoints(); update(); });
      row.append(name, count, pointsCell, contourCell);
      matrix.appendChild(row);
      return { row: row, count: count, points: pointsCell, contour: contourCell, contourTitle: contourTitle };
    });
    methodGroup.appendChild(matrix);
    filters.appendChild(methodGroup);

    const starChips = chipGroup('Sterntyp · ungefähre Lebensdauer', STARS, state.stars, false);

    // Erklärung der eingezeichneten Konturlinien, unter der Matrix.
    const limitKey = el('div', 'exo-limit-key');
    function limitRow(methodIndex, faint) {
      const row = el('div', 'exo-limit-row');
      const swatch = el('i', faint ? 'exo-faint' : '');
      swatch.style.background = METHODS[methodIndex].color;
      const text = el('span');
      row.append(swatch, text);
      limitKey.appendChild(row);
      return { row: row, text: text };
    }
    const limitRows = { contours: limitRow(0) };
    limitRows.contours.row.firstChild.className = 'exo-ring-key';
    limitRows.contours.row.firstChild.style.background = '';
    methodGroup.appendChild(limitKey);

    // Doppelregler mit Verlauf darüber; steht unter dem Diagramm.
    // o: label, min, max, step, loLabel, hiLabel, bars (Mittelpunkte),
    //    barWidth, ticks, format(lo, hi), onChange(lo, hi),
    //    optional: actions (Knöpfe), bands (hervorgehobene Bereiche), marks, note
    function rangeControl(o) {
      const group = el('div', 'exo-group exo-group-range');
      const frac = (v) => (v - o.min) / Math.max(1e-9, o.max - o.min);
      const pos = (v) => 'calc(8px + ' + frac(v) + ' * (100% - 16px))';

      const headRow = el('div', 'exo-range-head');
      const val = el('span', 'exo-range-val');
      headRow.append(el('div', 'exo-label', o.label), val);
      (o.actions || []).forEach((a, i) => {
        if (i === 0) a.style.marginLeft = 'auto';
        headRow.appendChild(a);
      });
      group.appendChild(headRow);

      if (o.marks) {
        const marks = el('div', 'exo-range-marks');
        o.marks.forEach((m) => {
          const span = el('span', '', m.text);
          span.style.left = frac(m.value) * 100 + '%';
          marks.appendChild(span);
        });
        group.appendChild(marks);
      }

      const wrap = el('div', 'exo-range-wrap');
      (o.bands || []).forEach((b) => {
        const node = el('div', 'exo-hz ' + b.className);
        node.style.left = pos(b.from);
        node.style.width = 'calc(' + (frac(b.to) - frac(b.from)) + ' * (100% - 16px))';
        wrap.appendChild(node);
      });
      const spark = el('div', 'exo-spark');
      spark.setAttribute('aria-hidden', 'true');
      const bars = o.bars.map((center) => {
        const bar = document.createElement('i');
        bar.style.left = frac(center) * 100 + '%';
        bar.style.width = o.barWidth / Math.max(1e-9, o.max - o.min) * 100 + '%';
        spark.appendChild(bar);
        return bar;
      });
      const range = el('div', 'exo-range');
      const fill = el('div', 'exo-range-fill');
      function input(label, value) {
        const node = document.createElement('input');
        node.type = 'range';
        node.min = o.min; node.max = o.max; node.step = o.step; node.value = value;
        node.setAttribute('aria-label', label);
        return node;
      }
      const loInput = input(o.loLabel, o.min), hiInput = input(o.hiLabel, o.max);
      range.append(el('div', 'exo-range-track'), fill, loInput, hiInput);
      wrap.append(spark, range);
      group.appendChild(wrap);

      const ticks = el('div', 'exo-range-ticks');
      o.ticks.forEach((t) => {
        const fr = frac(t.value);
        const span = el('span', fr < 0.02 ? 'exo-start' : fr > 0.98 ? 'exo-end' : '', t.text);
        span.style.left = fr * 100 + '%';
        ticks.appendChild(span);
      });
      group.appendChild(ticks);
      if (o.note) group.appendChild(el('p', 'exo-range-note', o.note));

      let lo = o.min, hi = o.max;
      function set(a, b) {
        lo = a; hi = b;
        fill.style.left = pos(a);
        fill.style.width = 'calc(' + (frac(b) - frac(a)) + ' * (100% - 16px))';
        loInput.value = a; hiInput.value = b;
        // Liegen beide Griffe rechts übereinander, muss der linke oben liegen.
        loInput.style.zIndex = a > (o.min + o.max) / 2 ? 5 : 3;
        hiInput.style.zIndex = 4;
        val.textContent = o.format(a, b);
      }
      loInput.addEventListener('input', () => {
        lo = Math.min(Number(loInput.value), hi);
        loInput.value = lo;   // Griff sofort festhalten, nicht erst im nächsten Frame
        o.onChange(lo, hi);
      });
      hiInput.addEventListener('input', () => {
        hi = Math.max(Number(hiInput.value), lo);
        hiInput.value = hi;
        o.onChange(lo, hi);
      });
      return { group: group, bars: bars, set: set };
    }

    // Entdeckungsjahr mit Zeitraffer.
    const playBtn = el('button', 'exo-play');
    playBtn.type = 'button';
    const yearList = Array.from({ length: nYears }, (_, i) => minYear + i);
    const yearCtl = rangeControl({
      label: 'Entdeckungsjahr', min: minYear, max: maxYear, step: 1,
      loLabel: 'Entdeckt ab Jahr', hiLabel: 'Entdeckt bis Jahr',
      bars: yearList, barWidth: 0.72,
      ticks: [{ value: minYear, text: String(minYear) }, { value: maxYear, text: String(maxYear) }],
      format: (a, b) => (a === b ? String(a) : a + ' – ' + b),
      actions: [playBtn],
      onChange: (a, b) => { stopPlay(); state.lo = a; state.hi = b; scheduleUpdate(); },
    });

    // Einstrahlung am Ort des Planeten, logarithmisch, mit habitabler Zone.
    const hzBtn = el('button', 'exo-play', 'Habitable Zone wählen');
    hzBtn.type = 'button';
    const fluxTicks = [];
    for (let e = fMin; e <= fMax; e++) {
      if (e % 2 === 0) fluxTicks.push({ value: e, text: pow10Label(e) });
    }
    const fluxCtl = rangeControl({
      label: 'Einstrahlung', min: fMin, max: fMax, step: 0.01,
      loLabel: 'Einstrahlung mindestens', hiLabel: 'Einstrahlung höchstens',
      bars: Array.from({ length: nFluxBins }, (_, i) => fMin + (i + 0.5) * FLUX_BIN),
      barWidth: FLUX_BIN * 0.8,
      ticks: fluxTicks,
      marks: [{ value: (hzOpt[0] + hzOpt[1]) / 2, text: 'Habitable Zone' }],
      bands: [
        { from: hzOpt[0], to: hzOpt[1], className: 'exo-hz-opt' },
        { from: hzCon[0], to: hzCon[1], className: 'exo-hz-con' },
      ],
      format: (a, b) => (a <= fMin ? 'unter ' : '') + compact(Math.pow(10, a)) + ' – ' +
        (b >= fMax ? 'über ' : '') + compact(Math.pow(10, b)) + ' W/m²  (' +
        compact(Math.pow(10, a) / SOLAR_CONSTANT) + ' – ' + compact(Math.pow(10, b) / SOLAR_CONSTANT) + ' × Erde)',
      actions: [hzBtn],
      note: 'Grün: habitable Zone eines sonnenähnlichen Sterns (dunkel konservativ, hell optimistisch); ' +
        'bei kühleren Sternen liegt sie bei etwas geringerer Einstrahlung. ' +
        int(noFlux) + ' Planeten ohne berechenbare Einstrahlung erscheinen nur bei vollem Bereich.',
      onChange: (a, b) => { state.flo = a; state.fhi = b; scheduleUpdate(); },
    });
    hzBtn.addEventListener('click', () => {
      state.flo = hzOpt[0]; state.fhi = hzOpt[1];
      update();
    });

    const plot = el('div', 'exo-plot');
    plot.innerHTML = buildSvg();
    const svg = plot.firstChild;
    const histTopG = svg.querySelector('.exo-hist-top');
    const histRightG = svg.querySelector('.exo-hist-right');
    const limitsG = svg.querySelector('.exo-limits');
    const contourFillG = svg.querySelector('.exo-contour-fill');
    const band = svg.querySelector('.exo-band');
    const ring = svg.querySelector('.exo-ring');
    const pointsG = svg.querySelector('.exo-points');
    const pointNodes = pointsG.children;
    points.forEach((p, i) => { p.el = pointNodes[i]; });

    const tip = el('div', 'exo-tip');
    tip.hidden = true;

    const foot = el('p', 'exo-foot');
    const link = el('a', '', 'exoplanet.eu');
    link.href = 'https://exoplanet.eu/catalog/';
    link.target = '_blank';
    link.rel = 'noopener';
    foot.append('Daten: ', link,
      ', Stand ' + String(data.fetched).split('-').reverse().join('.') + '. ' +
      int(data.total) + ' bestätigte Planeten im Katalog, davon ' + int(data.planets.length) +
      ' mit bekannter Masse und Umlaufzeit' +
      (skipped ? '; ' + int(skipped) + ' mit anderer Entdeckungsmethode (Astrometrie u. a.) sind nicht dargestellt' : '') +
      '. Masse: wahre Masse, sonst M·sin i.');

    root.append(head, filters, plot, yearCtl.group, fluxCtl.group, foot, tip);

    // ---------------------------------------------------- statische Grafik
    function buildSvg() {
      const s = [];
      s.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
        'aria-label="Streudiagramm: Masse und Umlaufzeit der Exoplaneten, mit Häufigkeitsverteilungen am Rand">');
      s.push('<defs><radialGradient id="' + uid + '-shade" cx=".36" cy=".34" r=".72">' +
        '<stop offset="0" stop-color="#fff" stop-opacity=".3"/>' +
        '<stop offset=".55" stop-color="#000" stop-opacity="0"/>' +
        '<stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>' +
        '<clipPath id="' + uid + '-disc"><circle r="1"/></clipPath>' +
        '<clipPath id="' + uid + '-plot"><rect x="' + PLOT.left + '" y="' + PLOT.top + '" width="' +
        (PLOT.right - PLOT.left) + '" height="' + (PLOT.bottom - PLOT.top) + '"/></clipPath></defs>');

      // Gitter an jeder Dekade.
      s.push('<g class="exo-grid">');
      const xt = [], yt = [];
      for (let e = Math.ceil(xRange[0]); e <= Math.floor(xRange[1]); e++) xt.push(e);
      for (let e = Math.ceil(yRange[0]); e <= Math.floor(yRange[1]); e++) yt.push(e);
      xt.forEach((e) => s.push('<path d="M' + f(sx(e)) + ' ' + PLOT.top + 'V' + PLOT.bottom + '"/>'));
      yt.forEach((e) => s.push('<path d="M' + PLOT.left + ' ' + f(sy(e)) + 'H' + PLOT.right + '"/>'));
      s.push('</g>');

      // Histogramme (Inhalt kommt aus update()).
      s.push('<rect class="exo-band" width="0" height="0"/>');
      s.push('<g class="exo-hist-top"></g><g class="exo-hist-right"></g>');
      s.push('<path class="exo-frame" d="M' + PLOT.left + ' ' + HIST_TOP.base + 'H' + PLOT.right +
        'M' + HIST_RIGHT.base + ' ' + PLOT.top + 'V' + PLOT.bottom + '"/>');

      // Achsenbeschriftung.
      s.push('<g class="exo-tick" text-anchor="middle">');
      xt.forEach((e) => s.push('<text x="' + f(sx(e)) + '" y="' + (PLOT.bottom + 19) + '">' + pow10Label(e) + '</text>'));
      s.push('</g><g class="exo-tick" text-anchor="end">');
      yt.forEach((e) => s.push('<text x="' + (PLOT.left - 8) + '" y="' + f(sy(e) + 4.5) + '">' + pow10Label(e) + '</text>'));
      s.push('</g>');
      const cx = (PLOT.left + PLOT.right) / 2, cy = (PLOT.top + PLOT.bottom) / 2;
      s.push('<text class="exo-axis-title" text-anchor="middle" x="' + cx + '" y="' + (PLOT.bottom + 46) + '">Masse in Jupitermassen</text>');
      s.push('<text class="exo-axis-title" text-anchor="middle" transform="translate(16 ' + cy + ') rotate(-90)">Umlaufzeit in Tagen</text>');

      // Zweite Skala oben: Erdmassen.
      s.push('<g class="exo-tick">');
      s.push('<text x="' + PLOT.left + '" y="' + (PLOT.top - 8) + '">Erdmassen</text>');
      for (let e = -3; e <= 6; e++) {
        const x = sx(e - log10(EARTH_PER_JUPITER));
        if (x < PLOT.left + 80 || x > PLOT.right - 10) continue;
        s.push('<path class="exo-frame" d="M' + f(x) + ' ' + PLOT.top + 'v-4"/>');
        s.push('<text text-anchor="middle" x="' + f(x) + '" y="' + (PLOT.top - 8) + '">' + pow10Label(e) + '</text>');
      }
      s.push('</g>');

      // Zweite Skala links innen: Jahre.
      s.push('<g class="exo-tick">');
      for (let e = 0; e <= 8; e++) {
        const y = sy(e + log10(DAYS_PER_YEAR));
        if (y < PLOT.top + 12 || y > PLOT.bottom - 12) continue;
        s.push('<path class="exo-frame" d="M' + PLOT.left + ' ' + f(y) + 'h6"/>');
        const text = pow10Label(e) + (e === 0 ? ' Jahr' : ' Jahre');
        // Beschriftung weglassen, wo ein Körper des Sonnensystems darauf läge.
        const x1 = PLOT.left + 10 + text.length * 7;
        if (solar.some((p) => p.x - p.r < x1 + 4 && Math.abs(p.y - y) < p.r + 10)) continue;
        s.push('<text class="exo-halo" x="' + (PLOT.left + 10) + '" y="' + f(y + 4.5) + '">' + text + '</text>');
      }
      s.push('</g>');

      // Gefüllte Flächen der Konturen liegen unter den Punkten.
      s.push('<g class="exo-contour-fill" clip-path="url(#' + uid + '-plot)"></g>');

      // Datenpunkte in Katalogreihenfolge (ein Element je Planet).
      s.push('<g class="exo-points">');
      for (const p of points) {
        const m = METHODS[p.mi];
        s.push('<path class="exo-m exo-m-' + m.key + '" transform="translate(' + f(p.x) + ' ' + f(p.y) + ')" d="' + m.d + '"/>');
      }
      s.push('</g>');

      // Konturlinien (Inhalt kommt aus renderLimits()).
      s.push('<g class="exo-limits" clip-path="url(#' + uid + '-plot)"></g>');

      // Beschriftete Regionen.
      s.push('<g class="exo-note exo-halo">');
      for (const n of NOTES) {
        s.push('<text text-anchor="' + n.anchor + '" x="' + f(sx(log10(n.mass))) + '" y="' +
          f(sy(log10(n.period)) + 4.5) + '">' + n.text + '</text>');
      }
      s.push('</g>');

      // Planeten des Sonnensystems.
      s.push('<g class="exo-sol exo-halo">');
      for (const p of solar) {
        const art = PLANET_ART[p.name];
        s.push('<g transform="translate(' + f(p.x) + ' ' + f(p.y) + ') scale(' + p.r + ')" stroke="none">' +
          (art.back || '') +
          '<g clip-path="url(#' + uid + '-disc)">' + art.disc +
          '<circle r="1" fill="url(#' + uid + '-shade)"/></g>' +
          (art.front || '') + '</g>');
        const off = p.r * (p.extent || 1) + 6;
        s.push('<text x="' + f(p.x + p.side * off) + '" y="' + f(p.y + 4.5) + '" text-anchor="' +
          (p.side > 0 ? 'start' : 'end') + '">' + p.name + '</text>');
      }
      s.push('</g>');

      s.push('<rect class="exo-frame" x="' + PLOT.left + '" y="' + PLOT.top + '" width="' +
        (PLOT.right - PLOT.left) + '" height="' + (PLOT.bottom - PLOT.top) + '"/>');
      s.push('<circle class="exo-ring" r="8" visibility="hidden"/>');
      s.push('</svg>');
      return s.join('');
    }

    // ------------------------------------------------------ Nachweisgrenzen
    // Konturen je Methode: Linien gleicher Dichte. An jeder Linie steht, wie
    // viel Prozent der Funde außerhalb liegen; 0 % ist eine zusammenhängende
    // Fläche um alle Funde. Sie folgen dem Zeitregler und den Filtern.
    const fieldCache = {};   // je Methode: zuletzt berechnetes Dichtefeld
    const CONTOUR_LEVELS = [0, 0.01, 0.05, 0.2, 0.5];   // Anteil außerhalb, von außen nach innen
    const MIN_CONTOUR_POINTS = 20;
    const gridX0 = PLOT.left - GRID_PAD * CELL, gridY0 = PLOT.top - GRID_PAD * CELL;
    const gridCols = Math.ceil((PLOT.right - PLOT.left) / CELL) + 2 * GRID_PAD + 1;
    const gridRows = Math.ceil((PLOT.bottom - PLOT.top) / CELL) + 2 * GRID_PAD + 1;

    function renderLimits() {
      let fills = '', lines = '', labels = '';
      const placed = [];

      {
        // Die zusammengefasste Kontur kommt zuerst an die Reihe, damit ihre
        // Beschriftungen Vorrang haben; gezeichnet wird sie zuoberst.
        const order = CONTOUR_SETS.map((m, mi) => mi);
        order.unshift(order.pop());
        const linesBySet = CONTOUR_SETS.map(() => '');
        order.forEach((mi) => {
          const m = CONTOUR_SETS[mi];
          // Die Kontur umfasst alle Funde des Verfahrens (beim letzten Eintrag:
          // aller Verfahren), die zu Zeitraum, Sterntyp und Einstrahlung
          // passen - auch wenn ihre Punkte ausgeblendet sind.
          const pts = points.filter((p) => p.sel && (m === ALL_METHODS || p.mi === mi));
          const enough = pts.length >= MIN_CONTOUR_POINTS;
          const cell = methodRows[mi].contour;
          cell.setAttribute('aria-disabled', String(!enough));
          cell.title = enough ? methodRows[mi].contourTitle
            : 'Zu wenige Funde für eine Kontur (mindestens ' + MIN_CONTOUR_POINTS + ')';
          if (!state.contours[mi] || !enough) return;
          // Neu rechnen nur, wenn sich die Auswahl der Funde geändert hat.
          let key = pts.length;
          for (const p of pts) key = (key * 31 + p.id) | 0;
          let cached = fieldCache[m.key];
          if (!cached || cached.key !== key) {
            cached = fieldCache[m.key] = { key: key, field: densityField(pts, gridX0, gridY0, gridCols, gridRows) };
          }
          const d = cached.field;
          CONTOUR_LEVELS.forEach((q) => {
            const level = q === 0 ? d.hullLevel
              : d.sorted[Math.min(d.sorted.length - 1, Math.floor(q * d.sorted.length))];
            const rings = contourRings(d.grid, gridX0, gridY0, gridCols, gridRows, level);
            if (!rings.length) return;
            const path = ringsPath(rings);
            fills += '<path class="exo-cfill exo-b-' + m.key + '" d="' + path + '"/>';
            linesBySet[mi] += '<path class="exo-ccase" d="' + path + '"/>' +
              '<path class="exo-cline exo-l-' + m.key + (q === 0 ? ' exo-cline-hull' : '') + '" d="' + path + '"/>';
            // Beschriftung am höchsten Punkt des größten Linienzugs.
            const big = rings.reduce((a, b) => (b.length > a.length ? b : a));
            const top = big.reduce((a, b) => (b[1] < a[1] ? b : a));
            if (top[1] < PLOT.top + 14 || top[0] < PLOT.left + 16 || top[0] > PLOT.right - 16) return;
            if (placed.some((o) => Math.abs(o[0] - top[0]) < 30 && Math.abs(o[1] - top[1]) < 13)) return;
            placed.push(top);
            labels += '<text class="exo-clabel exo-halo" text-anchor="middle" x="' + f(top[0]) + '" y="' +
              f(top[1] - 4) + '">' + num(q * 100) + ' %</text>';
          });
        });
        lines = linesBySet.join('');
      }
      contourFillG.innerHTML = fills;

      limitsG.innerHTML = lines + labels;

      limitRows.contours.text.textContent = 'Die Zahl an jeder Linie gibt an, wie viel Prozent ' +
        'der Funde außerhalb liegen; die 0-%-Linie umschließt alle. Ab ' + MIN_CONTOUR_POINTS + ' Funden.';
    }

    // --------------------------------------------------------- Aktualisieren
    let histX = [], histY = [];

    function update() {
      const lo = state.lo, hi = state.hi, flo = state.flo, fhi = state.fhi;
      const fullRange = lo <= minYear && hi >= maxYear;
      const fullFlux = flo <= fMin && fhi >= fMax;
      const perFlux = new Array(nFluxBins).fill(0);
      const mCount = METHODS.map(() => 0), sCount = STARS.map(() => 0);
      const allX = new Array(NX).fill(0), allY = new Array(NY).fill(0);
      const perYear = new Array(nYears).fill(0);
      histX = Array.from({ length: NX }, () => METHODS.map(() => 0));
      histY = Array.from({ length: NY }, () => METHODS.map(() => 0));
      let shown = 0;

      for (const p of points) {
        const inYear = p.year === null ? fullRange : (p.year >= lo && p.year <= hi);
        const mOn = state.methods[p.mi], sOn = state.stars[p.si];
        const inFlux = p.lf === null ? fullFlux : (p.lf >= flo - 1e-9 && p.lf <= fhi + 1e-9);
        if (mOn && sOn && inFlux) {
          // Unabhängig vom Zeitraum (für den Jahresverlauf und die feste
          // Balkenskala im Zeitraffer).
          allX[p.bx]++; allY[p.by]++;
          if (p.year !== null) perYear[p.year - minYear]++;
        }
        if (mOn && sOn && inYear && p.fb >= 0) perFlux[p.fb]++;
        if (inYear && sOn && inFlux) mCount[p.mi]++;
        if (inYear && mOn && inFlux) sCount[p.si]++;
        p.sel = inYear && sOn && inFlux;   // passt zu Zeitraum, Sterntyp und Einstrahlung
        const vis = p.sel && mOn;
        if (vis) { histX[p.bx][p.mi]++; histY[p.by][p.mi]++; shown++; }
        if (vis !== p.vis) { p.vis = vis; p.el.style.display = vis ? '' : 'none'; }
      }

      // Histogramme: gestapelt nach Methode, 2 Einheiten Abstand zwischen Balken.
      // Im Zeitraffer bleibt die Skala fest, damit die Balken sichtbar
      // wachsen; sonst füllt der höchste Balken die verfügbare Höhe.
      const sum = (counts) => counts.reduce((a, b) => a + b, 0);
      const maxX = Math.max(1, Math.max.apply(null, timer ? allX : histX.map(sum)));
      const maxY = Math.max(1, Math.max.apply(null, timer ? allY : histY.map(sum)));
      let s = '';
      for (let i = 0; i < NX; i++) {
        let y = HIST_TOP.base;
        for (let m = 0; m < METHODS.length; m++) {
          const c = histX[i][m];
          if (!c) continue;
          const h = c / maxX * HIST_TOP.max;
          y -= h;
          s += '<rect class="exo-b-' + METHODS[m].key + '" x="' + (PLOT.left + i * BIN_PX + 1) + '" y="' + f(y) +
            '" width="' + (BIN_PX - 2) + '" height="' + f(Math.max(0.6, h - (h > 3 ? 1 : 0))) + '"/>';
        }
      }
      histTopG.innerHTML = s;
      s = '';
      for (let i = 0; i < NY; i++) {
        let x = HIST_RIGHT.base;
        for (let m = 0; m < METHODS.length; m++) {
          const c = histY[i][m];
          if (!c) continue;
          const w = c / maxY * HIST_RIGHT.max;
          s += '<rect class="exo-b-' + METHODS[m].key + '" x="' + f(x + (w > 3 ? 1 : 0)) + '" y="' +
            (PLOT.bottom - (i + 1) * BIN_PX + 1) + '" width="' + f(Math.max(0.6, w - (w > 3 ? 1 : 0))) +
            '" height="' + (BIN_PX - 2) + '"/>';
          x += w;
        }
      }
      histRightG.innerHTML = s;

      // Filterleiste.
      const allOn = state.methods.every(Boolean), anyOn = state.methods.some(Boolean);
      methodRows.forEach((r, i) => {
        const all = i === METHODS.length;
        const pts = all ? (allOn ? 'true' : anyOn ? 'mixed' : 'false') : String(state.methods[i]);
        r.points.setAttribute('aria-checked', pts);
        r.contour.setAttribute('aria-checked', String(state.contours[i]));
        r.row.classList.toggle('exo-off', pts === 'false' && !state.contours[i]);
        r.count.textContent = int(all ? sum(mCount) : mCount[i]);
      });
      starChips.forEach((c, i) => { c.count.textContent = int(sCount[i]); });
      const maxPerYear = Math.max(1, Math.max.apply(null, perYear));
      yearCtl.bars.forEach((bar, i) => {
        bar.style.height = (perYear[i] / maxPerYear * 100) + '%';
        bar.className = (minYear + i >= lo && minYear + i <= hi) ? 'exo-in' : '';
      });
      yearCtl.set(lo, hi);
      const maxPerFlux = Math.max(1, Math.max.apply(null, perFlux));
      fluxCtl.bars.forEach((bar, i) => {
        const center = fMin + (i + 0.5) * FLUX_BIN;
        bar.style.height = (perFlux[i] / maxPerFlux * 100) + '%';
        bar.className = (center >= flo && center <= fhi) ? 'exo-in' : '';
      });
      fluxCtl.set(flo, fhi);
      playBtn.textContent = timer ? '❚❚ Anhalten' : '▶ Zeitraffer';

      renderLimits();
      sub.textContent = int(shown) + ' von ' + int(points.length) + ' Planeten angezeigt';
      resetBtn.disabled = fullRange && fullFlux && state.methods.every(Boolean) && state.stars.every(Boolean);
      hideTip();
    }

    // -------------------------------------------------------------- Regler
    let frame = 0;
    function scheduleUpdate() {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; update(); });
    }
    // Zeitraffer: das Endjahr läuft vom Anfangsjahr bis zum letzten Jahr.
    let timer = 0;
    function stopPlay() {
      if (!timer) return;
      clearInterval(timer);
      timer = 0;
      playBtn.textContent = '▶ Zeitraffer';
      scheduleUpdate();   // Balkenskala wieder an die sichtbaren Daten anpassen
    }
    playBtn.addEventListener('click', () => {
      if (timer) { stopPlay(); return; }
      if (state.hi >= maxYear) state.hi = state.lo;
      timer = setInterval(() => {
        if (state.hi >= maxYear) { stopPlay(); return; }
        state.hi++;
        update();
        if (state.hi >= maxYear) stopPlay();
      }, 320);
      update();
    });

    resetBtn.addEventListener('click', () => {
      stopPlay();
      state.methods.fill(true);
      state.stars.fill(true);
      state.lo = minYear; state.hi = maxYear;
      state.flo = fMin; state.fhi = fMax;
      starChips.forEach((c) => c.button.setAttribute('aria-checked', 'true'));   // die Matrix folgt in update()
      update();
    });

    // -------------------------------------------------------------- Tooltip
    function hideTip() {
      tip.hidden = true;
      ring.setAttribute('visibility', 'hidden');
      band.setAttribute('width', 0);
    }
    function tipRow(label, value, color) {
      const row = el('div', 'exo-tip-row');
      const left = el('span');
      if (color) {
        const line = el('i', 'exo-tip-line');
        line.style.background = color;
        left.appendChild(line);
      }
      left.append(label);
      row.append(left, el('span', '', value));
      return row;
    }
    function showTip(event, headText, rows) {
      tip.replaceChildren(el('div', 'exo-tip-head', headText));
      rows.forEach((r) => tip.appendChild(tipRow(r[0], r[1], r[2])));
      tip.hidden = false;
      const box = root.getBoundingClientRect();
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = event.clientX - box.left + 16, y = event.clientY - box.top + 16;
      if (x + tw > box.width - 4) x = event.clientX - box.left - tw - 16;
      if (y + th > box.height - 4) y = event.clientY - box.top - th - 16;
      tip.style.left = Math.max(4, x) + 'px';
      tip.style.top = Math.max(4, y) + 'px';
    }
    function binRows(counts, unitRange) {
      const rows = [];
      let total = 0;
      counts.forEach((c, m) => {
        total += c;
        if (c) rows.push([METHODS[m].label, int(c), METHODS[m].color]);
      });
      rows.push(['Gesamt', int(total) + (total === 1 ? ' Planet' : ' Planeten')]);
      return [unitRange, rows];
    }

    function onPointer(event) {
      const box = svg.getBoundingClientRect();
      const k = W / box.width;
      const x = (event.clientX - box.left) * k, y = (event.clientY - box.top) * k;
      const inX = x >= PLOT.left && x <= PLOT.right, inY = y >= PLOT.top && y <= PLOT.bottom;

      if (inX && inY) {
        // Nächstgelegener sichtbarer Punkt; Sonnensystem-Planeten haben Vorrang.
        band.setAttribute('width', 0);
        for (const p of solar) {
          if (Math.hypot(p.x - x, p.y - y) <= p.r + 2) {
            ring.setAttribute('visibility', 'hidden');
            showTip(event, p.name, [
              ['Masse', massText(p.mass)], ['Umlaufzeit', periodText(p.period)],
              ['Einstrahlung', fluxText(Math.pow(p.period / DAYS_PER_YEAR, -4 / 3))],
              ['', 'Planet unseres Sonnensystems']]);
            return;
          }
        }
        let best = null, bestD = 14 * 14;
        for (const p of points) {
          if (!p.vis) continue;
          const dx = p.x - x, dy = p.y - y, d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = p; }
        }
        if (!best) { hideTip(); return; }
        ring.setAttribute('cx', f(best.x));
        ring.setAttribute('cy', f(best.y));
        ring.setAttribute('visibility', 'visible');
        showTip(event, best.name, [
          ['Masse', massText(best.mass)],
          ['Umlaufzeit', periodText(best.period)],
          ['Methode', best.method, METHODS[best.mi].color],
          ['Stern', best.starText],
          ['Einstrahlung', best.flux === null ? 'nicht berechenbar' : fluxText(best.flux)],
          ['Habitable Zone', best.flux === null ? 'nicht bestimmbar' : hzText(best.flux, best.teff)],
          ['Entdeckt', best.year === null ? 'unbekannt' : String(best.year)]]);
        return;
      }
      ring.setAttribute('visibility', 'hidden');

      if (inX && y < PLOT.top && y >= HIST_TOP.base - HIST_TOP.max - 6) {
        const i = Math.min(NX - 1, Math.floor((x - PLOT.left) / BIN_PX));
        const dx = (xRange[1] - xRange[0]) / NX;
        const r = binRows(histX[i], num(Math.pow(10, xRange[0] + i * dx), 2) + ' – ' +
          num(Math.pow(10, xRange[0] + (i + 1) * dx), 2) + ' Jupitermassen');
        band.setAttribute('x', PLOT.left + i * BIN_PX);
        band.setAttribute('y', HIST_TOP.base - HIST_TOP.max);
        band.setAttribute('width', BIN_PX);
        band.setAttribute('height', PLOT.bottom - HIST_TOP.base + HIST_TOP.max);
        showTip(event, r[0], r[1]);
        return;
      }
      if (inY && x > PLOT.right && x <= HIST_RIGHT.base + HIST_RIGHT.max + 6) {
        const i = Math.min(NY - 1, Math.floor((PLOT.bottom - y) / BIN_PX));
        const dy = (yRange[1] - yRange[0]) / NY;
        const r = binRows(histY[i], 'Umlaufzeit ' + num(Math.pow(10, yRange[0] + i * dy), 2) + ' – ' +
          num(Math.pow(10, yRange[0] + (i + 1) * dy), 2) + ' Tage');
        band.setAttribute('x', PLOT.left);
        band.setAttribute('y', PLOT.bottom - (i + 1) * BIN_PX);
        band.setAttribute('width', HIST_RIGHT.base + HIST_RIGHT.max - PLOT.left);
        band.setAttribute('height', BIN_PX);
        showTip(event, r[0], r[1]);
        return;
      }
      hideTip();
    }
    svg.addEventListener('pointermove', onPointer);
    svg.addEventListener('pointerdown', onPointer);
    svg.addEventListener('pointerleave', hideTip);

    update();
    return { update: update, state: state };
  }

  // Alle Elemente mit dem Attribut data-exoplaneten automatisch füllen.
  function autoMount() {
    document.querySelectorAll('[data-exoplaneten]').forEach((node) => {
      if (node.classList.contains('exo-root')) return;
      const opts = {};
      if (node.hasAttribute('data-title')) opts.title = node.getAttribute('data-title');
      mount(node, opts);
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
    else autoMount();
  }

  window.Exoplaneten = { mount: mount };
})();

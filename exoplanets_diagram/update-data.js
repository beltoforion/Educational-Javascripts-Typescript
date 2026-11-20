#!/usr/bin/env node
// Lädt den aktuellen Katalog von exoplanet.eu und schreibt daraus data.js
// und data-extra.js.
// Aufruf:  node update-data.js
//
// data.js: Planeten mit Masse und Umlaufzeit (für exoplaneten.js und
// atlas.html). data-extra.js: weitere Planeten, bei denen eine der beiden
// Größen im Katalog fehlt und ersetzt werden kann (nur für atlas.html).
// Beide werden per <script> eingebunden. Dadurch laufen die Seiten auch per
// Doppelklick (file://) ohne Webserver.

'use strict';

const fs = require('fs');
const path = require('path');

const CSV_URL = 'https://exoplanet.eu/catalog/csv/';
const OUT_FILE = path.join(__dirname, 'data.js');
const EXTRA_FILE = path.join(__dirname, 'data-extra.js');
const DAYS_PER_YEAR = 365.25;

// Minimaler CSV-Parser (RFC 4180: Anführungszeichen, "" als Escape,
// Zeilenumbrüche innerhalb von Feldern).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function positiveNumber(s) {
  const v = parseFloat(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}

async function main() {
  console.log('Lade ' + CSV_URL + ' ...');
  const res = await fetch(CSV_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
  const rows = parseCsv(await res.text());

  const header = rows[0];
  const col = {};
  for (const name of ['name', 'mass', 'mass_sini', 'orbital_period', 'detection_type', 'discovered',
    'star_sp_type', 'star_teff', 'star_radius', 'star_mass', 'semi_major_axis', 'eccentricity',
    'star_distance', 'radius']) {
    col[name] = header.indexOf(name);
    if (col[name] < 0) throw new Error('Spalte fehlt im Katalog: ' + name);
  }

  const planets = [];
  // Planeten ohne Umlaufzeit im Katalog, aber mit Masse, Bahnabstand und
  // Sternmasse (vor allem direkt abgebildete Planeten auf weiten Bahnen).
  // Ihre Umlaufzeit ist aus dem 3. Keplerschen Gesetz berechnet.
  const computed = [];
  // Planeten ohne Masse im Katalog, aber mit Radius und Umlaufzeit (vor allem
  // Transitplaneten von Kepler und TESS). Die Masse bleibt hier leer (null);
  // atlas.html schätzt sie aus dem Radius.
  const radiusOnly = [];
  let total = 0;
  for (const r of rows.slice(1)) {
    if (r.length < header.length) continue;
    total++;
    // Wie im alten Katalog: echte Masse, sonst M·sin(i).
    const mass = positiveNumber(r[col.mass]) ?? positiveNumber(r[col.mass_sini]);
    const radius = positiveNumber(r[col.radius]);
    const starMass = positiveNumber(r[col.star_mass]);
    const axis = positiveNumber(r[col.semi_major_axis]);
    let period = positiveNumber(r[col.orbital_period]);
    let list = planets;
    if (mass === null) {
      if (radius === null || period === null) continue;
      list = radiusOnly;
    } else if (period === null) {
      if (axis === null || starMass === null) continue;
      period = Number((Math.sqrt(axis * axis * axis / starMass) * DAYS_PER_YEAR).toPrecision(4));
      list = computed;
    }
    const year = parseInt(r[col.discovered], 10);
    list.push([r[col.name], mass, period, r[col.detection_type],
      Number.isFinite(year) ? year : null,
      r[col.star_sp_type].trim(), positiveNumber(r[col.star_teff]),
      positiveNumber(r[col.star_radius]), starMass,
      axis, positiveNumber(r[col.eccentricity]),
      positiveNumber(r[col.star_distance]), radius]);
  }
  if (planets.length < 1000) {
    throw new Error('Nur ' + planets.length + ' Planeten gefunden - Format geändert?');
  }

  const data = {
    source: 'https://exoplanet.eu/catalog/',
    fetched: new Date().toISOString().slice(0, 10),
    total: total,
    // [Name, Masse in Jupitermassen, Umlaufzeit in Tagen, Entdeckungsmethode, Entdeckungsjahr,
    //  Spektraltyp des Sterns, Temperatur des Sterns in Kelvin,
    //  Sternradius in Sonnenradien, Sternmasse in Sonnenmassen,
    //  große Halbachse der Planetenbahn in AE, Bahnexzentrizität,
    //  Entfernung des Sterns in Parsec, Planetenradius in Jupiterradien]
    planets: planets,
  };
  const extra = {
    fetched: data.fetched,
    // Gleiches Zeilenformat wie in data.js.
    // computed: Umlaufzeit nicht gemessen, sondern aus Bahnabstand und
    // Sternmasse berechnet (3. Keplersches Gesetz).
    computed: computed,
    // radiusOnly: Masse unbekannt (null); Radius und Umlaufzeit gemessen.
    radiusOnly: radiusOnly,
  };
  const js =
    '// Automatisch erzeugt von update-data.js - nicht von Hand bearbeiten.\n' +
    'window.EXOPLANET_DATA = ' +
    JSON.stringify(data).replace(/\],\[/g, '],\n[') + ';\n';
  fs.writeFileSync(OUT_FILE, js);
  fs.writeFileSync(EXTRA_FILE,
    '// Automatisch erzeugt von update-data.js - nicht von Hand bearbeiten.\n' +
    'window.EXOPLANET_DATA_EXTRA = ' +
    JSON.stringify(extra).replace(/\],\[/g, '],\n[') + ';\n');
  console.log(total + ' Planeten im Katalog, ' + planets.length +
    ' mit Masse und Umlaufzeit, ' + computed.length +
    ' weitere mit berechneter Umlaufzeit, ' + radiusOnly.length +
    ' ohne Masse (mit Radius) -> ' + path.basename(OUT_FILE) + ', ' + path.basename(EXTRA_FILE));
}

main().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });

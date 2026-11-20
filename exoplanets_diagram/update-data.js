#!/usr/bin/env node
// Lädt den aktuellen Katalog von exoplanet.eu und schreibt daraus data.js.
// Aufruf:  node update-data.js
//
// data.js wird von index.html per <script> eingebunden. Dadurch läuft die
// Seite auch per Doppelklick (file://) ohne Webserver.

'use strict';

const fs = require('fs');
const path = require('path');

const CSV_URL = 'https://exoplanet.eu/catalog/csv/';
const OUT_FILE = path.join(__dirname, 'data.js');

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
    'star_sp_type', 'star_teff', 'star_radius', 'star_mass', 'semi_major_axis', 'eccentricity']) {
    col[name] = header.indexOf(name);
    if (col[name] < 0) throw new Error('Spalte fehlt im Katalog: ' + name);
  }

  const planets = [];
  let total = 0;
  for (const r of rows.slice(1)) {
    if (r.length < header.length) continue;
    total++;
    // Wie im alten Katalog: echte Masse, sonst M·sin(i).
    const mass = positiveNumber(r[col.mass]) ?? positiveNumber(r[col.mass_sini]);
    const period = positiveNumber(r[col.orbital_period]);
    if (mass === null || period === null) continue;
    const year = parseInt(r[col.discovered], 10);
    planets.push([r[col.name], mass, period, r[col.detection_type],
      Number.isFinite(year) ? year : null,
      r[col.star_sp_type].trim(), positiveNumber(r[col.star_teff]),
      positiveNumber(r[col.star_radius]), positiveNumber(r[col.star_mass]),
      positiveNumber(r[col.semi_major_axis]), positiveNumber(r[col.eccentricity])]);
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
    //  große Halbachse der Planetenbahn in AE, Bahnexzentrizität]
    planets: planets,
  };
  const js =
    '// Automatisch erzeugt von update-data.js - nicht von Hand bearbeiten.\n' +
    'window.EXOPLANET_DATA = ' +
    JSON.stringify(data).replace(/\],\[/g, '],\n[') + ';\n';
  fs.writeFileSync(OUT_FILE, js);
  console.log(total + ' Planeten im Katalog, ' + planets.length +
    ' mit Masse und Umlaufzeit -> ' + path.basename(OUT_FILE));
}

main().catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });

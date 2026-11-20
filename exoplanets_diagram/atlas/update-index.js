#!/usr/bin/env node
// Erzeugt atlas/discoveries.js aus den Berichten in atlas/discoveries/.
// Aufruf:  node atlas/update-index.js
//
// Jeder Bericht besteht aus zwei Dateien mit demselben Namen:
//   discoveries/de/<id>.html  und  discoveries/en/<id>.html
// Maßgeblich für Datum, Planeten und Schlagwörter ist die deutsche Datei:
//   <article class="exo-story" data-id="..." data-date="2023-03-27"
//            data-planets="TRAPPIST-1 b" data-mentioned="TRAPPIST-1 c|TRAPPIST-1 d"
//            data-tags="rocky,atmosphere">
// data-planets:   Planeten, um die es geht (Namen wie im Katalog, mit | getrennt)
// data-mentioned: weitere erwähnte Planeten
// Der Titel ist die Überschrift <h2> der jeweiligen Sprache.

'use strict';

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'discoveries');
const OUT_FILE = path.join(__dirname, 'discoveries.js');

function unescapeHtml(s) {
  return s.replace(/&quot;/g, '"').replace(/&#(39|x27);/gi, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function attr(tag, name) {
  const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"'));
  return m ? unescapeHtml(m[1]) : '';
}
function read(lang, id) {
  const file = path.join(DIR, lang, id + '.html');
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  const tag = (html.match(/<article[^>]*class="exo-story"[^>]*>/) || [''])[0];
  const title = (html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || ['', ''])[1];
  const img = (html.match(/<img[^>]*\ssrc="([^"]*)"/) || ['', ''])[1];
  return { tag: tag, title: unescapeHtml(title.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()), img: path.basename(img) };
}
const list = (s) => s.split('|').map((x) => x.trim()).filter(Boolean);

const ids = fs.readdirSync(path.join(DIR, 'de')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort();
const stories = [];
let problems = 0;
for (const id of ids) {
  const de = read('de', id), en = read('en', id);
  if (!de.tag) { console.error('Fehler: kein <article class="exo-story"> in de/' + id + '.html'); problems++; continue; }
  if (!en) { console.error('Hinweis: en/' + id + '.html fehlt'); problems++; }
  if (attr(de.tag, 'data-id') !== id) { console.error('Fehler: data-id passt nicht zum Dateinamen: ' + id); problems++; }
  const date = attr(de.tag, 'data-date');
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(date)) { console.error('Fehler: data-date fehlt oder ist kein Datum: ' + id); problems++; continue; }
  if (de.img && !fs.existsSync(path.join(__dirname, 'images', de.img))) { console.error('Fehler: Bild fehlt: images/' + de.img + ' (' + id + ')'); problems++; }
  stories.push({
    id: id, date: date,
    title: { de: de.title, en: en ? en.title : de.title },
    planets: list(attr(de.tag, 'data-planets')).map((n) => ({ n: n, main: true }))
      .concat(list(attr(de.tag, 'data-mentioned')).map((n) => ({ n: n }))),
    tags: attr(de.tag, 'data-tags').split(',').map((x) => x.trim()).filter(Boolean),
    img: de.img || null,
  });
}
stories.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));

fs.writeFileSync(OUT_FILE,
  '// Automatisch erzeugt von update-index.js - nicht von Hand bearbeiten.\n' +
  'window.EXO_DISCOVERIES = [\n' + stories.map((s) => JSON.stringify(s)).join(',\n') + '\n];\n');
console.log(stories.length + ' Berichte -> ' + path.basename(OUT_FILE) + (problems ? ' (' + problems + ' Hinweise, siehe oben)' : ''));

// Planetennamen gegen den Katalog prüfen, wenn die Daten vorhanden sind.
try {
  global.window = {};
  require(path.join(__dirname, '..', 'data.js'));
  require(path.join(__dirname, '..', 'data-extra.js'));
  const d = global.window.EXOPLANET_DATA, x = global.window.EXOPLANET_DATA_EXTRA;
  const names = new Set(d.planets.concat(x.computed, x.radiusOnly).map((r) => r[0]));
  for (const s of stories) {
    const missing = s.planets.filter((p) => !names.has(p.n)).map((p) => p.n);
    if (missing.length) console.log('  nicht im Diagramm (' + s.id + '): ' + missing.join(', '));
  }
} catch (e) {
  console.log('  (Planetennamen nicht geprüft: ' + e.message + ')');
}

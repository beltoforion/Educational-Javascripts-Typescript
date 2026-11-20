#!/usr/bin/env node
// Pflegt die Berichte in atlas/discoveries/ und alles, was aus ihnen folgt.
// Aufruf:  node atlas/update-index.js
//
// Erzeugt bzw. erneuert:
//   atlas/discoveries.js               Verzeichnis der Berichte für atlas.js
//   discoveries/<sprache>/<id>.html    Kopf, Navigation und Fuß jeder Berichtsseite
//                                      (der Bericht selbst, <article>, bleibt unberührt)
//   discoveries/<sprache>/index.html   Übersicht aller Berichte
//   atlas/sitemap.xml                  Adressen aller Berichtsseiten (nur mit site.json)
//
// Jeder Bericht besteht aus zwei Dateien mit demselben Namen:
//   discoveries/de/<id>.html  und  discoveries/en/<id>.html
// Für einen neuen Bericht genügt in jeder Datei das Element <article>; alles
// darum herum schreibt dieses Skript. Maßgeblich für Datum, Planeten und
// Schlagwörter ist die deutsche Datei:
//   <article class="exo-story" data-id="..." data-date="2023-03-27"
//            data-planets="TRAPPIST-1 b" data-mentioned="TRAPPIST-1 c|TRAPPIST-1 d"
//            data-tags="rocky,atmosphere">
// data-planets:   Planeten, um die es geht (Namen wie im Katalog, mit | getrennt)
// data-mentioned: weitere erwähnte Planeten
// Berichte über Planeten unseres Sonnensystems tragen stattdessen
//   data-solar="earth" (mercury, venus, earth, mars, jupiter, saturn, uranus,
//   neptune) und brauchen kein Datum. Sie erscheinen nicht auf der Zeitleiste,
//   sondern bei der Marke des Planeten und in der Reihe "Unser Sonnensystem".
//   Optional: data-moons="95" data-moons-asof="2025-08" (bekannte Monde, Stand),
//   data-thumb="50% 50% 135%" (Ausschnitt für das runde Vorschaubild).
// Der Titel ist die Überschrift <h2> der jeweiligen Sprache.
//
// Für Suchmaschinen: Jede Berichtsseite bekommt Titel, Beschreibung (aus dem
// ersten Absatz), Vorschaubild und strukturierte Daten. Liegt neben diesem
// Skript die Datei site.json mit den Adressen der Website, kommen die
// maßgebliche Adresse (canonical), die Sprachverweise (hreflang), Links zum
// Atlas, zu Impressum und Datenschutz sowie die Sitemap dazu. Ohne site.json
// bleiben die Seiten ohne feste Adressen (z. B. für eine eigene Kopie).

'use strict';

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'discoveries');
const OUT_FILE = path.join(__dirname, 'discoveries.js');
const SITE_FILE = path.join(__dirname, 'site.json');
const SITEMAP_FILE = path.join(__dirname, 'sitemap.xml');
const LANGS = ['de', 'en'];
const INDEX_NAME = 'index';   // discoveries/<sprache>/index.html ist die Übersicht, kein Bericht

function unescapeHtml(s) {
  return s.replace(/&quot;/g, '"').replace(/&#(39|x27);/gi, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function plainText(html) {
  return unescapeHtml(html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
}
function attr(tag, name) {
  const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"'));
  return m ? unescapeHtml(m[1]) : '';
}
function read(lang, id) {
  const file = path.join(DIR, lang, id + '.html');
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  const article = (html.match(/<article[^>]*class="exo-story"[\s\S]*<\/article>/) || [''])[0];
  const tag = (article.match(/<article[^>]*>/) || [''])[0];
  const title = (article.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || ['', ''])[1];
  const imgTag = (article.match(/<img[^>]*>/) || [''])[0];
  // Erster Absatz des Textes (ohne Datum, Kennzeichnung, Quellen): Beschreibung der Seite.
  const lead = (article.match(/<p>([\s\S]*?)<\/p>/) || ['', ''])[1];
  return { file: file, html: html, article: article, tag: tag, title: plainText(title),
    img: path.basename(attr(imgTag, 'src')), lead: plainText(lead) };
}
const list = (s) => s.split('|').map((x) => x.trim()).filter(Boolean);

const ids = fs.readdirSync(path.join(DIR, 'de')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5))
  .filter((id) => id !== INDEX_NAME).sort();
const SOLAR_KEYS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const stories = [];
const solarStories = [];
const pages = new Map();   // id -> { de, en }: Inhalt der Dateien
let problems = 0;
for (const id of ids) {
  const de = read('de', id), en = read('en', id);
  if (!de.tag) { console.error('Fehler: kein <article class="exo-story"> in de/' + id + '.html'); problems++; continue; }
  if (!en) { console.error('Hinweis: en/' + id + '.html fehlt'); problems++; }
  else if (!en.tag) { console.error('Fehler: kein <article class="exo-story"> in en/' + id + '.html'); problems++; }
  if (attr(de.tag, 'data-id') !== id) { console.error('Fehler: data-id passt nicht zum Dateinamen: ' + id); problems++; }
  if (de.img && !fs.existsSync(path.join(__dirname, 'images', de.img))) { console.error('Fehler: Bild fehlt: images/' + de.img + ' (' + id + ')'); problems++; }
  pages.set(id, { de: de, en: en && en.tag ? en : null });
  const solar = attr(de.tag, 'data-solar');
  if (solar) {
    if (SOLAR_KEYS.indexOf(solar) < 0) { console.error('Fehler: unbekannter Planet in data-solar: ' + solar + ' (' + id + ')'); problems++; continue; }
    const entry = { id: id, solar: solar, title: { de: de.title, en: en ? en.title : de.title }, img: de.img || null };
    // Zahl der bekannten Monde und Stand dieser Zahl (für den Steckbrief).
    if (/^\d+$/.test(attr(de.tag, 'data-moons'))) {
      entry.moons = Number(attr(de.tag, 'data-moons'));
      entry.moonsAsOf = attr(de.tag, 'data-moons-asof');
    }
    // Ausschnitt für das runde Vorschaubild: "waagrecht senkrecht Vergrößerung".
    if (attr(de.tag, 'data-thumb')) entry.thumb = attr(de.tag, 'data-thumb');
    solarStories.push(entry);
    continue;
  }
  const date = attr(de.tag, 'data-date');
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(date)) { console.error('Fehler: data-date fehlt oder ist kein Datum: ' + id); problems++; continue; }
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
solarStories.sort((a, b) => SOLAR_KEYS.indexOf(a.solar) - SOLAR_KEYS.indexOf(b.solar));

fs.writeFileSync(OUT_FILE,
  '// Automatisch erzeugt von update-index.js - nicht von Hand bearbeiten.\n' +
  'window.EXO_DISCOVERIES = [\n' + stories.concat(solarStories).map((s) => JSON.stringify(s)).join(',\n') + '\n];\n');
console.log(stories.length + ' Berichte, ' + solarStories.length + ' zum Sonnensystem -> ' + path.basename(OUT_FILE) +
  (problems ? ' (' + problems + ' Hinweise, siehe oben)' : ''));

// ================================================================ Seiten
// Kopf, Navigation und Fuß der Berichtsseiten, die Übersicht und die Sitemap.
let site = null;
if (fs.existsSync(SITE_FILE)) {
  try { site = JSON.parse(fs.readFileSync(SITE_FILE, 'utf8')); }
  catch (e) { console.error('Fehler: site.json ist kein gültiges JSON (' + e.message + ')'); problems++; }
}
const TX = {
  de: { locale: 'de_DE', atlas: 'Atlas der Exoplaneten', all: 'Alle Berichte', other: 'English', otherLang: 'en',
    older: 'Älterer Bericht', newer: 'Neuerer Bericht', inner: 'Weiter innen', outer: 'Weiter außen',
    solarGroup: 'Unser Sonnensystem', toAtlas: 'Im Atlas der Exoplaneten ansehen',
    indexTitle: 'Berichte über Exoplaneten', indexLead: (n) => n + ' Berichte über Entdeckungen bei Planeten fremder Sterne, die neuesten zuerst. ' +
      'Jeder Bericht gehört zu einem oder mehreren Planeten im Atlas der Exoplaneten.',
    indexDescription: (n) => 'Übersicht über ' + n + ' Berichte zu Exoplaneten: Entdeckungen, Atmosphären, erdähnliche Planeten und direkt abgebildete Welten, mit Bildern und Quellen.',
    solarLead: 'Die acht Planeten der Sonne als Vergleich.',
    imageNote: 'Bilder: Urheber und Lizenz stehen in der Bildunterschrift jedes Berichts. Die Bilder wurden verkleinert und in das Format WebP umgewandelt; am Bildinhalt wurde nichts verändert.' },
  en: { locale: 'en_US', atlas: 'Atlas of Exoplanets', all: 'All stories', other: 'Deutsch', otherLang: 'de',
    older: 'Older story', newer: 'Newer story', inner: 'Further in', outer: 'Further out',
    solarGroup: 'Our Solar System', toAtlas: 'View in the Atlas of Exoplanets',
    indexTitle: 'Stories about exoplanets', indexLead: (n) => n + ' stories about discoveries on planets around other stars, newest first. ' +
      'Each story belongs to one or more planets in the Atlas of Exoplanets.',
    indexDescription: (n) => 'Overview of ' + n + ' stories about exoplanets: discoveries, atmospheres, Earth-like planets and directly imaged worlds, with images and sources.',
    solarLead: 'The eight planets of the Sun for comparison.',
    imageNote: 'Images: creator and license are given in the caption of each story. The images were reduced in size and converted to WebP; their content was not changed.' },
};
function dateText(iso, lang) {
  const parts = String(iso).split('-').map(Number);
  if (parts.length === 1) return String(parts[0]);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] || 1));
  const opt = parts.length === 2 ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
  return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', opt);
}
// Kürzt auf höchstens max Zeichen, möglichst am Satzende, sonst an einer Wortgrenze.
function shorten(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '));
  if (sentence > max * 0.55) return cut.slice(0, sentence + 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:–-]$/, '') + ' …';
}
const storyUrl = (lang, id) => (site ? site.storyBase + lang + '/' + id + '.html' : '');
const indexUrl = (lang) => (site ? site.storyBase + lang + '/' + INDEX_NAME + '.html' : '');
// Adresse des Atlas: mit site.json die der Website, sonst die Seite atlas.html neben dem Ordner atlas/.
const atlasHref = (lang) => (site ? site.atlas[lang] : '../../../atlas.html' + (lang === 'en' ? '?lang=en' : ''));
const jsonLd = (data) => '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>\n';

// Gemeinsamer Kopf: Titel, Beschreibung, Adressen, Vorschau für soziale Netze.
function headHtml(lang, o) {
  const tx = TX[lang];
  let h = '<!DOCTYPE html>\n<html lang="' + lang + '">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + escapeHtml(o.title + ' | ' + tx.atlas) + '</title>\n' +
    '<meta name="description" content="' + escapeHtml(o.description) + '">\n';
  if (o.canonical) h += '<link rel="canonical" href="' + escapeHtml(o.canonical) + '">\n';
  for (const alt of o.alternates) h += '<link rel="alternate" hreflang="' + alt[0] + '" href="' + escapeHtml(alt[1]) + '">\n';
  h += '<meta property="og:type" content="' + o.type + '">\n' +
    '<meta property="og:title" content="' + escapeHtml(o.title) + '">\n' +
    '<meta property="og:description" content="' + escapeHtml(o.description) + '">\n' +
    '<meta property="og:locale" content="' + tx.locale + '">\n';
  if (site) h += '<meta property="og:site_name" content="' + escapeHtml(site.siteName) + '">\n';
  if (o.canonical) h += '<meta property="og:url" content="' + escapeHtml(o.canonical) + '">\n';
  if (o.image) h += '<meta property="og:image" content="' + escapeHtml(o.image) + '">\n';
  h += '<meta name="twitter:card" content="' + (o.image ? 'summary_large_image' : 'summary') + '">\n';
  if (o.ld) h += jsonLd(o.ld);
  h += '<link rel="stylesheet" href="../../snippet.css">\n</head>\n<body' + (o.bodyClass ? ' class="' + o.bodyClass + '"' : '') + '>\n';
  return h;
}
function navHtml(lang, otherHref, withAll) {
  const tx = TX[lang];
  return '<nav class="exo-nav">\n<a class="exo-nav-home" href="' + escapeHtml(atlasHref(lang)) + '">' + tx.atlas + '</a>\n' +
    (withAll ? '<a href="' + INDEX_NAME + '.html">' + tx.all + '</a>\n' : '') +
    (otherHref ? '<a href="' + escapeHtml(otherHref) + '" hreflang="' + tx.otherLang + '" lang="' + tx.otherLang + '">' + tx.other + '</a>\n' : '') +
    '</nav>\n';
}
function footHtml(lang) {
  const links = site && site.links && site.links[lang] ? site.links[lang] : [];
  if (!links.length) return '';
  return '<footer class="exo-foot">\n' + links.map((l) => '<a href="' + escapeHtml(l.href) + '">' + escapeHtml(l.text) + '</a>').join('\n') + '\n</footer>\n';
}
function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return 0;
  fs.writeFileSync(file, content);
  return 1;
}

let written = 0;
const sitemap = [];
for (const lang of LANGS) {
  const tx = TX[lang];
  const other = tx.otherLang;
  const ordered = stories.map((s, i) => ({ s: s, prev: stories[i - 1], next: stories[i + 1], labels: [tx.older, tx.newer] }))
    .concat(solarStories.map((s, i) => ({ s: s, prev: solarStories[i - 1], next: solarStories[i + 1], labels: [tx.inner, tx.outer] })));
  const available = (id) => pages.has(id) && pages.get(id)[lang];
  for (const item of ordered) {
    const s = item.s, page = pages.get(s.id)[lang];
    if (!page) continue;
    const hasOther = !!pages.get(s.id)[other];
    const url = storyUrl(lang, s.id);
    const image = page.img ? (site ? site.imageBase + page.img : '../../images/' + page.img) : '';
    const description = shorten(page.lead || page.title, 158);
    const alternates = site && hasOther ? [['de', storyUrl('de', s.id)], ['en', storyUrl('en', s.id)], ['x-default', storyUrl('en', s.id)]] : [];
    const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: shorten(page.title, 110), description: description, inLanguage: lang };
    if (url) { ld.url = url; ld.mainEntityOfPage = url; }
    if (image && site) ld.image = image;
    if (s.date) ld.contentReferenceTime = s.date;   // wann das Berichtete geschah (kein Veröffentlichungsdatum der Seite)
    if (s.planets) ld.about = s.planets.filter((p) => p.main).map((p) => ({ '@type': 'Thing', name: p.n }));
    if (site) {
      ld.isPartOf = { '@type': 'WebApplication', name: tx.atlas, url: site.atlas[lang] };
      ld.publisher = { '@type': 'Organization', name: site.siteName, url: site.siteUrl };
    }
    let html = headHtml(lang, { title: page.title, description: description, canonical: url, alternates: alternates, image: image, type: 'article', ld: ld });
    html += navHtml(lang, hasOther ? '../' + other + '/' + s.id + '.html' : '', true);
    html += page.article + '\n';
    // Blättern: bei den Berichten zeitlich, bei den Planeten der Sonne von innen nach außen.
    const pager = [[item.prev, item.labels[0], 'prev'], [item.next, item.labels[1], 'next']].filter((p) => p[0] && available(p[0].id));
    html += '<nav class="exo-pager">\n' + pager.map((p) => '<a class="exo-pager-' + p[2] + '" href="' + p[0].id + '.html" rel="' + p[2] + '"><small>' + p[1] +
      '</small>' + escapeHtml(p[0].title[lang]) + '</a>\n').join('') + '</nav>\n';
    html += '<p class="exo-to-atlas"><a href="' + escapeHtml(atlasHref(lang)) + '">' + tx.toAtlas + '</a></p>\n';
    html += footHtml(lang) + '<script src="../../snippet.js"></script>\n</body>\n</html>\n';
    written += writeIfChanged(page.file, html);
    if (url) sitemap.push(url);
  }

  // ---- Übersicht aller Berichte dieser Sprache
  const listed = stories.filter((s) => available(s.id)).reverse();
  const solarListed = solarStories.filter((s) => available(s.id));
  const hasOtherIndex = LANGS.indexOf(other) >= 0;
  const idxUrl = indexUrl(lang);
  const idxLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: tx.indexTitle, description: tx.indexDescription(listed.length), inLanguage: lang };
  if (idxUrl) idxLd.url = idxUrl;
  if (site) idxLd.isPartOf = { '@type': 'WebApplication', name: tx.atlas, url: site.atlas[lang] };
  let idx = headHtml(lang, { title: tx.indexTitle, description: tx.indexDescription(listed.length), canonical: idxUrl,
    alternates: site ? [['de', indexUrl('de')], ['en', indexUrl('en')], ['x-default', indexUrl('en')]] : [], image: '', type: 'website', ld: idxLd,
    bodyClass: 'exo-index-page' });
  idx += navHtml(lang, hasOtherIndex ? '../' + other + '/' + INDEX_NAME + '.html' : '', false);
  idx += '<main class="exo-index">\n<h1>' + tx.indexTitle + '</h1>\n<p>' + tx.indexLead(listed.length) + '</p>\n';
  let year = '';
  for (const s of listed) {
    const y = s.date.slice(0, 4);
    if (y !== year) { idx += (year ? '</ul>\n' : '') + '<h2>' + y + '</h2>\n<ul>\n'; year = y; }
    idx += '<li><a href="' + s.id + '.html">' + escapeHtml(s.title[lang]) + '</a> <span>' + dateText(s.date, lang) + '</span></li>\n';
  }
  if (year) idx += '</ul>\n';
  if (solarListed.length) {
    idx += '<h2>' + tx.solarGroup + '</h2>\n<p>' + tx.solarLead + '</p>\n<ul>\n' +
      solarListed.map((s) => '<li><a href="' + s.id + '.html">' + escapeHtml(s.title[lang]) + '</a></li>\n').join('') + '</ul>\n';
  }
  idx += '<p class="exo-index-note">' + tx.imageNote + '</p>\n</main>\n' + footHtml(lang) + '</body>\n</html>\n';
  written += writeIfChanged(path.join(DIR, lang, INDEX_NAME + '.html'), idx);
  if (idxUrl) sitemap.push(idxUrl);
}

// ---- Sitemap der Berichtsseiten (nur mit den Adressen aus site.json)
if (site) {
  written += writeIfChanged(SITEMAP_FILE, '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!-- Automatisch erzeugt von update-index.js - nicht von Hand bearbeiten. -->\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemap.map((u) => '<url><loc>' + escapeHtml(encodeURI(u)) + '</loc></url>\n').join('') + '</urlset>\n');
} else if (fs.existsSync(SITEMAP_FILE)) {
  fs.unlinkSync(SITEMAP_FILE);
}
console.log('Seiten: ' + sitemap.length + ' Adressen' + (site ? ' in sitemap.xml' : ' (ohne site.json: keine festen Adressen, keine Sitemap)') +
  ', ' + written + ' Dateien neu geschrieben');

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

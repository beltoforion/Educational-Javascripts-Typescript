// Prüft, dass der Atlas die Applets mit denselben Skripten lädt wie deren eigene Seiten.
// Aufruf:  node --test applets/exoplanet-atlas/test/methods.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../atlas/methods.js');
const methods = globalThis.ExoAtlasMethods;
const atlasDir = path.join(__dirname, '..');

for (const applet of methods.applets) {
  test(`Skriptliste von ${applet.id} stimmt mit index.html des Applets überein`, () => {
    const folder = path.join(atlasDir, applet.folder);
    const html = fs.readFileSync(path.join(folder, 'index.html'), 'utf8');
    const sources = [...html.matchAll(/<script src="([^"]+\.js)"><\/script>/g)].map((m) => m[1]);
    const kit = sources.filter((s) => s.includes('exo-kit')).map((s) => path.basename(s, '.js'));
    const own = sources.filter((s) => !s.includes('exo-kit')).map((s) => path.basename(s, '.js'));
    assert.deepEqual(kit, methods.kitScripts);
    assert.deepEqual(own, applet.scripts);
    for (const name of applet.scripts) assert.ok(fs.existsSync(path.join(folder, 'js', name + '.js')), name);
  });

  test(`${applet.id}: Vorschaubild und Texte in beiden Sprachen`, () => {
    assert.ok(fs.existsSync(path.join(atlasDir, 'atlas/images/methods', applet.id + '.jpg')));
    for (const lang of ['de', 'en']) {
      const entry = methods.texts[lang].applets[applet.id];
      assert.ok(entry && entry.title && entry.text, lang);
    }
  });
}

test('deutsche und englische Texte haben dieselben Einträge', () => {
  assert.deepEqual(Object.keys(methods.texts.de).sort(), Object.keys(methods.texts.en).sort());
});

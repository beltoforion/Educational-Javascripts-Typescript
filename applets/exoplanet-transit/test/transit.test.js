// Prüft die Rechnung.  Aufruf:  node --test applets/exoplanet-transit/test/transit.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/config.js');
require('../js/transit-model.js');
const TR = globalThis.Transit, m = TR.config.model;
const model = new TR.TransitModel(m);
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} statt ${b} ± ${tol}`);

test('gemeinsame Fläche zweier Kreise', () => {
  near(TR.TransitModel.overlap(10, 2, 20), 0, 0);
  near(TR.TransitModel.overlap(10, 2, 3), Math.PI * 4, 1e-12);          // kleiner Kreis ganz im großen
  near(TR.TransitModel.overlap(5, 5, 0), Math.PI * 25, 1e-12);
  near(TR.TransitModel.overlap(10, 2, 10), Math.PI * 4 / 2, 0.3);       // Mitte auf dem Rand: etwa die Hälfte
});

test('der Planet steht bei p = 0,25 vor und bei p = 0,75 hinter dem Stern', () => {
  assert.equal(model.planet(0.25).front, true);
  assert.equal(model.planet(0.75).front, false);
  near(model.planet(0.25).x, 0, 1e-9);
  near(model.planet(0).x, -m.orbitRadius, 1e-9);
  near(model.planet(0.5).x, m.orbitRadius, 1e-9);
});

test('aus der Stellung des Zeigers ergibt sich der Fortschritt, vor wie hinter dem Stern', () => {
  for (const p of [0.02, 0.2, 0.25, 0.4, 0.55, 0.75, 0.9]) {
    const planet = model.planet(p);
    near(model.progressAt(planet.x, !planet.front), p, 1e-9);
  }
  assert.equal(model.planet(model.progressAt(40, true)).front, false);
  assert.equal(model.planet(model.progressAt(40, false)).front, true);
});

test('nur während des Transits verdeckt der Planet einen Teil der Sternscheibe', () => {
  for (const p of [0, 0.1, 0.4, 0.5, 0.6, 0.75, 0.9]) near(model.transitLoss(p), 0, 0);
  const ratio = (m.planetRadius / m.starRadius) ** 2;
  // der Planet zieht wegen der leicht geneigten Bahn etwas unterhalb der Scheibenmitte vorbei
  const r = m.orbitRadius * m.orbitTilt / m.starRadius, u = m.limbDarkening;
  near(model.transitLoss(0.25), ratio * (1 - u * (1 - Math.sqrt(1 - r * r))) / (1 - u / 3), 1e-9);
  for (const d of [0.005, 0.02, 0.035]) near(model.transitLoss(0.25 - d), model.transitLoss(0.25 + d), 1e-12);
  assert.ok(model.transitLoss(0.25) > model.transitLoss(0.28));          // am Rand flacher als in der Mitte
});

test('die Phase des Planeten: Nachtseite beim Transit, voll beleuchtet hinter dem Stern', () => {
  near(model.phaseAngle(0.25), Math.PI, 1e-9);
  near(model.phaseAngle(0.75), 0, 1e-6);
  near(model.phaseAngle(0), Math.PI / 2, 1e-9);
  near(model.reflection(0.25), 0, 1e-12);
  near(model.reflection(0), m.reflection / Math.PI, 1e-12);              // halb beleuchtete Lambert-Kugel
  near(model.reflection(0.5), model.reflection(0), 1e-12);
});

test('hinter dem Stern fällt das Licht des Planeten weg: die sekundäre Bedeckung', () => {
  near(model.planetVisible(0.75), 0, 0);
  near(model.reflection(0.75), 0, 0);
  near(model.planetVisible(0.6), 1, 0);
  // kurz vor der Bedeckung ist der Planet fast voll beleuchtet zu sehen
  let best = 0;
  for (let p = 0.6; p < 0.75; p += 0.001) best = Math.max(best, model.reflection(p));
  assert.ok(best > 0.9 * m.reflection, String(best));
  // die Bedeckung ist viel flacher als der Transit
  assert.ok(best < 0.3 * model.transitLoss(0.25));
});

test('ellipsoidale Variation: am hellsten, wenn der Planet seitlich steht, zweimal je Umlauf', () => {
  near(model.ellipsoidal(0), m.ellipsoidal, 1e-12);
  near(model.ellipsoidal(0.5), m.ellipsoidal, 1e-12);
  near(model.ellipsoidal(0.25), -m.ellipsoidal, 1e-12);
  near(model.ellipsoidal(0.75), -m.ellipsoidal, 1e-12);
});

test('Doppler-Beaming: heller, während der Stern auf uns zukommt, also nach dem Transit', () => {
  near(model.beaming(0.5), m.beaming, 1e-12);
  near(model.beaming(0), -m.beaming, 1e-12);
  near(model.beaming(0.25), 0, 1e-12);
  // nach dem Transit entfernt sich der Planet (er läuft nach hinten), der Stern kommt entgegen
  assert.ok(model.beaming(0.35) > 0);
});

test('die Gesamthelligkeit setzt sich aus den Anteilen zusammen', () => {
  for (const p of [0.05, 0.3, 0.62, 0.9]) {
    near(model.brightness(p), (1 - model.transitLoss(p)) * (1 + model.ellipsoidal(p) + model.beaming(p)) + model.reflection(p), 1e-15);
  }
});

test('der Wertebereich der feinen Effekte umfasst alle Anteile, aber nicht den Transit', () => {
  const range = model.fineRange();
  assert.ok(range.max >= 1 + 0.9 * m.reflection && range.max < 1 + m.reflection + m.ellipsoidal + m.beaming + m.noise + 1e-9);
  assert.ok(range.min <= 1 - m.ellipsoidal && range.min > 1 - 0.3 * model.transitLoss(0.25));
  for (const p of [0.05, 0.4, 0.6, 0.75, 0.9]) assert.ok(model.brightness(p) >= range.min && model.brightness(p) <= range.max);
});

test('die Lichtkurve mit Rauschen bleibt im Wertebereich des Diagramms', () => {
  const range = TR.config.view.fullRange;
  for (let i = 0; i <= m.samples; i++) {
    const v = model.measured(i);
    assert.ok(v > range.min && v < range.max, `${i}: ${v}`);
  }
});

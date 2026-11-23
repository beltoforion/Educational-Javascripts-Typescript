// Prüft die Rechnung.  Aufruf:  node --test applets/exoplanet-microlensing/test/physics.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../../../shared/exo-kit/js/kit.js');
require('../js/config.js');
require('../js/lens-system.js');
require('../js/image-brightness.js');
require('../js/light-curve.js');
require('../js/layout.js');
require('../js/ray-tracer.js');
const ML = globalThis.Microlensing;

const model = ML.config.model, view = ML.config.view;
const star = { offset: 0, mass: 1 };
const planet = { offset: model.planetOffset, mass: model.planetMass };
const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} statt ${expected} ± ${tolerance}`);

// ---- Linsengleichung (mit ihr werden die verzerrten Bilder gezeichnet und ihre Helligkeit bestimmt)

test('ein einzelner Stern erzeugt zwei Bilder an den Stellen der Punktlinsenformel', () => {
  const lens = new ML.LensSystem([star]);
  for (const u of [0.2, 0.7, 1.5, 3]) {
    const images = lens.axisImages(0, -u);          // Stern links der Quelle im Abstand u
    assert.equal(images.length, 2);
    const root = Math.sqrt(u * u + 4);
    near(images[0].x - (-u), (u - root) / 2, 1e-9);
    near(images[1].x - (-u), (u + root) / 2, 1e-9);
    near(images[0].magnification + images[1].magnification, ML.LensSystem.pointLensMagnification(u), 1e-6);
  }
});

test('die Bilder erfüllen die Linsengleichung', () => {
  const lens = new ML.LensSystem([star, planet]);
  const out = [0, 0];
  for (const lensX of [-3, -1.2, -0.4, 0.3, 2]) {
    const images = lens.axisImages(0, lensX);
    assert.equal(images.length, 3);
    for (const image of images) {
      lens.sourcePosition(image.x, 0, lensX, out);
      near(out[0], 0, 1e-6);   // sourcePosition glättet die Pole geringfügig
    }
  }
});

// ---- Strahlverfolgung durch das Schwerefeld

const layout = new ML.Layout(view, view.panels[0]);
const tracer = new ML.RayTracer(layout, view.telescopeAperture);
const total = view.telescopeY - view.sourceY;
const starAt = theta => ({ x: layout.lensPlaneX(theta), mass: 1, radius: view.starSize / 2 + 1 });

// Stern und Planet zu dem Zeitpunkt, an dem der hellere Strahl am Planeten vorbeiläuft (wie in Stage)
function atPlanetCrossing() {
  const s = model.planetOffset, lensStar = starAt(-(s - 1 / s));
  const major = tracer.arriving([lensStar])[1];      // der rechte, auf der Seite der Quelle
  return { lensStar, body: { x: tracer.crossing(major.points), mass: model.planetMass, radius: view.planetCore } };
}

test('ohne Masse läuft ein Strahl geradeaus', () => {
  const ray = tracer.trace(0.2, 0.1, [], view.telescopeY, true);
  assert.ok(ray.arrived);
  near(ray.x, layout.cx + 0.2 * total, 1e-6);
  near(ray.z, 0.1 * total, 1e-6);
  near(ray.slope, 0.2, 1e-9);
});

test('ein Strahl wird zur Masse hin abgelenkt, in großem Abstand kaum noch', () => {
  const close = tracer.trace(0, 0, [starAt(-1.2)], view.telescopeY, false);
  const far = tracer.trace(0, 0, [starAt(-6)], view.telescopeY, false);
  assert.ok(close.x < layout.cx - 15, `nah: ${close.x - layout.cx}`);
  assert.ok(far.x < layout.cx && far.x > layout.cx - 6, `fern: ${far.x - layout.cx}`);     // auf 260 Pixel Weg
});

test('kein Strahl des Fächers wird zurückgeworfen', () => {
  for (const lensX of [-4, -2.5, -1, -0.3, 0, 0.8, 2, 4]) {
    for (const ray of tracer.fan([starAt(lensX)], view.groundY)) {
      const p = ray.points;
      for (let i = 1; i < p.length; i++) assert.ok(p[i][1] > p[i - 1][1] - 1e-9, `Stern bei ${lensX}: Strahl läuft aufwärts`);
    }
  }
});

test('steht der Stern genau vor der Quelle, erscheint das Bild im Abstand des Einsteinrings', () => {
  const hits = tracer.arriving([{ x: layout.cx, mass: 1, radius: 1 }]);
  assert.equal(hits.length, 2);
  near(hits[0].apparentX - layout.cx, -layout.skyScale, 0.05);
  near(hits[1].apparentX - layout.cx, layout.skyScale, 0.05);
});

test('liegt der Planet auf dem Weg des helleren Strahls, kommt ein weiterer Strahl an', () => {
  const { lensStar, body } = atPlanetCrossing();
  assert.ok(body.x > lensStar.x && body.x - lensStar.x < model.planetOffset * layout.lensScale);
  assert.equal(tracer.arriving([lensStar]).length, 2);
  assert.equal(tracer.arriving([lensStar, body]).length, 3);
});

test('gezeichnet werden beim Durchgang mehr Treffer als ohne Linse', () => {
  const step = tracer.stepFor(view.raysShown);
  const without = tracer.hits([], step).length;
  assert.ok(without >= 1 && without <= 2 * view.raysShown, String(without));
  assert.ok(tracer.hits([starAt(0)], step).length > 5 * without);
});

// ---- Helligkeit der verzerrten Bilder (daraus entsteht die Lichtkurve)

const brightnessOf = bodies =>
  new ML.ImageBrightness(new ML.LensSystem(bodies), model.sourceRadius, model.sourceRadius / model.cellsPerRadius);

test('weit vom Stern entfernt gilt die Verstärkung der Punktquelle', () => {
  const b = brightnessOf([star]);
  for (const u of [1, 2, 4]) near(b.magnification(-u), ML.LensSystem.pointLensMagnification(u), 0.01);
});

test('steht der Stern genau vor der Quelle, entsteht ein Einsteinring mit der Verstärkung √(1 + 4/ρ²)', () => {
  const rho = model.sourceRadius, expected = Math.sqrt(1 + 4 / (rho * rho));
  near(brightnessOf([star]).magnification(0), expected, 0.01 * expected);
});

test('die Lichtkurve eines einzelnen Sterns ist symmetrisch', () => {
  const b = brightnessOf([star]);
  for (const u of [0.15, 0.6, 2.2]) near(b.magnification(u) / b.magnification(-u), 1, 1e-3);
});

test('der Planet erzeugt zwei Spitzen mit einer Senke dazwischen', () => {
  const b = brightnessOf([star, planet]), alone = brightnessOf([star]);
  const xs = [], values = [];
  for (let x = -1.3; x <= -0.45; x += 0.01) { xs.push(x); values.push(b.magnification(x)); }
  const first = values.indexOf(Math.max(...values.slice(0, 50)));           // erste Spitze, vor der Senke
  const dip = first + values.slice(first, first + 25).indexOf(Math.min(...values.slice(first, first + 25)));
  const second = Math.max(...values.slice(dip, dip + 30));                  // Anstieg nach der Senke
  assert.ok(values[first] > 1.4 * values[dip], `erste Spitze ${values[first]}, Senke ${values[dip]}`);
  assert.ok(second > 1.4 * values[dip], `zweite Spitze ${second}, Senke ${values[dip]}`);
  assert.ok(values[first] > 2.5 * alone.magnification(xs[first]));
});

test('fern vom Planeten ändert er die Lichtkurve kaum', () => {
  near(brightnessOf([star, planet]).magnification(2.5) / brightnessOf([star]).magnification(2.5), 1, 0.03);
});

test('die Lichtkurve bleibt unter dem oberen Rand des Diagramms', () => {
  const rho = model.sourceRadius, limit = 1.2 * Math.sqrt(1 + 4 / (rho * rho));
  const b = brightnessOf([star, planet]);
  const curve = new ML.LightCurve(x => b.magnification(x), model.travel, 121);
  for (let i = 0; i < curve.count; i++) assert.ok(curve.value(i) < limit && curve.value(i) > 0.98, `${i}: ${curve.value(i)}`);
});

test('Fortschritt und Stellung des Linsensterns lassen sich ineinander umrechnen', () => {
  const curve = new ML.LightCurve(() => 1, model.travel, 11);
  for (const p of [0, 0.25, 0.5, 1]) near(curve.progressOf(curve.lensX(p)), p, 1e-12);
  near(curve.lensX(0), -model.travel, 1e-12);
});

// Prüft die Rechnung.  Aufruf:  node --test applets/exoplanet-radial-velocity/test/orbit.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/config.js');
require('../js/orbit-model.js');
const RV = globalThis.RadialVelocity, m = RV.config.model;
const model = new RV.OrbitModel(m);
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} statt ${b} ± ${tol}`);

test('Stern und Planet stehen sich am Schwerpunkt gegenüber, in festen Abständen', () => {
  for (const p of [0, 0.13, 0.5, 0.77]) {
    const s = model.star(p), q = model.planet(p);
    near(Math.hypot(s.x, s.y), m.starDistance, 1e-9);
    near(Math.hypot(q.x, q.y), m.planetDistance, 1e-9);
    near(s.x * q.y - s.y * q.x, 0, 1e-9);                 // auf einer Geraden durch den Schwerpunkt
    assert.ok(s.x * q.x + s.y * q.y < 0);                 // auf verschiedenen Seiten
  }
});

test('die Radialgeschwindigkeit ist die Bewegung des Sterns vom Beobachter weg', () => {
  const dp = 1e-6;
  for (const p of [0.05, 0.3, 0.6, 0.9]) {
    // der Beobachter sitzt unten: nach oben (kleineres y) heißt weg von ihm
    const speed = -(model.star(p + dp).y - model.star(p - dp).y) / (2 * dp);
    near(speed / (2 * Math.PI * m.starDistance), model.radialVelocity(p), 1e-6);
  }
  near(model.radialVelocity(0.25), 1, 1e-12);
  near(model.radialVelocity(0.75), -1, 1e-12);
});

test('aus der Richtung zum Planeten ergibt sich der Fortschritt', () => {
  for (const p of [0.1, 0.4, 0.65, 0.95]) {
    const q = model.planet(p);
    near(model.progressToward(q.x, q.y), p, 1e-9);
  }
});

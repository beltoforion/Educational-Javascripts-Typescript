// Prüft die Rechnung.  Aufruf:  node --test applets/doppler-effect/test/wave.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/config.js');
require('../js/wave-model.js');
const DP = globalThis.Doppler, m = DP.config.model;
const model = new DP.WaveModel(m);
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} statt ${b} ± ${tol}`);

test('in Bewegungsrichtung liegen die Wellenfronten dichter, dahinter weiter auseinander', () => {
  const fronts = model.fronts(30);
  assert.equal(fronts.length, m.fronts);
  const spacing = model.spacing();
  for (let i = 1; i < fronts.length; i++) {
    // linker Rand = in Bewegungsrichtung, rechter Rand = dahinter
    near((fronts[i].radius - fronts[i].x) - (fronts[i - 1].radius - fronts[i - 1].x), spacing.ahead, 1e-9);
    near((fronts[i].radius + fronts[i].x) - (fronts[i - 1].radius + fronts[i - 1].x), spacing.behind, 1e-9);
  }
  near(spacing.behind / spacing.ahead, (1 + m.starSpeed) / (1 - m.starSpeed), 1e-12);
});

test('eine Wellenfront wächst mit der Wellengeschwindigkeit und verblasst am Ende', () => {
  // 30,0 s und 30,1 s liegen zwischen denselben zwei Aussendungen: Die Fronten behalten ihre Nummern.
  const a = model.fronts(30)[3], b = model.fronts(30.1)[3];
  near(b.radius - a.radius, 0.1 * m.waveSpeed, 1e-9);
  const fronts = model.fronts(30);
  assert.ok(fronts[0].age < fronts[fronts.length - 1].age && fronts[fronts.length - 1].age <= 1);
});

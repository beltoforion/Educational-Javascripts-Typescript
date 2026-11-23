// Prüft die Rechnung.  Aufruf:  node --test applets/exoplanet-pulsar-timing/test/pulsar.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/config.js');
require('../js/pulsar-model.js');
const PT = globalThis.PulsarTiming, m = PT.config.model;
const orbiting = new PT.PulsarModel(m, true), resting = new PT.PulsarModel(m, false);
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} statt ${b} ± ${tol}`);

// Zeitpunkt des Pulses in der Nähe von t0: dort ist das Signal am größten
function pulseTime(model, t0) {
  let best = t0, value = -1;
  for (let t = t0 - 0.4; t <= t0 + 0.4; t += 0.0005) {
    const s = model.signal(t);
    if (s > value) { value = s; best = t; }
  }
  return best;
}

test('der ruhende Pulsar sendet zwei Pulse je Drehung, in gleichen Abständen', () => {
  for (let k = 0; k < 6; k++) {
    near(pulseTime(resting, k * m.spinSeconds / 2), k * m.spinSeconds / 2, 1e-3);
    near(resting.signal(k * m.spinSeconds / 2), 1, 1e-9);
  }
  near(resting.signal(m.spinSeconds / 4), m.baseline, 1e-6);
});

test('Pulsar und Planet stehen sich am Schwerpunkt gegenüber', () => {
  for (const t of [0, 3.3, 9, 17]) {
    const p = orbiting.pulsar(t), q = orbiting.planet(t);
    near(Math.hypot(p.x, p.y), m.pulsarDistance, 1e-9);
    near(p.x * q.y - p.y * q.x, 0, 1e-9);
    assert.ok(p.x * q.x + p.y * q.y < 0);
  }
});

test('die Pulse des umlaufenden Pulsars treffen verschoben ein, mal früher, mal später', () => {
  // seitlich größte Auslenkung nach einem Viertel und nach drei Vierteln des Umlaufs
  const half = m.spinSeconds / 2;
  const quarter = Math.round(m.orbitSeconds / 4 / half) * half, three = Math.round(3 * m.orbitSeconds / 4 / half) * half;
  const early = pulseTime(orbiting, quarter) - quarter, late = pulseTime(orbiting, three) - three;
  assert.ok(Math.abs(early) > 0.03 && Math.abs(late) > 0.03, `${early} ${late}`);
  assert.ok(early * late < 0, `${early} ${late}`);
  // größte Verschiebung: Winkel, unter dem die Bahn von der Erde aus erscheint, als Anteil der Drehung
  const largest = Math.atan(m.pulsarDistance / m.earthDistance) / (2 * Math.PI) * m.spinSeconds;
  assert.ok(Math.abs(early) <= largest + 0.01 && Math.abs(late) <= largest + 0.01);
});

test('steht der Pulsar genau zwischen Schwerpunkt und Erde, kommt der Puls pünktlich', () => {
  near(pulseTime(orbiting, 0), 0, 2e-3);
});

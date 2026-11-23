// Startpunkt ohne Darstellung, für headless.html. Rechnet eine Wolke so schnell wie möglich eine feste Zahl von
// Schritten weit und schreibt das Ergebnis als JSON in die Seite. Lädt nur den Kern: weder Kamera noch Bild noch Regler.
//   headless.html?n=4096&seed=22&steps=4000        weitere Angaben: diss, md, eddy, turb, merge=0
(function (Disk) {
'use strict';

function run() {
  const out = document.getElementById('out');
  const show = result => { out.textContent = JSON.stringify(result, null, 1); document.title = result.fehler ? 'Fehler' : 'fertig'; };
  const query = new URLSearchParams(location.search);
  const params = Disk.createParams(location.search);
  for (const key of ['diss', 'md', 'eddy', 'turb']) if (query.has(key)) params[key] = +query.get(key);
  if (query.get('merge') === '0') params.merge = false;
  const steps = +(query.get('steps') || 2000);
  const seed = query.has('seed') ? +query.get('seed') : undefined;

  // Eine Zeichenfläche, die nirgends angezeigt wird
  const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) { show({ fehler: 'WebGL2 mit EXT_color_buffer_float fehlt' }); return; }

  const begun = performance.now();
  const run = new Disk.Experiment(gl, params, {
    onStop: () => {
      const stats = run.measure(false), seconds = (performance.now() - begun) / 1000, m = run.sim.particleMass;
      show({
        schritte: run.driver.steps, zeit: run.sim.time, sekunden: +seconds.toFixed(2), schritteJeSekunde: Math.round(run.driver.steps / seconds),
        teilchenBeimStart: run.sim.count0, wolkeDrehimpulsAnteil: run.cloudSpin,
        stats, achse: run.diagnostics.axis,
        schwersteKoerper: run.diagnostics.top.map(b => ({ index: b.index, erdmassen: b.w * m / Disk.constants.EARTH, halbachse: b.a, geschwindigkeit: b.speed })),
        pruefsumme: run.checksum(),
      });
    },
  }, { smooth: false });   // keine Anzeige, also keine Rücksicht auf flüssiges Zeichnen
  run.reset(seed);
  run.driver.stopAt = steps;
  run.start();
}

try { run(); } catch (err) { document.getElementById('out').textContent = JSON.stringify({ fehler: String(err && err.message || err) }); document.title = 'Fehler'; }
})(globalThis.Disk = globalThis.Disk || {});

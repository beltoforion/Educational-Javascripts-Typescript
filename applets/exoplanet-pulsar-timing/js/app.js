// Setzt das Applet zusammen: die beiden Pulsare, ihre Szenen, das Diagramm der Pulse und die Bedienung.
//
//   PulsarTiming.mount(element, { lang: 'de' | 'en', assetPath: '…/assets/sprites/' })
//
// hängt das Applet in das Element ein und gibt { setPaused, seek, destroy } zurück.
(function (PT) {
'use strict';

PT.mount = function (root, options) {
  const opts = Object.assign({ lang: 'de' }, options);
  const cfg = PT.config, view = cfg.view, kit = ExoKit, colors = kit.colors;
  const texts = PT.texts(opts.lang);
  const shell = new kit.Shell(root, { width: view.width, height: view.height, texts });

  const sprites = new kit.Sprites(['pulsar', 'planet', 'earth', 'center_of_mass'], opts.assetPath, () => shell.invalidate());
  const models = [new PT.PulsarModel(cfg.model, true), new PT.PulsarModel(cfg.model, false)];
  const scenes = [
    new PT.SceneView(view, view.panels[0], models[0], texts, sprites, { text: texts.withPlanet, color: colors.primary }),
    new PT.SceneView(view, view.panels[1], models[1], texts, sprites, { text: texts.pulsarOnly, color: colors.secondary }),
  ];
  const chart = new kit.Chart(view.chart, { xTitle: texts.time, yTitle: texts.signal, min: 0, max: 1.12 });

  let time = 0;                // Sekunden seit dem Start

  shell.onResize = () => {
    for (const scene of scenes) scene.font = shell.font;
    chart.font = shell.font;
  };

  function update(dt) {
    if (shell.paused) return false;
    time += dt;
    return true;
  }

  // Das Signal eines Pulsars im laufenden Zeitfenster des Diagramms, bis jetzt. Ist das Fenster voll,
  // beginnt die Aufzeichnung von vorn.
  function pulses(model) {
    const span = view.chartSeconds, start = Math.floor(time / span) * span;
    const n = view.chartSamples, points = [];
    for (let i = 0; i <= n; i++) {
      const t = start + i / n * span;
      if (t > time) break;
      points.push([i / n, model.signal(t)]);
    }
    points.push([(time - start) / span, model.signal(time)]);
    return points;
  }

  function draw(ctx) {
    for (const scene of scenes) scene.draw(ctx, time);
    kit.draw.divider(ctx, view.panels[1].x, view.captionY - 14, view.height);
    chart.axes(ctx);
    // Der ruhende Pulsar liegt dünner obenauf: Wo beide Pulse zusammenfallen, bleiben beide sichtbar.
    chart.line(ctx, pulses(models[0]), colors.primary, 2.6);
    chart.line(ctx, pulses(models[1]), colors.secondary, 1.3);
  }

  shell.start(update, draw);

  return {
    setPaused(on) { shell.setPaused(on); },
    // p = Anteil eines Umlaufs um den Schwerpunkt
    seek(p) { time = p * cfg.model.orbitSeconds; shell.invalidate(); },
    destroy() { shell.destroy(); },
  };
};
})(globalThis.PulsarTiming = globalThis.PulsarTiming || {});

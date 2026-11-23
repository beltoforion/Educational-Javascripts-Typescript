// Setzt das Applet zusammen: die beiden Szenen mit ihren Lichtkurven, das Diagramm und die Bedienung.
// Zeichenfläche, Bedienleiste und Bildschleife stellt der gemeinsame Baukasten (ExoKit.Shell).
//
//   Microlensing.mount(element, { lang: 'de' | 'en', assetPath: '…/assets/sprites/' })
//
// hängt das Applet in das Element ein und gibt { setPaused, seek, destroy } zurück.
(function (ML) {
'use strict';

// Die beiden Linsensysteme: Stern mit Planet und Stern allein
function createLenses(model) {
  const star = { offset: 0, mass: 1 };
  const planet = { offset: model.planetOffset, mass: model.planetMass };
  return { withPlanet: new ML.LensSystem([star, planet]), starOnly: new ML.LensSystem([star]) };
}

ML.mount = function (root, options) {
  const opts = Object.assign({ lang: 'de' }, options);
  const cfg = ML.config, view = cfg.view, colors = ExoKit.colors;
  const texts = ML.texts(opts.lang);
  const shell = new ExoKit.Shell(root, { width: view.width, height: view.height, texts });
  shell.canvas.classList.add('xk-draggable');

  const lenses = createLenses(cfg.model);
  const deps = {
    model: cfg.model,
    sprites: new ExoKit.Sprites(['sternwarte', 'sun', 'planet'], opts.assetPath, () => shell.invalidate()),
    texts,
  };
  const stages = [
    new ML.Stage(view, view.panels[0], lenses.withPlanet, { text: texts.withPlanet, color: colors.primary }, deps),
    new ML.Stage(view, view.panels[1], lenses.starOnly, { text: texts.starOnly, color: colors.secondary }, deps),
  ];
  // Die Kurve ohne Planet liegt dünner über der mit Planet: Wo beide gleich verlaufen, bleiben beide sichtbar.
  const series = [
    { curve: stages[0].curve, color: colors.primary, width: 3.2, mark: stages[0].planetMark },
    { curve: stages[1].curve, color: colors.secondary, width: 1.4, mark: null },
  ];
  // Höchste Verstärkung, wenn der Stern genau vor der Quelle steht, mit etwas Luft nach oben
  const peak = Math.sqrt(1 + 4 / (cfg.model.sourceRadius * cfg.model.sourceRadius));
  const chart = new ML.ChartView(view.chart, texts, peak * 1.2);
  const playback = new ML.Playback(cfg.timing);

  let flow = 0;           // Verschiebung der wandernden Richtungspfeile
  let resumeAfterDrag = false;

  shell.onResize = () => {
    const rasterScale = Math.min(view.maxRasterScale, Math.ceil(shell.scale * 4) / 4);
    for (const stage of stages) stage.resize(rasterScale, shell.font);
    chart.font = shell.font;
  };

  // Rechnet nebenher fehlende Stützstellen der Lichtkurven aus, je Bild höchstens einige Millisekunden lang.
  // Zuerst die, die das Diagramm gerade zeigen will, dann den Rest. Meldet, ob etwas dazugekommen ist, das
  // schon sichtbar ist.
  function precompute(budget) {
    const until = performance.now() + budget;
    let visible = false;
    for (const pass of ['shown', 'rest']) {
      for (const s of series) {
        const shown = s.curve.lastIndex(playback.progress);
        const from = pass === 'shown' ? 0 : shown + 1;
        const to = pass === 'shown' ? shown : s.curve.count - 1;
        for (let i = from; i <= to; i++) {
          if (s.curve.has(i)) continue;
          if (performance.now() > until) return visible;
          s.curve.value(i);
          if (pass === 'shown') visible = true;
        }
      }
    }
    return visible;
  }

  function update(dt) {
    playback.paused = shell.paused;
    let changed = false;
    if (!shell.paused) {
      flow += dt * view.flowSpeed;
      playback.advance(dt);
      changed = true;
    }
    return precompute(6) || changed;
  }

  function draw(ctx) {
    for (const stage of stages) stage.draw(ctx, playback.progress, flow);
    ExoKit.draw.divider(ctx, view.panels[1].x, view.captionY - 14, view.height);
    chart.draw(ctx, series, playback.progress);
  }

  new ExoKit.ScrubInput(shell.canvas, view.width, {
    start() {
      resumeAfterDrag = !shell.paused;
      shell.setPaused(true);
    },
    // Der Zeiger führt den Linsenstern der Szene, über der er steht; die andere läuft gleich mit.
    move(x) {
      const stage = stages.find(s => s.layout.contains(x)) || stages[0];
      playback.seek(stage.curve.progressOf(stage.layout.lensAngle(x)));
      shell.invalidate();
    },
    end() {
      shell.setPaused(!resumeAfterDrag);
    },
  });

  shell.start(update, draw);

  return {
    setPaused(on) { shell.setPaused(on); },
    seek(progress) { playback.seek(progress); shell.invalidate(); },
    destroy() { shell.destroy(); },
  };
};
})(globalThis.Microlensing = globalThis.Microlensing || {});

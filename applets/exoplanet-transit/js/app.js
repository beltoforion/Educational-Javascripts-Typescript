// Setzt das Applet zusammen: Modell, Szene, Lichtkurve und Bedienung.
//
//   Transit.mount(element, { lang: 'de' | 'en', assetPath: '…/assets/sprites/' })
//
// hängt das Applet in das Element ein und gibt { setPaused, seek, setZoom, destroy } zurück.
(function (TR) {
'use strict';

TR.mount = function (root, options) {
  const opts = Object.assign({ lang: 'de' }, options);
  const cfg = TR.config, view = cfg.view, kit = ExoKit;
  const texts = TR.texts(opts.lang);
  const shell = new kit.Shell(root, { width: view.width, height: view.height, texts });
  shell.canvas.classList.add('xk-draggable');

  const sprites = new kit.Sprites(['sternwarte', 'sun', 'jupiter'], opts.assetPath, () => shell.invalidate());
  const model = new TR.TransitModel(cfg.model);
  const scene = new TR.SceneView(view, cfg.model, texts, sprites);
  const titles = { xTitle: texts.time, yTitle: texts.brightness };
  // Zwei Auftragungen derselben Kurve: ganz, und stark vergrößert um die Helligkeit des Sterns herum. Die
  // Vergrößerung spreizt den Bereich der feinen Effekte über den größten Teil der Höhe; darunter ist die
  // Achse unterbrochen und gestaucht, damit auch der Transit bis zu seinem Boden im Bild bleibt.
  const fine = model.fineRange(), span = fine.max - fine.min;
  const charts = {
    full: new kit.Chart(view.chart, Object.assign({}, titles, view.fullRange)),
    zoom: new kit.Chart(view.chart, Object.assign({}, titles, {
      min: view.fullRange.min, max: fine.max + 0.32 * span, breakAt: fine.min - 0.06 * span, breakShare: view.zoomBreakShare,
    })),
  };
  // Die Anteile, die die Vergrößerung einzeln zeigt
  const parts = [
    { name: texts.reflection, color: cfg.colors.reflection, value: p => model.reflection(p) },
    { name: texts.ellipsoidal, color: cfg.colors.ellipsoidal, value: p => model.ellipsoidal(p) },
    { name: texts.beaming, color: cfg.colors.beaming, value: p => model.beaming(p) },
  ];

  let progress = 0;            // Fortschritt im Umlauf, 0…1
  let zoomed = false;
  let resumeAfterDrag = false;

  shell.onResize = () => { scene.font = charts.full.font = charts.zoom.font = shell.font; };
  const zoomButton = shell.addToggle({ off: texts.zoomIn, on: texts.zoomOut }, on => { zoomed = on; });

  function update(dt) {
    if (shell.paused) return false;
    progress = (progress + dt / cfg.timing.periodSeconds) % 1;
    return true;
  }

  // Kurve des laufenden Umlaufs bis zum jetzigen Zeitpunkt; mit jedem Umlauf beginnt sie neu.
  // value(index) liefert den Wert am Messpunkt index.
  function curve(value) {
    const n = cfg.model.samples, points = [];
    for (let i = 0; i <= Math.floor(progress * n); i++) points.push([i / n, value(i)]);
    return points;
  }

  // Beschriftung einer Stelle der Kurve, sobald der Umlauf dort vorbei ist
  function mark(ctx, chart, at, value, text) {
    const since = progress - at - 0.05;
    if (since > 0) chart.mark(ctx, at, value, text, Math.min(1, since / 0.03));
  }

  function drawChart(ctx) {
    const chart = zoomed ? charts.zoom : charts.full, n = cfg.model.samples;
    chart.axes(ctx);
    chart.breakMark(ctx);
    chart.clip(ctx);
    if (zoomed) {
      // Jeder Anteil für sich, aufgetragen um die Helligkeit des Sterns allein
      chart.level(ctx, 1);
      for (const part of parts) chart.line(ctx, curve(i => 1 + part.value(i / n)), part.color, 1.5);
    }
    chart.line(ctx, curve(i => model.measured(i)), kit.colors.primary, 2.2);
    ctx.restore();

    if (zoomed) {
      parts.forEach((part, i) => {
        kit.draw.caption(ctx, shell.font, part.name, part.color, view.width * (i + 0.5) / parts.length, view.legendY);
      });
      mark(ctx, chart, 0.25, 1.0012, texts.transit);
      mark(ctx, chart, 0.75, fine.max, texts.secondary);
      chart.scaleBar(ctx, view.scaleBarX, 1, 1 + view.zoomScaleBar, texts.scaleZoom);
    } else {
      mark(ctx, chart, 0.25, 1.004, texts.transit);
      mark(ctx, chart, 0.75, model.brightness(0.72) + 0.001, texts.secondary);
      chart.scaleBar(ctx, view.scaleBarX, 1 - view.fullScaleBar, 1, texts.scaleFull);
    }
  }

  function draw(ctx) {
    scene.draw(ctx, model.planet(progress), model.phaseAngle(progress));
    drawChart(ctx);
  }

  new kit.ScrubInput(shell.canvas, view.width, {
    start() {
      resumeAfterDrag = !shell.paused;
      shell.setPaused(true);
    },
    // Der Zeiger führt den Planeten: unterhalb der Sternmitte über die vordere Hälfte seiner Bahn, oberhalb
    // über die hintere, also hinter dem Stern vorbei.
    move(x, y) {
      progress = model.progressAt(x - view.starX, y < view.starY);
      shell.invalidate();
    },
    end() {
      shell.setPaused(!resumeAfterDrag);
    },
  });

  shell.start(update, draw);

  return {
    setPaused(on) { shell.setPaused(on); },
    seek(p) { progress = ((p % 1) + 1) % 1; shell.invalidate(); },
    setZoom(on) { if (on !== zoomed) zoomButton.click(); },
    destroy() { shell.destroy(); },
  };
};
})(globalThis.Transit = globalThis.Transit || {});

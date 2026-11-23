// Setzt das Applet zusammen: Modell, Szene und Bedienung.
//
//   RadialVelocity.mount(element, { lang: 'de' | 'en', assetPath: '…/assets/sprites/' })
//
// hängt das Applet in das Element ein und gibt { setPaused, seek, destroy } zurück.
(function (RV) {
'use strict';

RV.mount = function (root, options) {
  const opts = Object.assign({ lang: 'de' }, options);
  const cfg = RV.config, view = cfg.view, kit = ExoKit;
  const texts = RV.texts(opts.lang);
  const shell = new kit.Shell(root, { width: view.width, height: view.height, texts });
  shell.canvas.classList.add('xk-draggable');

  const names = ['sternwarte', 'sun', 'planet', 'planet_shadow', 'center_of_mass', 'spectrum', 'spectrum_lines'];
  const sprites = new kit.Sprites(names, opts.assetPath, () => shell.invalidate());
  const model = new RV.OrbitModel(cfg.model);
  const scene = new RV.SceneView(view, cfg.model, texts, sprites);

  let progress = 0;            // Fortschritt im Umlauf, 0…1
  let resumeAfterDrag = false;

  shell.onResize = () => { scene.font = shell.font; };

  function update(dt) {
    if (shell.paused) return false;
    progress = (progress + dt / cfg.timing.periodSeconds) % 1;
    return true;
  }

  function draw(ctx) {
    scene.draw(ctx, {
      star: model.star(progress),
      planet: model.planet(progress),
      angle: model.angle(progress),
      velocity: model.radialVelocity(progress),
    });
  }

  new kit.ScrubInput(shell.canvas, view.width, {
    start() {
      resumeAfterDrag = !shell.paused;
      shell.setPaused(true);
    },
    // Der Planet folgt dem Zeiger um den Schwerpunkt.
    move(x, y) {
      progress = model.progressToward(x - view.centerX, y - view.centerY);
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
    destroy() { shell.destroy(); },
  };
};
})(globalThis.RadialVelocity = globalThis.RadialVelocity || {});

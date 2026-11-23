// Setzt das Applet zusammen: Modell, Szene und Bedienung.
//
//   Doppler.mount(element, { lang: 'de' | 'en', assetPath: '…/assets/sprites/' })
//
// hängt das Applet in das Element ein und gibt { setPaused, seek, destroy } zurück.
(function (DP) {
'use strict';

DP.mount = function (root, options) {
  const opts = Object.assign({ lang: 'de' }, options);
  const cfg = DP.config, view = cfg.view, kit = ExoKit;
  const texts = DP.texts(opts.lang);
  const shell = new kit.Shell(root, { width: view.width, height: view.height, texts });

  const sprites = new kit.Sprites(['sun'], opts.assetPath, () => shell.invalidate());
  const model = new DP.WaveModel(cfg.model);
  const scene = new DP.SceneView(view, cfg.model, texts, sprites);

  // Beginnt mit voll entwickeltem Wellenbild
  const lead = cfg.model.fronts * cfg.model.interval;
  let time = lead;

  shell.onResize = () => { scene.font = shell.font; };

  function update(dt) {
    if (shell.paused) return false;
    time += dt;
    return true;
  }

  shell.start(update, ctx => scene.draw(ctx, model.fronts(time), time));

  return {
    setPaused(on) { shell.setPaused(on); },
    // p in Vielfachen der Zeit, nach der eine Wellenfront verblasst ist
    seek(p) { time = lead * (1 + p); shell.invalidate(); },
    destroy() { shell.destroy(); },
  };
};
})(globalThis.Doppler = globalThis.Doppler || {});

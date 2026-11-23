// Der Rahmen jedes Applets: Zeichenfläche, die mit der Seitenbreite wächst, darunter die Bedienleiste mit dem
// Knopf zum Anhalten und einem Hinweis, dazu die Bildschleife.
//
//   const shell = new ExoKit.Shell(element, { width, height, texts: { pause, resume, hint, aria } });
//   shell.start(dt => …,        // Zustand weiterrechnen; meldet, ob neu gezeichnet werden muss
//               ctx => …);      // zeichnen, in logischen Pixeln; der Grund ist schon schwarz
(function (Kit) {
'use strict';

class Shell {
  constructor(root, options) {
    this.width = options.width;
    this.height = options.height;
    this.texts = options.texts;
    this.paused = false;
    this.scale = 0;                        // Bildpunkte je logischem Pixel
    this.screenScale = 1;                  // Bildschirmpixel (CSS) je logischem Pixel
    this.font = Kit.labelFont(1);
    this.onResize = null;                  // wird nach jeder Größenänderung aufgerufen
    this.onPause = null;                   // wird nach jedem Anhalten oder Fortsetzen aufgerufen
    this._dirty = true;

    root.classList.add('xk-root');
    root.innerHTML = '';
    this.root = root;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'xk-canvas';
    this.canvas.style.aspectRatio = this.width + ' / ' + this.height;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', this.texts.aria);
    this.ctx = this.canvas.getContext('2d');

    const controls = document.createElement('div');
    controls.className = 'xk-controls';
    this.pauseButton = document.createElement('button');
    this.pauseButton.type = 'button';
    this.pauseButton.addEventListener('click', () => this.setPaused(!this.paused));
    controls.append(this.pauseButton);
    this.controls = controls;
    if (this.texts.hint) {
      const hint = document.createElement('span');
      hint.className = 'xk-hint';
      hint.textContent = this.texts.hint;
      controls.append(hint);
    }
    root.append(this.canvas, controls);
    this._syncButton();

    this._resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.invalidate()) : null;
    if (this._resize) this._resize.observe(this.canvas);
  }

  start(update, draw) {
    this.loop = new Kit.FrameLoop(this.canvas, dt => {
      this._fit();
      if (update(dt)) this._dirty = true;
      if (!this._dirty) return;
      this._dirty = false;
      const ctx = this.ctx;
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingQuality = 'high';      // Bilder werden meist stark verkleinert gezeichnet
      ctx.fillStyle = Kit.colors.background;
      ctx.fillRect(0, 0, this.width, this.height);
      draw(ctx);
    });
  }

  // Fügt der Bedienleiste einen Umschaltknopf hinzu. labels = { off, on }: Beschriftung, solange er aus- bzw.
  // eingeschaltet ist (sie nennt jeweils, was ein Druck bewirkt). onChange(on) wird bei jedem Umschalten
  // aufgerufen.
  addToggle(labels, onChange) {
    const button = document.createElement('button');
    button.type = 'button';
    let on = false;
    const sync = () => {
      button.textContent = on ? labels.on : labels.off;
      button.setAttribute('aria-pressed', String(on));
    };
    button.addEventListener('click', () => {
      on = !on;
      sync();
      onChange(on);
      this.invalidate();
    });
    sync();
    this.pauseButton.after(button);
    return button;
  }

  // beim nächsten Bild neu zeichnen
  invalidate() {
    this._dirty = true;
  }

  setPaused(on) {
    this.paused = on;
    this._syncButton();
    if (this.onPause) this.onPause(on);
  }

  destroy() {
    if (this.loop) this.loop.stop();
    if (this._resize) this._resize.disconnect();
    this.root.innerHTML = '';
  }

  _syncButton() {
    this.pauseButton.textContent = this.paused ? this.texts.resume : this.texts.pause;
    this.pauseButton.setAttribute('aria-pressed', String(this.paused));
  }

  // Auflösung der Zeichenfläche an ihre Größe auf dem Schirm anpassen
  _fit() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    if (width === this.canvas.width && this.scale) return;
    this.canvas.width = width;
    this.canvas.height = Math.round(width * this.height / this.width);
    this.scale = width / this.width;
    this.screenScale = this.scale / dpr;
    this.font = Kit.labelFont(this.screenScale);
    this._dirty = true;
    if (this.onResize) this.onResize(this);
  }
}

Kit.Shell = Shell;
})(globalThis.ExoKit = globalThis.ExoKit || {});

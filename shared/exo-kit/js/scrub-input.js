// Ziehen mit Maus oder Finger: meldet die Stellung des Zeigers in logischen Pixeln.
(function (Kit) {
'use strict';

class ScrubInput {
  // handlers: { start(), move(x, y), end() }
  constructor(canvas, logicalWidth, handlers) {
    this.canvas = canvas;
    this.logicalWidth = logicalWidth;
    this.active = false;

    canvas.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      this.active = true;
      canvas.setPointerCapture(e.pointerId);
      handlers.start();
      handlers.move(...this._at(e));
    });
    canvas.addEventListener('pointermove', e => {
      if (this.active) handlers.move(...this._at(e));
    });
    const end = () => {
      if (!this.active) return;
      this.active = false;
      handlers.end();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  _at(e) {
    const box = this.canvas.getBoundingClientRect(), k = this.logicalWidth / box.width;
    return [(e.clientX - box.left) * k, (e.clientY - box.top) * k];
  }
}

Kit.ScrubInput = ScrubInput;
})(globalThis.ExoKit = globalThis.ExoKit || {});

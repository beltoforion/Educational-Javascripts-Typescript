// Ruft frame(dt) zu jedem Bildschirmbild auf, aber nur solange das Applet zu sehen ist.
(function (Kit) {
'use strict';

class FrameLoop {
  constructor(element, frame) {
    this.frame = frame;
    this.inView = true;
    this.request = 0;
    this.last = 0;
    this._tick = this._tick.bind(this);
    this._sync = this._sync.bind(this);

    if (typeof IntersectionObserver === 'function') {
      this.observer = new IntersectionObserver(entries => {
        this.inView = entries[entries.length - 1].isIntersecting;
        this._sync();
      });
      this.observer.observe(element);
    }
    document.addEventListener('visibilitychange', this._sync);
    this._sync();
  }

  _sync() {
    const wanted = this.inView && !document.hidden;
    if (wanted && !this.request) {
      this.last = 0;
      this.request = requestAnimationFrame(this._tick);
    } else if (!wanted && this.request) {
      cancelAnimationFrame(this.request);
      this.request = 0;
    }
  }

  _tick(now) {
    this.request = requestAnimationFrame(this._tick);
    // Nach einer Unterbrechung nicht die ganze verstrichene Zeit nachholen
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    this.frame(dt);
  }

  stop() {
    if (this.observer) this.observer.disconnect();
    document.removeEventListener('visibilitychange', this._sync);
    if (this.request) cancelAnimationFrame(this.request);
    this.request = 0;
  }
}

Kit.FrameLoop = FrameLoop;
})(globalThis.ExoKit = globalThis.ExoKit || {});

// Der Ablauf eines Durchgangs: Fortschritt von 0 bis 1, danach eine Pause und wieder von vorn.
(function (ML) {
'use strict';

class Playback {
  constructor(timing) {
    this.timing = timing;
    this.progress = 0;
    this.paused = false;
    this.held = 0;
  }

  // dt in Sekunden; meldet, ob sich der Fortschritt geändert hat
  advance(dt) {
    if (this.paused) return false;
    if (this.progress >= 1) {
      this.held += dt;
      if (this.held < this.timing.holdSeconds) return false;
      this.seek(0);
      return true;
    }
    this.progress = Math.min(1, this.progress + dt / this.timing.passSeconds);
    return true;
  }

  seek(progress) {
    this.progress = Math.min(1, Math.max(0, progress));
    this.held = 0;
  }
}

ML.Playback = Playback;
})(globalThis.Microlensing = globalThis.Microlensing || {});

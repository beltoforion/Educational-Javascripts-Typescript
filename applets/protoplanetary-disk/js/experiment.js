// Ein Lauf der Simulation ohne jede Darstellung: Startwolke, Simulation, Taktgeber, Messung und Umpacken.
// Diese Einheit braucht nur einen WebGL2-Kontext. Sie kennt weder die Seite noch Kamera, Bild oder Regler und
// läuft deshalb auch ohne Anzeige, siehe headless.html. Wer mitlesen will, hängt sich über hooks ein.
(function (Disk) {
'use strict';

class Experiment {
  // gl: WebGL2-Kontext mit EXT_color_buffer_float. params: die einstellbaren Parameter. options.smooth: false
  // rechnet ohne Rücksicht auf eine Anzeige (siehe sim-driver.js). hooks, alle wahlweise:
  //   onReset()               eine neue Startwolke ist erzeugt, die Simulation aber noch nicht geladen
  //   onSnapshot(snap)        frische Momentaufnahme, ausgewertet, vor dem Umpacken
  //   onCompact(moved)        die Körper wurden umgepackt, moved: alter Platz → neuer Platz
  //   onMeasured(stats, rec)  Messung abgeschlossen; rec sagt, ob sie zum Verlauf zählt
  //   onStop()                die mit driver.stopAt gesetzte Schrittzahl ist erreicht
  constructor(gl, params, hooks, options) {
    this.params = params;
    this.hooks = hooks || {};
    this.sim = new Disk.Simulation(gl, params);
    this.diagnostics = new Disk.Diagnostics();
    this.paused = false;
    this.stats = null;
    this.cloudSpin = 0;   // Anteil des Drehimpulses, den die Startwolke auf Kreisbahnen hätte
    this.driver = new Disk.SimDriver(gl, this.sim, {
      smooth: !options || options.smooth !== false,
      isPaused: () => this.paused,
      onMeasure: () => this.measure(true),
      onStop: () => { this.paused = true; this.call('onStop'); },
    });
  }

  call(name, ...args) { if (this.hooks[name]) this.hooks[name](...args); }

  // Neue Startwolke. Mit seed lässt sich eine Wolke wiederholen, sonst ist sie zufällig.
  reset(seed) {
    const P = this.params;
    const cloud = Disk.createCloud({ size: P.ts, eddy: P.eddy, turb: P.turb, cloudMass: P.md, seed });
    this.cloudSpin = cloud.spin;
    this.stats = null;
    this.diagnostics.reset();
    this.call('onReset');
    this.sim.reset(cloud);
    this.measure(true);
    this.driver.reset();
  }

  // Messung: Momentaufnahme auswerten, dem Stern die verschluckte Masse anrechnen, Körper umpacken
  measure(record) {
    const snap = this.sim.readback();
    this.stats = this.diagnostics.measure(snap);
    this.call('onSnapshot', snap);
    const moved = this.sim.compact(this.stats.bodies);
    if (moved) { this.diagnostics.remap(moved); this.call('onCompact', moved); }
    this.stats.slots = this.sim.size;
    this.call('onMeasured', this.stats, record);
    return this.stats;
  }

  // Lässt den Taktgeber loslaufen
  start() { this.driver.start(); }

  // Prüfsumme über alle Orte und Geschwindigkeiten der letzten Momentaufnahme, zum Vergleich zweier Läufe
  checksum() {
    const pos = this.sim.pos, vel = this.sim.vel;
    let c = 0;
    for (let i = 0; i < pos.length; i++) c = (c * 31 + Math.round(pos[i] * 1e6) + Math.round(vel[i] * 1e6)) | 0;
    return c;
  }
}

Disk.Experiment = Experiment;
})(globalThis.Disk = globalThis.Disk || {});

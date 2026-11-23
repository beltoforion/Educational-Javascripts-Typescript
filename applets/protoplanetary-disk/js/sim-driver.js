// Taktgeber der Simulation. Er lässt sie so schnell rechnen, wie die Grafikkarte kann, unabhängig davon, wie oft
// gezeichnet wird, und löst nach einer festen Zahl von Schritten eine Messung aus. Eine Uhr gibt kein Tempo vor.
// Der Verlauf einer Wolke hängt deshalb weder von der Rechengeschwindigkeit noch von der Bildrate ab.
//
// Zwei Betriebsarten:
//   ohne Rücksicht (smooth: false)  rechnet immer bis zur nächsten Messung durch. Am schnellsten, aber die Seite
//                                   reagiert so lange nicht. Für Läufe ohne Anzeige.
//   mit Anzeige (smooth: true)      gibt die Schritte in dem Tempo aus, das die Grafikkarte zuletzt geschafft hat,
//                                   damit sich keine Arbeit staut und die Seite bedienbar bleibt. Das Tempo liest er
//                                   an den Messungen ab: Jede muss warten, bis alle Schritte gerechnet sind, und
//                                   die Simulation meldet, wie lange das gedauert hat (lastWait).
(function (Disk) {
'use strict';

const MEASURE_STEPS = 20;   // nach so vielen Zeitschritten wird gemessen
const BACKLOG_S = 0.25;     // höchstens so viel Rückstand wird nachgeholt

class SimDriver {
  // gl: WebGL2-Kontext. sim: die Simulation. options:
  //   smooth       siehe oben
  //   isPaused()   true, solange die Simulation angehalten ist
  //   onMeasure()  wird nach je MEASURE_STEPS Schritten gerufen und liest den Zustand zurück
  //   onStop()     wird gerufen, wenn die mit stopAt gesetzte Schrittzahl erreicht ist
  constructor(gl, sim, options) {
    this.gl = gl;
    this.sim = sim;
    this.options = options;
    this.rate = 0;           // gemessene Rechengeschwindigkeit in Schritten je Sekunde, nur zur Anzeige
    this.rateSteps = 0; this.rateSince = performance.now();
    this.last = performance.now();
    this.reset();
  }

  // Vor einer neuen Startwolke
  reset() {
    this.due = 0;               // Schritte, die im geschätzten Tempo der Grafikkarte fällig sind
    this.sinceMeasure = 0;      // Schritte seit der letzten Messung
    this.steps = 0;             // Schritte seit dem Start der Wolke
    this.stopAt = Infinity;     // bei dieser Schrittzahl anhalten
    this.capacity = Infinity;   // Schritte je Sekunde, die die Grafikkarte zuletzt geschafft hat. Unendlich: noch unbekannt
    this.fresh = true;          // die nächste Messung sagt noch nichts über die Leistung der Grafikkarte
    this.measuredAt = performance.now();
  }

  start() { this.last = performance.now(); this.schedule(); }

  // Eigener Zeitgeber statt requestAnimationFrame: Der Takt hängt nicht am Bildschirm
  schedule() { setTimeout(() => this.tick(), 0); }

  tick() {
    const now = performance.now();
    if (now - this.rateSince >= 500) {   // Rechengeschwindigkeit für die Anzeige fortschreiben
      this.rate = this.rateSteps * 1000 / (now - this.rateSince);
      this.rateSteps = 0; this.rateSince = now;
    }
    const elapsed = Math.min(now - this.last, 1000);
    this.last = now;
    if (this.options.isPaused()) { this.due = 0; this.fresh = true; this.schedule(); return; }

    let n = MEASURE_STEPS - this.sinceMeasure;   // höchstens bis zur nächsten Messung
    if (this.options.smooth && Number.isFinite(this.capacity)) {
      this.due = Math.min(this.due + elapsed * this.capacity / 1000, Math.max(1, this.capacity * BACKLOG_S));
      n = Math.min(n, Math.floor(this.due));
    }
    n = Math.min(n, this.stopAt - this.steps);
    if (n > 0) {
      for (let i = 0; i < n; i++) this.sim.step();
      this.gl.flush();
      this.due = Math.max(0, this.due - n); this.sinceMeasure += n; this.steps += n; this.rateSteps += n;
      if (this.sinceMeasure >= MEASURE_STEPS) this.measure();
      if (this.steps >= this.stopAt) { this.stopAt = Infinity; this.options.onStop(); }
    }
    this.schedule();
  }

  // Messung auslösen und daran ablesen, was die Grafikkarte leistet
  measure() {
    this.sinceMeasure = 0;
    this.options.onMeasure();   // wartet, bis die Grafikkarte alle Schritte gerechnet hat
    const after = performance.now(), interval = after - this.measuredAt, waited = this.sim.lastWait;
    if (!this.fresh && interval > 0) {
      // Langer Rückstand: Die Grafikkarte war durchgehend beschäftigt, die Zeit seit der letzten Messung zeigt also,
      // was sie schafft. Kaum Rückstand: Sie hat Luft, es darf schneller gehen.
      if (waited > 4 && waited > 0.1 * interval) this.capacity = 0.95 * MEASURE_STEPS * 1000 / interval;
      else this.capacity = Math.min(this.capacity * 1.15, 1e9);
    }
    this.fresh = false;
    this.measuredAt = after;
  }
}

Disk.SimDriver = SimDriver;
})(globalThis.Disk = globalThis.Disk || {});

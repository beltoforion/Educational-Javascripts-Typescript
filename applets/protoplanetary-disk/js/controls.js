// Regler, Auswahlfelder, Knöpfe und Tastatur. Diese Datei kennt die Elemente der Seite. Sie verändert nur die
// Parameter und ruft Befehle auf; von Simulation, Kamera und Darstellung weiß sie nichts.
(function (Disk) {
'use strict';

const $ = id => document.getElementById(id);
const fmt = (x, digits) => Disk.fmt(x, digits);

// Schieberegler: Element-ID, Parameter, Anzeige des Werts. Ein neuer Regler ist ein neuer Eintrag.
//   scale    Parameter = Reglerwert · scale
//   restart  nach dem Loslassen neu starten (Parameter der Startwolke)
//   input    zusätzliche Wirkung beim Verstellen von Hand
const RANGES = [
  { id: 'diss', key: 'diss', show: v => v === 0 ? 'aus' : fmt(v, 0) },
  { id: 'md', key: 'md', scale: 0.01, show: v => v === 0 ? 'aus' : fmt(v, 0) + ' %' },
  { id: 'stick', key: 'stick', show: v => fmt(Math.sqrt(v), 2) + ' × Fluchtgeschw.' },
  { id: 'eddy', key: 'eddy', show: v => fmt(v * 100, 0) + ' %', restart: true },
  { id: 'turb', key: 'turb', show: v => fmt(v * 100, 0) + ' %', restart: true },
  // ein eigener Bezugsradius löst die Kamera von einem verfolgten Körper
  { id: 'co', key: 'co', show: v => v === 0 ? 'aus' : 'bei Radius ' + fmt(v, 2), input: c => c.commands.releaseFollow() },
];

// Ankreuzfelder: Element-ID, Parameter und was sich beim Umschalten sonst noch ändert
const CHECKS = [
  { id: 'merge', key: 'merge' },
  { id: 'trails', key: 'trails', change: c => c.commands.invalidateTrails() },
  { id: 'spin', key: 'spin' },
  { id: 'axis', key: 'axis', change: c => c.commands.invalidateTrails() },
];

// Auswahlfelder mit Zahlenwert: Element-ID, Parameter und was sich beim Umschalten sonst noch ändert
const SELECTS = [
  { id: 'mode', key: 'mode', change: c => { c.showColorTicks(); c.commands.invalidateTrails(); } },
  { id: 'drawEvery', key: 'drawEvery' },
];

// Farbmodi: Beschriftung der Farbskala je Modus, als [Lage in Prozent, Text]. Die Farben selbst rechnet der Shader.
const COLOR_TICKS = [
  [[0, '0°'], [26.7, '20°'], [43.5, '45°'], [66, '90°'], [100, '180°']],                 // Bahnneigung
  [[0, '0 Kreis'], [25, '0,25'], [50, '0,5'], [75, '0,75'], [100, '1 offen']],          // Exzentrizität
  [[0, 'dicht'], [100, 'dünn']],                                                        // Dichte
];

// Tasten: Tastencode → Befehl
const KEYS = {
  Space: c => c.commands.togglePause(),
  KeyR: c => c.commands.restart(true),
  KeyO: c => c.commands.viewFromAbove(),
  KeyH: c => c.toggleUi(),
};

class Controls {
  // params: die einstellbaren Parameter. commands: { restart(resume), togglePause(), viewFromAbove(),
  // invalidateTrails(), releaseFollow(), saveDump() }
  constructor(params, commands) {
    this.params = params;
    this.commands = commands;
    this.ranges = {};
    for (const r of RANGES) this.bindRange(r);
    for (const c of CHECKS) this.bindCheck(c);
    this.bindCount();

    for (const s of SELECTS) this.bindSelect(s);
    this.showColorTicks();

    $('topView').addEventListener('click', () => commands.viewFromAbove());
    $('pause').addEventListener('click', () => commands.togglePause());
    $('restart').addEventListener('click', () => commands.restart(true));
    $('dump').addEventListener('click', () => commands.saveDump());
    $('toggleUi').addEventListener('click', () => this.toggleUi());
    if (innerWidth < 760) this.toggleUi(true);   // auf schmalen Bildschirmen zuerst die Simulation zeigen

    addEventListener('keydown', e => {
      if (e.code === 'Space' && e.target.closest && e.target.closest('input, select, button')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const action = KEYS[e.code];
      if (!action) return;
      if (e.code === 'Space') e.preventDefault();
      action(this);
    });
  }

  bindRange(r) {
    const P = this.params, el = $(r.id), out = $(r.id + 'Out'), scale = r.scale || 1;
    const show = () => { out.textContent = r.show(+el.value); };
    this.ranges[r.id] = { el, show, scale, key: r.key };
    this.showRange(r.id);
    el.addEventListener('input', () => { P[r.key] = +el.value * scale; show(); if (r.input) r.input(this); });
    if (r.restart) el.addEventListener('change', () => this.commands.restart(false));
  }

  // Stellt einen Regler auf den Wert seines Parameters, wenn der sich ohne Zutun des Reglers geändert hat
  showRange(id) {
    const r = this.ranges[id];
    r.el.value = this.params[r.key] / r.scale; r.show();
  }

  bindCheck(c) {
    const P = this.params, el = $(c.id);
    el.checked = P[c.key];
    el.addEventListener('change', () => { P[c.key] = el.checked; if (c.change) c.change(this); });
  }

  bindSelect(s) {
    const P = this.params, el = $(s.id);
    el.value = P[s.key];
    el.addEventListener('change', () => { P[s.key] = +el.value; if (s.change) s.change(this); });
  }

  // Auswahl der Teilchenzahl. Eine Zahl aus der Adresse, die nicht in der Liste steht, wird ergänzt.
  bindCount() {
    const P = this.params, select = $('count');
    if (![...select.options].some(o => +o.value === P.ts)) select.add(new Option((P.ts * P.ts).toLocaleString('de-DE'), P.ts));
    select.value = P.ts;
    select.addEventListener('change', () => { P.ts = +select.value; this.commands.restart(false); });
  }

  // Setzt den Bezugsradius, mit dem die Kamera mitdreht (0 = aus), etwa nach einem Klick auf die Scheibe
  setCoRadius(r) {
    this.params.co = Math.round(Math.max(0, Math.min(Disk.constants.CO_MAX, r)) * 100) / 100;
    this.showRange('co');
  }

  // Schaltet das langsame Kreisen der Kamera ab
  stopSpin() { this.params.spin = false; $('spin').checked = false; }

  showPaused(paused) { $('pause').textContent = paused ? 'Weiter' : 'Anhalten'; }

  showColorTicks() {
    $('ticks').innerHTML = COLOR_TICKS[this.params.mode].map(([x, label]) => `<span style="left:${x}%">${label}</span>`).join('');
  }

  // Blendet die Regler aus oder ein
  toggleUi(force) {
    const bare = document.body.classList.toggle('bare', typeof force === 'boolean' ? force : undefined);
    $('toggleUi').textContent = bare ? 'Regler einblenden' : 'Regler ausblenden';
    $('toggleUi').setAttribute('aria-pressed', bare);
  }
}

Disk.Controls = Controls;
})(globalThis.Disk = globalThis.Disk || {});

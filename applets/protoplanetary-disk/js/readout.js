// Anzeige der Messwerte und der fünf schwersten Körper mit ihren Folge-Knöpfen.
// Welche Kennzahl in welchem Feld steht, sagt eine Tabelle. Die Elemente der Seite werden übergeben.
(function (Disk) {
'use strict';

const fmt = (x, digits) => Disk.fmt(x, digits);
const whole = x => x.toLocaleString('de-DE');

// Feld in der Seite → Text aus den Angaben eines Messzeitpunkts (d.stats, d.time, d.dt, d.steps, d.starMass, d.fps, d.simRate)
const FIELDS = {
  inc: d => fmt(d.stats.inc, 1) + '°',
  ecc: d => fmt(d.stats.ecc, 2),
  hr: d => fmt(d.stats.hr, 2),
  bodies: d => whole(d.stats.bodies),
  time: d => fmt(d.time, 2),
  dt: d => fmt(d.dt, 4),
  steps: d => whole(d.steps),
  slots: d => `${d.stats.slots} × ${d.stats.slots} Plätze`,
  planets: d => whole(d.stats.planets),
  biggest: d => fmt(d.stats.biggest, d.stats.biggest < 10 ? 1 : 0) + ' Erdmassen',
  L: d => fmt(d.stats.L * 100, 1) + ' %',
  accreted: d => fmt(d.stats.accreted * 100, 1) + ' %',
  // Umläufe am Scheibenrand seit dem Start
  orbits: d => fmt(d.time / (2 * Math.PI * Math.sqrt(Math.max(d.stats.r90, 0.1) ** 3 / d.starMass)), 1),
  fps: d => fmt(d.fps, 0),
  rate: d => fmt(d.simRate, 0),
};

class Readout {
  // el: Elemente der Seite. Für jedes Feld aus FIELDS eines, dazu spinNote, bodiesEmpty, bodiesFull, bodyList, bodiesPanel.
  // history: Verlaufsgrafik. orbitChart: Grafik der schwersten Körper. onToggleBody(body): ein Folge-Knopf wurde gedrückt.
  constructor(el, history, orbitChart, onToggleBody) {
    this.el = el;
    this.history = history;
    this.orbitChart = orbitChart;
    this.top = [];
    this.buttons = [];
    for (let k = 0; k < 5; k++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'body'; b.hidden = true;
      b.innerHTML = '<span class="n"></span><span class="m"></span><span class="d"></span>';
      b.addEventListener('click', () => { if (this.top[k]) onToggleBody(this.top[k]); });
      el.bodyList.append(b); this.buttons.push(b);
    }
    el.bodiesPanel.addEventListener('toggle', () => orbitChart.redraw());
  }

  showCloudSpin(spin) {
    this.el.spinNote.textContent = `Diese Wolke hat zufällig ${fmt(spin * 100, 0)} % des Drehimpulses, den sie auf geordneten Kreisbahnen hätte.`;
  }

  // data: { stats, time, dt, steps, starMass, fps, simRate, top, followedSlot }
  update(data) {
    if (!data.stats) return;
    for (const key in FIELDS) this.el[key].textContent = FIELDS[key](data);
    this.history.draw();
    this.updateBodies(data.top, data.followedSlot);
  }

  // top: die schwersten Körper von innen nach außen. followedSlot: Platz des verfolgten Körpers oder -1.
  updateBodies(top, followedSlot) {
    const el = this.el;
    this.top = top;
    el.bodiesEmpty.hidden = top.length > 0; el.bodiesFull.hidden = top.length === 0;
    this.buttons.forEach((btn, k) => {
      const b = top[k]; btn.hidden = !b; if (!b) return;
      const on = followedSlot === b.slot;
      btn.children[0].textContent = b.index;
      btn.children[1].textContent = fmt(b.earth, b.earth < 10 ? 1 : 0) + ' Erdmassen';
      btn.children[2].textContent = b.bound ? 'Abstand ' + fmt(b.a, 2) : 'entweicht';
      btn.setAttribute('aria-pressed', on);
      btn.title = on ? 'Kamera wieder lösen' : 'Kamera läuft mit diesem Körper um';
    });
    if (el.bodiesPanel.open) this.orbitChart.draw(top, followedSlot);
  }
}

Disk.Readout = Readout;
})(globalThis.Disk = globalThis.Disk || {});

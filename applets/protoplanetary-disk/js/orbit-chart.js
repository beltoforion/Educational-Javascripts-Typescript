// Die fünf schwersten Körper: Umlaufgeschwindigkeit über dem Index (Reihenfolge von innen nach außen).
// Bei einer Titius-Bode-artigen Reihe wachsen die Abstände geometrisch. Auf der logarithmischen Achse liegen
// die Punkte dann auf einer Geraden. Die gestrichelte Linie ist die beste solche Gerade.
(function (Disk) {
'use strict';

const FONT = '11.5px "Avenir Next", "Segoe UI", "Noto Sans", "DejaVu Sans", system-ui, sans-serif';
const TICKS = [0.05, 0.07, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5, 7, 10, 15, 20];   // runde Geschwindigkeiten
const ROWS = 5;

class OrbitChart {
  // canvas: 2D-Zeichenfläche. tip: Element für den Hinweis unter dem Mauszeiger. note: Element für den Satz zur Reihe.
  // onPick(body): wird gerufen, wenn jemand einen Punkt anklickt.
  constructor(canvas, tip, note, onPick) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tip = tip;
    this.note = note;
    this.dots = [];   // gezeichnete Punkte mit Bildort, für Mauszeiger und Klick
    this.list = []; this.followedSlot = -1;
    canvas.addEventListener('mousemove', e => this.showTip(e));
    canvas.addEventListener('mouseleave', () => { tip.hidden = true; });
    canvas.addEventListener('click', e => { const d = this.dotAt(e); if (d) onPick(d.b); });
  }

  // list: Körper aus der Auswertung mit index, speed, w und slot. followedSlot: Platz des verfolgten Körpers oder -1.
  draw(list, followedSlot) {
    const orbits = this.canvas, octx = this.ctx, fmt = Disk.fmt;
    this.list = list; this.followedSlot = followedSlot;
    this.dots = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = orbits.clientWidth, H = orbits.clientHeight;
    if (!list.length || !W) return;   // nichts zu zeigen oder gerade eingeklappt
    if (orbits.width !== Math.round(W * dpr) || orbits.height !== Math.round(H * dpr)) { orbits.width = Math.round(W * dpr); orbits.height = Math.round(H * dpr); }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, W, H);
    const left = 34, right = 8, top = 20, bottom = 30;
    let lo = Math.min(...list.map(b => b.speed)), hi = Math.max(...list.map(b => b.speed));
    const mid = Math.sqrt(lo * hi);
    if (hi / lo < 2) { lo = mid / Math.SQRT2; hi = mid * Math.SQRT2; }   // nie stärker hineinzoomen als Faktor 2
    lo /= 1.18; hi *= 1.18;
    const X = n => left + (n - 0.5) / ROWS * (W - left - right);                              // Index auf der x-Achse
    const Y = v => H - bottom - Math.log(v / lo) / Math.log(hi / lo) * (H - top - bottom);    // Geschwindigkeit logarithmisch nach oben

    octx.font = FONT;
    octx.textBaseline = 'middle'; octx.lineWidth = 1; octx.setLineDash([]);
    let ticks = TICKS.filter(t => t >= lo && t <= hi);
    while (ticks.length > 4) ticks = ticks.filter((_, i) => i % 2 === 0);
    octx.textAlign = 'right';
    for (const t of ticks) {   // waagrechte Hilfslinien bei runden Geschwindigkeiten
      const y = Math.round(Y(t)) + 0.5;
      octx.strokeStyle = 'rgba(233,230,223,0.09)'; octx.beginPath(); octx.moveTo(left, y); octx.lineTo(W - right, y); octx.stroke();
      octx.fillStyle = '#a3a7b4'; octx.fillText(fmt(t, t < 0.1 ? 2 : t < 1 || t % 1 ? 1 : 0), left - 7, y);
    }
    octx.strokeStyle = 'rgba(233,230,223,0.22)';
    octx.beginPath(); octx.moveTo(left, H - bottom + 0.5); octx.lineTo(W - right, H - bottom + 0.5); octx.stroke();
    octx.textAlign = 'center';
    for (let n = 1; n <= ROWS; n++) {
      const x = Math.round(X(n)) + 0.5;
      octx.beginPath(); octx.moveTo(x, H - bottom); octx.lineTo(x, H - bottom + 4); octx.stroke();
      octx.fillStyle = n <= list.length ? '#a3a7b4' : '#565b6b'; octx.fillText(n, x, H - bottom + 12);
    }
    octx.fillStyle = '#6d7283';
    octx.textAlign = 'left'; octx.fillText('Umlaufgeschwindigkeit (log)', 0, 6);
    octx.textAlign = 'right'; octx.fillText('Index, von innen nach außen', W - right, H - 5);

    // Beste geometrische Reihe: ln(v) = c + s · Index
    let note = 'Für eine Reihe braucht es mindestens drei Körper.';
    if (list.length >= 3) {
      const k = list.length, mn = (k + 1) / 2, ml = list.reduce((sum, b) => sum + Math.log(b.speed), 0) / k;
      let sxy = 0, sxx = 0;
      for (const b of list) { sxy += (b.index - mn) * (Math.log(b.speed) - ml); sxx += (b.index - mn) ** 2; }
      const slope = sxy / sxx, at = n => Math.exp(ml + slope * (n - mn));
      octx.strokeStyle = 'rgba(233,230,223,0.4)'; octx.setLineDash([4, 4]);
      octx.beginPath(); octx.moveTo(X(0.6), Y(at(0.6))); octx.lineTo(X(k + 0.4), Y(at(k + 0.4))); octx.stroke();
      octx.setLineDash([]);
      note = `Gestrichelt: die beste geometrische Reihe. Je Körper Geschwindigkeit × ${fmt(Math.exp(slope), 2)}, Abstand × ${fmt(Math.exp(-2 * slope), 2)}.`;
    }
    this.note.textContent = note;

    const heaviest = Math.max(...list.map(b => b.w));
    for (const b of list) {
      const x = X(b.index), y = Y(b.speed), rad = 4 + 4 * Math.sqrt(b.w / heaviest), on = followedSlot === b.slot;
      octx.beginPath(); octx.arc(x, y, rad, 0, 2 * Math.PI);
      octx.fillStyle = on ? '#7fd4ff' : '#ffc76b'; octx.fill();
      octx.lineWidth = 2; octx.strokeStyle = '#04060c'; octx.stroke();   // Ring in Hintergrundfarbe trennt überlappende Punkte
      if (on) { octx.lineWidth = 1.5; octx.strokeStyle = '#7fd4ff'; octx.beginPath(); octx.arc(x, y, rad + 4, 0, 2 * Math.PI); octx.stroke(); }
      this.dots.push({ x, y, b });
    }
  }

  // Zeichnet mit den zuletzt übergebenen Daten neu, etwa nach dem Aufklappen
  redraw() { this.draw(this.list, this.followedSlot); }

  // Der Punkt unter dem Mauszeiger, großzügig getroffen
  dotAt(e) {
    const rect = this.canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
    let hit = null, best = 16 * 16;
    for (const d of this.dots) { const d2 = (d.x - x) ** 2 + (d.y - y) ** 2; if (d2 < best) { best = d2; hit = d; } }
    return hit;
  }

  showTip(e) {
    const d = this.dotAt(e), tip = this.tip, fmt = Disk.fmt;
    this.canvas.style.cursor = d ? 'pointer' : '';
    tip.hidden = !d; if (!d) return;
    const b = d.b;
    tip.textContent = `Körper ${b.index}: ${fmt(b.earth, 0)} Erdmassen · Geschwindigkeit ${fmt(b.speed, 2)} · ${b.bound ? 'Abstand ' + fmt(b.a, 2) + ' · Exzentrizität ' + fmt(Math.min(b.ecc, 1), 2) : 'entweicht'}`;
    tip.style.left = Math.max(0, Math.min(this.canvas.clientWidth - tip.offsetWidth, d.x - tip.offsetWidth / 2)) + 'px';
    tip.style.top = (d.y < 60 ? d.y + 14 : d.y - tip.offsetHeight - 12) + 'px';
  }
}

Disk.OrbitChart = OrbitChart;
})(globalThis.Disk = globalThis.Disk || {});

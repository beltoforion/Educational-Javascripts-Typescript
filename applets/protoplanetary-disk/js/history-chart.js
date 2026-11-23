// Verlaufsgrafik: Kennzahlen der Scheibe seit dem Start als Linien. Welche Kennzahlen, steht in einer Tabelle,
// eine weitere Linie ist also ein weiterer Eintrag.
(function (Disk) {
'use strict';

// key: Feld in den Kennzahlen. full: Wert, der dem oberen Rand entspricht. color: Linienfarbe.
const SERIES = [
  { key: 'inc', full: 90, color: '#ffc76b' },   // mittlere Bahnneigung in Grad
  { key: 'ecc', full: 1, color: '#ff7f9c' },    // mittlere Exzentrizität
  { key: 'hr', full: 1, color: '#7fd4ff' },     // Dicke zu Radius
];
const MAX_POINTS = 900;

class HistoryChart {
  // canvas: 2D-Zeichenfläche für die Grafik
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.clear();
  }

  clear() {
    this.t = [];
    this.values = {};
    for (const s of SERIES) this.values[s.key] = [];
  }

  // Hängt die Kennzahlen zur Simulationszeit time an. Wird die Reihe zu lang, bleibt jeder zweite Punkt.
  push(time, stats) {
    this.t.push(time);
    for (const s of SERIES) this.values[s.key].push(stats[s.key] / s.full);
    if (this.t.length > MAX_POINTS) {
      const every2nd = (_, i) => i % 2 === 0;
      this.t = this.t.filter(every2nd);
      for (const s of SERIES) this.values[s.key] = this.values[s.key].filter(every2nd);
    }
  }

  draw() {
    const chart = this.canvas, ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = chart.clientWidth, H = chart.clientHeight;
    if (chart.width !== Math.round(W * dpr) || chart.height !== Math.round(H * dpr)) { chart.width = Math.round(W * dpr); chart.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const top = 3, bot = H - 3;
    ctx.strokeStyle = 'rgba(233,230,223,0.10)'; ctx.lineWidth = 1;
    for (const y of [0, 0.5, 1]) { const py = Math.round(bot - y * (bot - top)) + 0.5; ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke(); }
    const n = this.t.length; if (n < 2) return;
    const tmax = this.t[n - 1] || 1;
    ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    for (const s of SERIES) {
      const data = this.values[s.key];
      ctx.strokeStyle = s.color; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = this.t[i] / tmax * W, y = bot - Math.min(1, Math.max(0, data[i])) * (bot - top);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
}

Disk.HistoryChart = HistoryChart;
})(globalThis.Disk = globalThis.Disk || {});

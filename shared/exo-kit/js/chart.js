// Das Diagramm über den Szenen: zwei Achsen mit Pfeilspitzen und Titeln, darin Kurven.
// Die waagerechte Achse läuft als Anteil 0…1 (meist: Fortschritt in der Zeit), die senkrechte in den Werten
// der Kurve, linear oder logarithmisch.
(function (Kit) {
'use strict';

class Chart {
  // rect: { left, right, top, bottom }
  // options: { xTitle, yTitle, min, max, log, breakAt, breakShare }
  //   breakAt: Die senkrechte Achse ist bei diesem Wert unterbrochen. Darüber ist sie gespreizt, darunter so
  //   gestaucht, dass alles bis min in den unteren Anteil breakShare (0…1) der Höhe passt. So bleibt eine Kurve
  //   ganz sichtbar, auch wenn nur ihr oberer Teil vergrößert gezeigt wird.
  constructor(rect, options) {
    this.rect = rect;
    this.options = options;
    this.font = Kit.labelFont(1);
    const f = options.log ? Math.log : v => v;
    const linear = (v, lo, hi) => (f(v) - f(lo)) / (f(hi) - f(lo));
    if (options.breakAt === undefined) {
      this._scale = v => linear(v, options.min, options.max);
    } else {
      const at = options.breakAt, share = options.breakShare;
      this._scale = v => v >= at ? share + (1 - share) * linear(v, at, options.max) : share * linear(v, options.min, at);
    }
  }

  x(fraction) {
    const r = this.rect;
    return r.left + 4 + fraction * (r.right - r.left - 26);
  }

  y(value) {
    const r = this.rect;
    return r.bottom - this._scale(value) * (r.bottom - r.top - 14);
  }

  axes(ctx) {
    const r = this.rect, color = Kit.colors.axis;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(r.left, r.top + 6);
    ctx.lineTo(r.left, r.bottom);
    ctx.lineTo(r.right - 6, r.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r.left, r.top - 4); ctx.lineTo(r.left - 4, r.top + 7); ctx.lineTo(r.left + 4, r.top + 7);
    ctx.closePath();
    ctx.moveTo(r.right + 4, r.bottom); ctx.lineTo(r.right - 7, r.bottom - 4); ctx.lineTo(r.right - 7, r.bottom + 4);
    ctx.closePath();
    ctx.fill();

    ctx.font = this.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(this.options.xTitle, r.right, r.bottom + 15);
    ctx.save();
    ctx.translate(r.left - 16, (r.top + r.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(this.options.yTitle, 0, 0);
    ctx.restore();
  }

  // Kennzeichnet die Unterbrechung der senkrechten Achse: zwei schräge Striche auf der Achse und eine dünne
  // gestrichelte Linie quer durch das Diagramm.
  breakMark(ctx) {
    if (this.options.breakAt === undefined) return;
    const r = this.rect, y = this.y(this.options.breakAt);
    ctx.strokeStyle = Kit.colors.divider;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(r.left + 8, y);
    ctx.lineTo(r.right - 10, y);
    ctx.stroke();
    ctx.setLineDash([]);
    // Lücke in der Achse, darüber und darunter je ein schräger Strich
    ctx.fillStyle = Kit.colors.background;
    ctx.fillRect(r.left - 3, y - 3, 6, 6);
    ctx.strokeStyle = Kit.colors.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const dy of [-3, 3]) {
      ctx.moveTo(r.left - 6, y + dy + 2.5);
      ctx.lineTo(r.left + 6, y + dy - 2.5);
    }
    ctx.stroke();
  }

  // Beschränkt alles Folgende auf die Fläche zwischen den Achsen, bis ctx.restore() aufgerufen wird.
  // Für Kurven, die über den Wertebereich hinauslaufen.
  clip(ctx) {
    const r = this.rect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.left + 1, r.top - 6, r.right - r.left, r.bottom - r.top + 5);
    ctx.clip();
  }

  // dünne waagerechte Hilfslinie auf der Höhe eines Wertes
  level(ctx, value) {
    const r = this.rect, y = this.y(value);
    ctx.strokeStyle = Kit.colors.divider;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(r.left, y);
    ctx.lineTo(r.right - 10, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Maßstabsbalken: senkrechter Strich von Wert from bis Wert to an der Stelle x, mit Beschriftung rechts
  // daneben. Zeigt, wie viel ein Stück der senkrechten Achse bedeutet.
  scaleBar(ctx, x, from, to, label) {
    const y0 = this.y(from), y1 = this.y(to);
    ctx.strokeStyle = Kit.colors.axis;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, y0); ctx.lineTo(x, y1);
    ctx.moveTo(x - 4, y0); ctx.lineTo(x + 4, y0);
    ctx.moveTo(x - 4, y1); ctx.lineTo(x + 4, y1);
    ctx.stroke();
    ctx.font = this.font;
    ctx.fillStyle = Kit.colors.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 8, (y0 + y1) / 2);
  }

  // Kurve durch points = [[Anteil, Wert], …] mit einem Punkt an ihrem Ende
  line(ctx, points, color, width) {
    if (!points.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(this.x(points[0][0]), this.y(points[0][1]));
    for (let i = 1; i < points.length; i++) ctx.lineTo(this.x(points[i][0]), this.y(points[i][1]));
    ctx.stroke();
    ctx.lineCap = 'butt';

    const last = points[points.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x(last[0]), this.y(last[1]), width + 1, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Beschriftung einer Stelle der Kurve, mit kurzem Strich darüber
  mark(ctx, fraction, value, text, alpha) {
    const x = this.x(fraction), y = this.y(value);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = Kit.colors.axis;
    ctx.fillStyle = Kit.colors.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y - 24);
    ctx.stroke();
    ctx.font = this.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y - 29);
    ctx.globalAlpha = 1;
  }
}

Kit.Chart = Chart;
})(globalThis.ExoKit = globalThis.ExoKit || {});

// Zeichenhilfen, die in allen Applets gleich aussehen sollen: Beschriftung, Überschriften, Pfeile, Linienzüge.
(function (Kit) {
'use strict';

const draw = {
  // Text mit dunklem Saum, damit er auch über Linien lesbar bleibt
  text(ctx, font, text, x, y, align, color) {
    ctx.font = font;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color || Kit.colors.text;
    ctx.fillText(text, x, y);
  },

  // Überschrift einer Szene, mittig um cx, mit einem Strich in der Farbe ihrer Kurve davor
  caption(ctx, font, text, color, cx, y) {
    ctx.font = font;
    const width = ctx.measureText(text).width, swatch = 22, gap = 8;
    const left = cx - (width + swatch + gap) / 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + swatch, y);
    ctx.stroke();
    ctx.lineCap = 'butt';
    draw.text(ctx, font, text, left + swatch + gap, y, 'left');
  },

  // Linienzug durch points = [[x, y], …]
  polyline(ctx, points) {
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  },

  // gefüllte Pfeilspitze bei (x, y) in Richtung angle
  arrowHead(ctx, x, y, angle, size) {
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * size * 0.5, y + Math.sin(angle) * size * 0.5);
    ctx.lineTo(x - Math.cos(angle - 0.42) * size, y - Math.sin(angle - 0.42) * size);
    ctx.lineTo(x - Math.cos(angle + 0.42) * size, y - Math.sin(angle + 0.42) * size);
    ctx.closePath();
    ctx.fill();
  },

  // Pfeilspitzen in festen Abständen entlang eines Linienzugs; offset lässt sie in Laufrichtung wandern.
  // Am Anfang bleibt das Stück `skip` frei.
  arrowsAlong(ctx, points, spacing, offset, size, skip) {
    let next = ((offset % spacing) + spacing) % spacing, walked = 0, total = 0;
    for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      const length = Math.hypot(x1 - x0, y1 - y0);
      while (next <= walked + length) {
        if (next > (skip || 0) && next < total - 6) {
          const f = (next - walked) / length;
          draw.arrowHead(ctx, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, Math.atan2(y1 - y0, x1 - x0), size);
        }
        next += spacing;
      }
      walked += length;
    }
  },

  // gerader Pfeil von (x0, y0) nach (x1, y1) mit Spitze am Ende
  arrow(ctx, x0, y0, x1, y1, color, width, head) {
    const a = Math.atan2(y1 - y0, x1 - x0), size = head || 9;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width || 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - Math.cos(a) * size * 0.5, y1 - Math.sin(a) * size * 0.5);
    ctx.stroke();
    draw.arrowHead(ctx, x1 - Math.cos(a) * size * 0.5, y1 - Math.sin(a) * size * 0.5, a, size);
  },

  // senkrechte Trennlinie zwischen zwei Szenen
  divider(ctx, x, top, bottom) {
    ctx.strokeStyle = Kit.colors.divider;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  },
};

Kit.draw = draw;
})(globalThis.ExoKit = globalThis.ExoKit || {});

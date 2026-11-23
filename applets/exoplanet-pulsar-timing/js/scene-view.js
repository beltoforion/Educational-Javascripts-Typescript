// Zeichnet eine der beiden Szenen: den Pulsar mit seinem Strahl, gegebenenfalls Planet und Bahnen, darunter
// die Erde.
(function (PT) {
'use strict';

class SceneView {
  // panel: { x, width }, caption: { text, color } = Überschrift mit der Farbe der zugehörigen Kurve
  constructor(view, panel, model, texts, sprites, caption) {
    this.view = view;
    this.panel = panel;
    this.model = model;
    this.texts = texts;
    this.sprites = sprites;
    this.caption = caption;
    this.cx = panel.x + panel.width / 2;
    this.font = ExoKit.labelFont(1);
  }

  draw(ctx, t) {
    const v = this.view, p = this.panel, m = this.model, kit = ExoKit;
    const cx = this.cx, cy = v.centerY;
    const pulsar = m.pulsar(t), earth = m.earth();

    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, 0, p.width, v.height);
    ctx.clip();

    kit.draw.caption(ctx, this.font, this.caption.text, this.caption.color, cx, v.captionY);
    if (m.hasPlanet) this._orbits(ctx);
    this._beam(ctx, cx + pulsar.x, cy + pulsar.y, m.beamAngle(t));
    if (m.hasPlanet) {
      this.sprites.drawCentered(ctx, 'center_of_mass', cx, cy, v.barycenterSize);
      const planet = m.planet(t), turn = Math.PI - m.orbitAngle(t);
      this.sprites.drawCentered(ctx, 'planet', cx + planet.x, cy + planet.y, v.planetSize, turn);
      kit.draw.text(ctx, this.font, this.texts.planet, cx + planet.x, cy + planet.y - v.planetSize / 2 - 13, 'center');
    }
    this.sprites.drawCentered(ctx, 'pulsar', cx + pulsar.x, cy + pulsar.y, v.pulsarSize);
    this._earth(ctx, cx + earth.x, cy + earth.y, m.signal(t));
    ctx.restore();
  }

  _orbits(ctx) {
    const mm = this.model.model;
    ctx.strokeStyle = ExoKit.colors.orbit;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([]);
    for (const radius of [mm.pulsarDistance, mm.planetDistance]) {
      ctx.beginPath();
      ctx.arc(this.cx, this.view.centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  // Der Strahl: zwei schmale Kegel nach beiden Seiten, in der Farbe der Szene, nach außen verblassend.
  // angle 0 = senkrecht.
  _beam(ctx, x, y, angle) {
    const v = this.view, p = this.panel;
    const length = v.beamLength, half = 1.4 * this.model.model.beamWidth;
    ctx.save();
    // Der Strahl bleibt unterhalb der Überschrift.
    ctx.beginPath();
    ctx.rect(p.x, v.captionY + 16, p.width, v.height);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-angle);
    const fade = ctx.createLinearGradient(0, -length, 0, length);
    fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fade.addColorStop(0.5, this.caption.color);
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fade;
    ctx.globalAlpha = 0.85;
    const spread = length * Math.tan(half);
    for (const side of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-spread, side * length);
      ctx.lineTo(spread, side * length);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Die Erde; trifft sie der Strahl, leuchtet ein Ring in der Farbe der Szene auf.
  _earth(ctx, x, y, signal) {
    const v = this.view, base = this.model.model.baseline;
    const lit = Math.max(0, (signal - base) / (1 - base));
    if (lit > 0.02) {
      ctx.strokeStyle = this.caption.color;
      ctx.globalAlpha = lit;
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, v.earthSize / 2 + 5, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    this.sprites.drawCentered(ctx, 'earth', x, y, v.earthSize);
    ExoKit.draw.text(ctx, this.font, this.texts.earth, x + v.earthSize / 2 + 12, y, 'left');
  }
}

PT.SceneView = SceneView;
})(globalThis.PulsarTiming = globalThis.PulsarTiming || {});

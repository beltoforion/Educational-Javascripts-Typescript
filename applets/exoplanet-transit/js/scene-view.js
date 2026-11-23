// Zeichnet die Szene: Sternwarte am Horizont, darüber der Stern mit der Bahn seines Planeten.
(function (TR) {
'use strict';

class SceneView {
  constructor(view, model, texts, sprites) {
    this.view = view;
    this.model = model;
    this.texts = texts;
    this.sprites = sprites;
    this.font = ExoKit.labelFont(1);
  }

  // planet: { x, y, front } relativ zur Sternmitte; phaseAngle: 0 = voll beleuchtet, π = Nachtseite
  draw(ctx, planet, phaseAngle) {
    const v = this.view, m = this.model, kit = ExoKit;
    kit.Observatory.draw(ctx, this.sprites, v.starX, v.telescopeY, kit.Observatory.scaleFor(v.width));

    // hintere Hälfte der Bahn und der Planet dahinter, dann der Stern, dann die vordere Hälfte
    this._orbit(ctx, Math.PI, 2 * Math.PI);
    if (!planet.front) this._planet(ctx, planet, phaseAngle, 0.8);
    this.sprites.drawCentered(ctx, 'sun', v.starX, v.starY, 2 * m.starRadius);
    this._orbit(ctx, 0, Math.PI);
    if (planet.front) this._planet(ctx, planet, phaseAngle, 1);

    kit.draw.text(ctx, this.font, this.texts.star, v.starX, v.starY - m.starRadius - 12, 'center');
  }

  // Bahnhälfte als Ellipsenbogen; die vordere Hälfte liegt unten
  _orbit(ctx, from, to) {
    const v = this.view, m = this.model;
    ctx.strokeStyle = ExoKit.colors.orbit;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(v.starX, v.starY, m.orbitRadius, m.orbitRadius * m.orbitTilt, 0, from, to);
    ctx.stroke();
  }

  // Der Planet mit seiner Phase: Beleuchtet ist die dem Stern zugewandte Seite. Vor dem Stern sehen wir fast
  // nur seine Nachtseite, dahinter die voll beleuchtete Scheibe. size: hinter dem Stern etwas kleiner
  // gezeichnet, weil weiter weg.
  _planet(ctx, planet, phaseAngle, size) {
    const v = this.view, x = v.starX + planet.x, y = v.starY + planet.y;
    const r = this.model.planetRadius * size;
    ctx.globalAlpha = 0.28;                                   // Nachtseite: schwach erkennbar
    this.sprites.drawCentered(ctx, 'jupiter', x, y, 2 * r);
    ctx.globalAlpha = 1;

    // Beleuchteter Teil: vom Rand auf der Seite des Sterns bis zur Schattengrenze
    const side = planet.x < 0 ? 1 : -1, reach = Math.cos(phaseAngle), steps = 18;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = -Math.PI / 2 + Math.PI * i / steps;
      ctx.lineTo(x + side * r * Math.cos(t), y + r * Math.sin(t));
    }
    for (let i = steps; i >= 0; i--) {
      const t = -Math.PI / 2 + Math.PI * i / steps;
      ctx.lineTo(x - side * r * reach * Math.cos(t), y + r * Math.sin(t));
    }
    ctx.closePath();
    ctx.clip();
    this.sprites.drawCentered(ctx, 'jupiter', x, y, 2 * r);
    ctx.restore();

    // Steht der Planet hinter der Sternscheibe, entfällt seine Beschriftung.
    const hidden = !planet.front && Math.hypot(planet.x, planet.y) < this.model.starRadius + this.model.planetRadius;
    if (!hidden) ExoKit.draw.text(ctx, this.font, this.texts.planet, x, y - this.model.planetRadius - 14, 'center');
  }
}

TR.SceneView = SceneView;
})(globalThis.Transit = globalThis.Transit || {});

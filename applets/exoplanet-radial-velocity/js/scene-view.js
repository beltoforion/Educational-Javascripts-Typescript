// Zeichnet die Szene: Sternwarte am Horizont, darüber Stern und Planet auf ihren Bahnen, oben das Spektrum
// des Sterns mit seinen verschobenen Linien, am linken Rand der Pfeil der Radialgeschwindigkeit.
(function (RV) {
'use strict';

class SceneView {
  constructor(view, model, texts, sprites) {
    this.view = view;
    this.model = model;
    this.texts = texts;
    this.sprites = sprites;
    this.font = ExoKit.labelFont(1);
  }

  // frame: { star, planet, angle, velocity }; Orte relativ zum Schwerpunkt, velocity −1…1
  draw(ctx, frame) {
    const v = this.view, kit = ExoKit;
    kit.Observatory.draw(ctx, this.sprites, v.centerX, v.telescopeY, kit.Observatory.scaleFor(v.width));
    this._spectrum(ctx, frame.velocity);
    this._orbits(ctx);
    this.sprites.drawCentered(ctx, 'center_of_mass', v.centerX, v.centerY, v.barycenterSize);
    this._planet(ctx, frame);
    this._star(ctx, frame);
    this._velocity(ctx, frame.velocity);
  }

  // Farbband mit dunklen Absorptionslinien. Entfernt sich der Stern, rücken die Linien zum roten Ende.
  _spectrum(ctx, velocity) {
    const v = this.view, s = v.spectrum, left = v.centerX - s.width / 2, top = s.y - s.height / 2;
    ExoKit.draw.text(ctx, this.font, this.texts.spectrum, v.centerX, s.titleY, 'center');
    this.sprites.draw(ctx, 'spectrum', left, top, s.width, s.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, s.width, s.height);
    ctx.clip();
    this.sprites.draw(ctx, 'spectrum_lines', left + velocity * s.shift, top, s.width, s.height);
    ctx.restore();
  }

  _orbits(ctx) {
    const v = this.view, m = this.model;
    ctx.strokeStyle = ExoKit.colors.orbit;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([]);
    for (const radius of [m.starDistance, m.planetDistance]) {
      ctx.beginPath();
      ctx.arc(v.centerX, v.centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  // Der Planet mit seiner Nachtseite, die immer vom Stern weg zeigt
  _planet(ctx, frame) {
    const v = this.view, x = v.centerX + frame.planet.x, y = v.centerY + frame.planet.y;
    const turn = Math.PI - frame.angle;
    this.sprites.drawCentered(ctx, 'planet', x, y, v.planetSize, turn);
    this.sprites.drawCentered(ctx, 'planet_shadow', x, y, v.planetSize, turn);
    ExoKit.draw.text(ctx, this.font, this.texts.planet, x, y - v.planetSize / 2 - 13, 'center');
  }

  // Der Stern, rötlich oder bläulich getönt je nach Bewegung
  _star(ctx, frame) {
    const v = this.view, x = v.centerX + frame.star.x, y = v.centerY + frame.star.y;
    this.sprites.drawCentered(ctx, 'sun', x, y, v.starSize);
    const strength = Math.abs(frame.velocity);
    if (strength < 0.02) return;
    ctx.fillStyle = frame.velocity > 0 ? `rgba(255, 40, 20, ${0.32 * strength})` : `rgba(130, 175, 255, ${0.5 * strength})`;
    ctx.beginPath();
    ctx.arc(x, y, v.starSize / 2 - 0.5, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Pfeil am linken Rand: nach oben, wenn sich der Stern von der Sternwarte entfernt, nach unten, wenn er
  // sich nähert; seine Länge zeigt den Betrag. Daneben der senkrecht geschriebene Titel.
  _velocity(ctx, velocity) {
    const v = this.view, a = v.arrow, kit = ExoKit;
    ctx.save();
    ctx.translate(a.titleX, v.centerY);
    ctx.rotate(-Math.PI / 2);
    kit.draw.text(ctx, this.font, this.texts.velocity, 0, 0, 'center');
    ctx.restore();
    if (Math.abs(velocity) > 0.03) {
      kit.draw.arrow(ctx, a.x, v.centerY, a.x, v.centerY - velocity * a.length, kit.colors.text, 2.6, 11);
    } else {
      ctx.fillStyle = kit.colors.text;
      ctx.beginPath();
      ctx.arc(a.x, v.centerY, 1.6, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

RV.SceneView = SceneView;
})(globalThis.RadialVelocity = globalThis.RadialVelocity || {});

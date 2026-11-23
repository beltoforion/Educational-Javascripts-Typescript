// Zeichnet die Szene: Sternhintergrund, Einfärbung von Blau nach Rot, Wellenfronten und den Stern.
(function (DP) {
'use strict';

// Zufallszahl 0…1, fest an die Nummer i gebunden
const random = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

class SceneView {
  constructor(view, model, texts, sprites) {
    this.view = view;
    this.model = model;
    this.texts = texts;
    this.sprites = sprites;
    this.font = ExoKit.labelFont(1);
  }

  // fronts: siehe WaveModel; t = Zeit in Sekunden, bewegt den Sternhintergrund
  draw(ctx, fronts, t) {
    const v = this.view, kit = ExoKit;
    this._background(ctx, t);
    this._tint(ctx);

    ctx.strokeStyle = kit.colors.light;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([]);
    for (const front of fronts) {
      ctx.globalAlpha = Math.max(0, 1 - front.age);
      ctx.beginPath();
      ctx.arc(v.starX + front.x, v.starY, front.radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    this.sprites.drawCentered(ctx, 'sun', v.starX, v.starY, v.starSize);
    const top = v.starY - v.starSize / 2 - 22;
    kit.draw.arrow(ctx, v.starX + 34, top, v.starX - 34, top, kit.colors.text, 2.4, 10);
    kit.draw.text(ctx, this.font, this.texts.motion, v.starX, top - 18, 'center');
    kit.draw.text(ctx, this.font, this.texts.shorter, 20, v.labelY, 'left', '#a9c2ff');
    kit.draw.text(ctx, this.font, this.texts.longer, v.width - 20, v.labelY, 'right', '#ffa99c');
  }

  // Ferne Sterne, die nach rechts ziehen, weil sich der Stern nach links bewegt
  _background(ctx, t) {
    const v = this.view, speed = this.model.starSpeed * this.model.waveSpeed;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < v.backgroundStars; i++) {
      const depth = 0.35 + 0.65 * random(i * 3 + 2);                    // fernere ziehen langsamer
      const x = (random(i * 3) * v.width + speed * depth * t) % v.width;
      ctx.globalAlpha = 0.25 + 0.5 * depth;
      ctx.beginPath();
      ctx.arc(x, random(i * 3 + 1) * v.height, 0.6 + 1.1 * depth, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Einfärbung: links, wohin sich der Stern bewegt, blau; rechts rot
  _tint(ctx) {
    const v = this.view;
    const tint = ctx.createLinearGradient(0, 0, v.width, 0);
    tint.addColorStop(0, 'rgba(30, 60, 255, 0.34)');
    tint.addColorStop(0.5, 'rgba(120, 40, 140, 0.12)');
    tint.addColorStop(1, 'rgba(255, 30, 20, 0.34)');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, v.width, v.height);
  }
}

DP.SceneView = SceneView;
})(globalThis.Doppler = globalThis.Doppler || {});

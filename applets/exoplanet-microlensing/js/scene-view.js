// Das Bewegte einer Szene: der Hintergrundstern mit seinen Lichtstrahlen, sein von der Linse verzerrtes Bild,
// der Linsenstern mit Planet und die Beschriftung.
(function (ML) {
'use strict';

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

class SceneView {
  // caption: { text, color } = Überschrift der Szene mit der Farbe ihrer Lichtkurve
  constructor(layout, texts, sprites, caption) {
    this.layout = layout;
    this.texts = texts;
    this.sprites = sprites;
    this.caption = caption;
    this.font = ExoKit.labelFont(1);
  }

  // frame: { bodies, fan, hits, raster, fade, flow }
  //   bodies = Stern und Planet mit ihrem Ort in der Zeichnung (siehe Stage)
  //   fan    = Strahlen, die der Hintergrundstern in der Zeichenebene aussendet
  //   hits   = Strahlen, die die Öffnung des Teleskops treffen (siehe RayTracer)
  //   fade   = 0…1, blendet das Linsensystem am Anfang und Ende des Durchgangs ein und aus
  //   flow   = Verschiebung der wandernden Richtungspfeile entlang der Strahlen
  draw(ctx, frame) {
    const L = this.layout, v = L.view;
    this._caption(ctx);
    this._fan(ctx, frame);
    frame.raster.draw(ctx);
    this._hits(ctx, frame);
    this.sprites.drawCentered(ctx, 'sun', L.cx, v.sourceY, v.sourceSize);
    ctx.globalAlpha = frame.fade;
    this._lens(ctx, frame.bodies);
    this._lensLabels(ctx, frame.bodies);
    ctx.globalAlpha = 1;
    this._text(ctx, this.texts.source, L.panel.x + 12, L.band.y - 4, 'left');
    ctx.setLineDash([]);
  }

  // Überschrift mit einem Strich in der Farbe der zugehörigen Lichtkurve
  _caption(ctx) {
    ExoKit.draw.caption(ctx, this.font, this.caption.text, this.caption.color, this.layout.cx, this.layout.view.captionY);
  }

  // Der Hintergrundstern strahlt in alle Richtungen. Gezeichnet ist ein Fächer seiner Strahlen in Richtung
  // Erde: Wer nahe an einer Masse vorbeikommt, wird abgelenkt. Fast alle verfehlen das Teleskop.
  _fan(ctx, frame) {
    const spacing = this.layout.view.arrowSpacing;
    ctx.strokeStyle = ExoKit.colors.light;
    ctx.fillStyle = ExoKit.colors.light;
    ctx.lineWidth = 0.6;
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.32;
    frame.fan.forEach((ray, k) => {
      ExoKit.draw.polyline(ctx, ray.points);
      // Die Pfeile benachbarter Strahlen sind gegeneinander versetzt, sonst bilden sie Querbänder.
      ExoKit.draw.arrowsAlong(ctx, ray.points, spacing, frame.flow + (k % 3) * spacing / 3, 4, 16);
    });
    ctx.globalAlpha = 1;
  }

  // Die Strahlen, die das Teleskop treffen. Ohne Linse sind es wenige; zieht der Linsenstern durch, lenkt er
  // viele weitere zum Teleskop, auch solche, die vor oder hinter der Zeichenebene an ihm vorbeilaufen. Ihre
  // Helligkeiten addieren sich: Je mehr Licht ankommt, desto heller das Bündel.
  _hits(ctx, frame) {
    const hits = frame.hits, limit = this.layout.view.hitsDrawn;
    if (!hits.length) return;
    // Bei sehr vielen Treffern nur eine gleichmäßige Auswahl zeichnen
    const stride = Math.max(1, Math.ceil(hits.length / limit));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255, 236, 130, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([]);
    for (let i = 0; i < hits.length; i += stride) ExoKit.draw.polyline(ctx, hits[i].points);
    ctx.restore();

    // Richtungspfeile nur auf wenigen Treffern, und nur auf solchen, die in der Zeichenebene bleiben
    const inPlane = hits.filter(hit => hit.inPlane);
    const every = Math.max(1, Math.ceil(inPlane.length / 3));
    ctx.fillStyle = '#ffffff';
    for (let i = Math.floor(every / 2); i < inPlane.length; i += every) ExoKit.draw.arrowsAlong(ctx, inPlane[i].points, this.layout.view.arrowSpacing, frame.flow, 7, 16);
  }

  // bodies: [Stern, Planet?] mit ihrem Ort x in der Linsenebene
  _lens(ctx, bodies) {
    const v = this.layout.view, y = v.lensY;
    const [star, planet] = bodies;
    if (planet) {
      const rx = Math.abs(planet.x - star.x);
      ctx.strokeStyle = ExoKit.colors.orbit;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(star.x, y, rx, rx * 0.2, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
    this.sprites.drawCentered(ctx, 'sun', star.x, y, v.starSize);
    if (planet) this.sprites.drawCentered(ctx, 'planet', planet.x, y, v.planetSize);
  }

  _text(ctx, text, x, y, align) {
    ExoKit.draw.text(ctx, this.font, text, x, y, align);
  }

  _lensLabels(ctx, bodies) {
    const y = this.layout.view.lensY;
    const [star, planet] = bodies;
    this._text(ctx, this.texts.lensStar, star.x, y + 31, 'center');
    if (planet) this._text(ctx, this.texts.planet, planet.x + 9, y - 16, 'left');
  }
}

ML.SceneView = SceneView;
})(globalThis.Microlensing = globalThis.Microlensing || {});

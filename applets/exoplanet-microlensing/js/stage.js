// Eine der beiden Szenen als Ganzes: ihr Linsensystem mit Lichtkurve und alles, was sie in ihrem Teil der
// Zeichenfläche darstellt.
(function (ML) {
'use strict';

class Stage {
  // lens: das Linsensystem der Szene, caption: { text, color }
  constructor(view, panel, lens, caption, deps) {
    const model = deps.model;
    this.lens = lens;
    this.layout = new ML.Layout(view, panel);
    this.raster = new ML.SkyRaster(this.layout, model.sourceRadius);
    this.tracer = new ML.RayTracer(this.layout, view.telescopeAperture);
    this.shownStep = this.tracer.stepFor(view.raysShown);
    this.planetDistance = this._planetDistance();
    this.backdrop = new ML.Backdrop(this.layout, deps.sprites);
    this.scene = new ML.SceneView(this.layout, deps.texts, deps.sprites, caption);

    // Die Lichtkurve ist die aufsummierte Helligkeit der verzerrten Bilder, die die Szene zeigt.
    const brightness = new ML.ImageBrightness(lens, model.sourceRadius, model.sourceRadius / model.cellsPerRadius);
    this.curve = new ML.LightCurve(lensX => brightness.magnification(lensX), model.travel, model.samples);
    // Der Planet wirkt am stärksten, wenn das hellere Bild des Hintergrundsterns bei ihm liegt. Das Bild im
    // Abstand s vom Stern gehört zu einer Quelle im Abstand s − 1/s.
    const planet = lens.bodies[1];
    this.planetMark = planet ? this.curve.progressOf(-(planet.offset - 1 / planet.offset)) : null;
  }

  resize(rasterScale, font) {
    this.raster.resize(rasterScale);
    this.scene.font = font;
  }

  // Abstand in Pixeln, in dem der Planet neben seinem Stern gezeichnet wird.
  // Die Lichtkurve schlägt aus, wenn das hellere Bild des Hintergrundsterns beim Planeten liegt. In der
  // Zeichnung soll in diesem Augenblick der zugehörige Lichtstrahl am Planeten vorbeilaufen. Weil die
  // Anziehung so stark übertrieben ist, läuft der Strahl in einem weiten Bogen und kreuzt die Linsenebene
  // näher am Stern, als es der Abstand des Bildes erwarten ließe. Der Planet steht deshalb dort, wo dieser
  // Strahl wirklich vorbeikommt.
  _planetDistance() {
    const L = this.layout, planet = this.lens.bodies[1];
    if (!planet) return 0;
    const s = planet.offset, starX = L.lensPlaneX(-(s - 1 / s));
    const hits = this.tracer.arriving([{ x: starX, mass: 1, radius: this._starRadius() }]);
    const side = Math.sign(s);
    const major = hits.reduce((best, hit) => (side * hit.apparentX > side * best.apparentX ? hit : best), hits[0]);
    return this.tracer.crossing(major.points) - starX;
  }

  _starRadius() {
    return this.layout.view.starSize / 2 + 1;
  }

  // Stern und Planet, wie sie gezeichnet und vom Strahlverfolger gebraucht werden: Ort in der Linsenebene,
  // Masse und der Radius, in dem ein Strahl verschluckt wird. Der Planet ist viel größer gezeichnet, als
  // seiner Wirkung entspricht; die Strahlen, die er ablenkt, laufen dicht an ihm vorbei und dürfen nicht an
  // seinem Bild enden.
  _bodies(lensX) {
    const starX = this.layout.lensPlaneX(lensX);
    const bodies = [{ x: starX, mass: 1, radius: this._starRadius() }];
    const planet = this.lens.bodies[1];
    if (planet) bodies.push({ x: starX + this.planetDistance, mass: planet.mass, radius: this.layout.view.planetCore });
    return bodies;
  }

  // flow = Verschiebung der wandernden Richtungspfeile
  draw(ctx, progress, flow) {
    const view = this.layout.view, panel = this.layout.panel;
    const lensX = this.curve.lensX(progress);
    const bodies = this._bodies(lensX);
    this.raster.render(this.lens, lensX);
    ctx.save();
    ctx.beginPath();
    ctx.rect(panel.x, 0, panel.width, view.height);
    ctx.clip();
    this.backdrop.draw(ctx);
    this.scene.draw(ctx, {
      bodies,
      fan: this.tracer.fan(bodies, view.groundY),
      hits: this.tracer.hits(bodies, this.shownStep),
      raster: this.raster,
      fade: Math.min(1, Math.min(progress, 1 - progress) / 0.03),
      flow,
    });
    ctx.restore();
  }
}

ML.Stage = Stage;
})(globalThis.Microlensing = globalThis.Microlensing || {});

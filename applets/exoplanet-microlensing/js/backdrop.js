// Der unbewegte Hintergrund einer Szene: das Bild der Sternwarte, so gelegt, dass die Öffnung der Kuppel auf
// der Sichtlinie liegt; dort laufen die Lichtstrahlen zusammen.
(function (ML) {
'use strict';

class Backdrop {
  constructor(layout, sprites) {
    this.layout = layout;
    this.sprites = sprites;
  }

  draw(ctx) {
    const v = this.layout.view;
    ExoKit.Observatory.draw(ctx, this.sprites, this.layout.cx, v.telescopeY, v.observatoryScale);
  }
}

ML.Backdrop = Backdrop;
})(globalThis.Microlensing = globalThis.Microlensing || {});

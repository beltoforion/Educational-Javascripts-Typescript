// Das Bild der Sternwarte mit Nachthimmel und Horizont. Es wird so gelegt, dass die Öffnung der Kuppel an
// einer vorgegebenen Stelle liegt; darüber geht sein Himmel nahtlos in den schwarzen Grund über.
(function (Kit) {
'use strict';

// Maße des Bildes und Ort der Kuppelöffnung darin, in den Einheiten, in denen die Applets rechnen. Die Datei
// sternwarte.png ist viermal so fein aufgelöst (aus originals/exoplanet-radial-velocity/_archive/sternwarte.svg
// erzeugt: inkscape --export-area-drawing --export-width=2204), damit sie auch groß gezeichnet scharf bleibt.
const IMAGE = Object.freeze({ width: 551, height: 288, apertureX: 262, apertureY: 157, horizonY: 205 });

Kit.Observatory = {
  image: IMAGE,

  // Vergrößerung, bei der das Bild einen Streifen der Breite width füllt, wenn die Kuppel in seiner Mitte steht
  scaleFor(width) {
    // die äußersten Spalten des Bildes sind durchscheinend und bleiben außerhalb
    return width / 2 / (Math.min(IMAGE.apertureX, IMAGE.width - IMAGE.apertureX) - 6);
  },

  // (apertureX, apertureY) = wo die Öffnung der Kuppel in der Zeichnung liegen soll
  draw(ctx, sprites, apertureX, apertureY, scale) {
    sprites.draw(ctx, 'sternwarte',
      apertureX - IMAGE.apertureX * scale, apertureY - IMAGE.apertureY * scale, IMAGE.width * scale, IMAGE.height * scale);
  },

  // Höhe des Horizonts in der Zeichnung, wenn die Öffnung bei apertureY liegt
  horizonY(apertureY, scale) {
    return apertureY + (IMAGE.horizonY - IMAGE.apertureY) * scale;
  },
};
})(globalThis.ExoKit = globalThis.ExoKit || {});

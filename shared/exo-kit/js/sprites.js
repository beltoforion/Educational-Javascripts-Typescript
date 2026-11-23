// Lädt die Bilder, die sich die Exoplaneten-Applets teilen (Sternwarte, Sonne, Planeten, Erde …).
// Ein Bild heißt wie seine Datei ohne Endung. Solange es noch lädt, wird es einfach nicht gezeichnet.
(function (Kit) {
'use strict';

// Ordner der Bilder, abgeleitet vom Ort dieser Skriptdatei (…/js/sprites.js → …/assets/sprites/)
const script = document.currentScript;
const DEFAULT_PATH = script ? script.src.replace(/js\/[^/]*$/, 'assets/sprites/') : 'assets/sprites/';

class Sprites {
  // names: die benötigten Bilder; path: abweichender Ordner (mit Schrägstrich am Ende);
  // onLoad wird nach jedem fertig geladenen Bild aufgerufen
  constructor(names, path, onLoad) {
    this.images = {};
    for (const name of names) {
      const image = new Image();
      image.onload = onLoad;
      image.src = (path || DEFAULT_PATH) + name + '.png';
      this.images[name] = image;
    }
  }

  ready(name) {
    const image = this.images[name];
    return image.complete && image.naturalWidth > 0;
  }

  // zeichnet das Bild in das Rechteck; meldet, ob es schon geladen war
  draw(ctx, name, x, y, width, height) {
    if (!this.ready(name)) return false;
    ctx.drawImage(this.images[name], x, y, width, height);
    return true;
  }

  // zeichnet das Bild mittig um (x, y) mit dem Durchmesser size, auf Wunsch gedreht (Bogenmaß)
  drawCentered(ctx, name, x, y, size, angle) {
    if (!this.ready(name)) return false;
    if (!angle) {
      ctx.drawImage(this.images[name], x - size / 2, y - size / 2, size, size);
      return true;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(this.images[name], -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
}

Kit.Sprites = Sprites;
})(globalThis.ExoKit = globalThis.ExoKit || {});

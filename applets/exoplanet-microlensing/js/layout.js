// Umrechnung zwischen Winkeln am Himmel und Orten in der Zeichnung, für eine der beiden Szenen.
//
// Die Zeichnung zeigt die Ebene, in der Teleskop, Linsenstern, Planet und Hintergrundstern liegen. Ein
// Strahl, der unter dem Winkel θ am Teleskop ankommt, durchstößt die Linsenebene bei lensPlaneX(θ); seine
// gerade Verlängerung trifft die Höhe des Hintergrundsterns bei skyX(θ). Dort erscheint das Bild.
(function (ML) {
'use strict';

class Layout {
  // panel: { x, width } = der Teil der Zeichenfläche, der dieser Szene gehört
  constructor(view, panel) {
    this.view = view;
    this.panel = panel;
    this.cx = panel.x + panel.width / 2;      // Sichtlinie vom Teleskop zum Hintergrundstern
    this.lensScale = view.einsteinRadius;
    // Strahlensatz: Der Hintergrundstern ist weiter entfernt als die Linse.
    this.distanceRatio = (view.telescopeY - view.sourceY) / (view.telescopeY - view.lensY);
    this.skyScale = view.einsteinRadius * this.distanceRatio;
    this.band = Object.freeze({
      x: panel.x, y: view.sourceY - view.skyHalfHeight, width: panel.width, height: 2 * view.skyHalfHeight,
    });
  }

  lensPlaneX(theta) { return this.cx + theta * this.lensScale; }
  skyX(theta) { return this.cx + theta * this.skyScale; }
  lensAngle(x) { return (x - this.cx) / this.lensScale; }
  contains(x) { return x >= this.panel.x && x < this.panel.x + this.panel.width; }
}

ML.Layout = Layout;
})(globalThis.Microlensing = globalThis.Microlensing || {});

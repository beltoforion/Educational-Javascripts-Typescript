// Die Gravitationslinse: Punktmassen, die alle auf einer Geraden liegen (Stern und Planet).
//
// Einheiten: Winkel am Himmel in Einsteinradien des Sterns, Masse des Sterns = 1. Die x-Achse ist die
// Richtung, in der das Linsensystem am Hintergrundstern vorbeizieht; alle Massen liegen auf ihr.
// Linsengleichung: Ein Lichtstrahl, der die Linsenebene am Ort θ durchstößt, stammt vom Ort
//   β = θ − Σ mᵢ (θ − xᵢ) / |θ − xᵢ|²
// in der Quellebene.
(function (ML) {
'use strict';

const TINY = 1e-12;

class LensSystem {
  // bodies: [{ offset, mass }], offset = Abstand vom Stern entlang der x-Achse
  constructor(bodies) {
    this.bodies = bodies.map(b => ({ offset: b.offset, mass: b.mass }));
  }

  // Ort in der Quellebene, von dem der Strahl durch (x, y) kommt. lensX ist die Stellung des Sterns.
  sourcePosition(x, y, lensX, out) {
    let bx = x, by = y;
    for (const b of this.bodies) {
      const dx = x - lensX - b.offset;
      const d2 = dx * dx + y * y + TINY;
      const f = b.mass / d2;
      bx -= f * dx;
      by -= f * y;
    }
    out[0] = bx;
    out[1] = by;
    return out;
  }

  // Dasselbe für einen Strahl auf der Achse
  axisBeta(x, lensX) {
    let b = x;
    for (const body of this.bodies) {
      const dx = x - lensX - body.offset;
      b -= body.mass / dx;
    }
    return b;
  }

  // Bilder einer punktförmigen Quelle, die selbst auf der Achse liegt (bei sourceX), soweit sie ebenfalls
  // auf der Achse liegen. Zwischen je zwei Massen und außerhalb der äußersten liegt genau ein Bild, denn
  // dort wächst β(θ) streng monoton von −∞ nach +∞.
  // Ergebnis: [{ x, magnification }], von links nach rechts.
  axisImages(sourceX, lensX) {
    const poles = this.bodies.map(b => lensX + b.offset).sort((a, b) => a - b);
    const reach = Math.abs(sourceX) + Math.max(Math.abs(poles[0]), Math.abs(poles[poles.length - 1])) + 4;
    const edges = [-reach].concat(poles, [reach]);
    const images = [];
    for (let i = 0; i + 1 < edges.length; i++) {
      const x = this._root(sourceX, lensX, edges[i], edges[i + 1]);
      images.push({ x, magnification: this.axisMagnification(x, lensX) });
    }
    return images;
  }

  _root(sourceX, lensX, lo, hi) {
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi);
      if (this.axisBeta(mid, lensX) < sourceX) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  // Verstärkung eines Punktbildes auf der Achse: Kehrwert der Jacobi-Determinante der Linsengleichung.
  axisMagnification(x, lensX) {
    let s = 0;
    for (const b of this.bodies) {
      const dx = x - lensX - b.offset;
      s += b.mass / (dx * dx + TINY);
    }
    return 1 / Math.max(Math.abs((1 + s) * (1 - s)), TINY);
  }
}

// Verstärkung einer punktförmigen Quelle durch eine einzelne Punktmasse im Abstand u (Paczyński-Kurve).
LensSystem.pointLensMagnification = function (u) {
  const a = Math.abs(u);
  return (a * a + 2) / (a * Math.sqrt(a * a + 4));
};

ML.LensSystem = LensSystem;
})(globalThis.Microlensing = globalThis.Microlensing || {});

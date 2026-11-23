// Gesamthelligkeit der verzerrten Bilder des Hintergrundsterns.
//
// Eine Gravitationslinse ändert die Flächenhelligkeit nicht, nur die Fläche des Bildes. Die Helligkeit, die
// das Teleskop misst, ist deshalb die Fläche aller Bilder geteilt durch die Fläche der unverzerrten
// Sternscheibe. Das ist dieselbe Rechnung wie in sky-raster.js, das die Bilder zeichnet, nur auf einem
// feineren Gitter und aufsummiert: Eine Gitterzelle gehört zum Bild, wenn ihr Lichtstrahl die Sternscheibe
// trifft.
(function (ML) {
'use strict';

const TINY = 1e-12;

class ImageBrightness {
  // sourceRadius in Einsteinradien, cell = Kantenlänge einer Gitterzelle
  constructor(lens, sourceRadius, cell) {
    this.lens = lens;
    this.rho = sourceRadius;
    this.cell = cell;
  }

  // Helligkeit im Verhältnis zu der ohne Linse. Hintergrundstern im Ursprung, Linsenstern bei lensX.
  magnification(lensX) {
    const h = this.cell, rho = this.rho, bodies = this.lens.bodies, n = bodies.length;
    let total = 0;
    for (const b of bodies) total += b.mass;
    // Senkrecht zur Achse reicht kein Bild weiter als bis knapp über den Einsteinring aller Massen. Alle
    // Massen liegen auf der Achse, das Bild ist spiegelbildlich zu ihr: Es genügt die obere Hälfte.
    const ny = Math.ceil((Math.sqrt(total) + rho + 0.3) / h);
    // Weiter außen trifft kein Teil der Zelle die Scheibe.
    const outer = (rho + 0.5) * (rho + 0.5);

    let area = 0;
    for (const [from, to] of this._ranges(lensX)) {
      const nx = Math.ceil((to - from) / h);
      for (let j = 0; j < ny; j++) {
        const y = (j + 0.5) * h, y2 = y * y;
        for (let i = 0; i < nx; i++) {
          const x = from + (i + 0.5) * h;
          let bx = x, by = y;
          for (let k = 0; k < n; k++) {
            const dx = x - lensX - bodies[k].offset;
            const f = bodies[k].mass / (dx * dx + y2 + TINY);
            bx -= f * dx;
            by -= f * y;
          }
          const r2 = bx * bx + by * by;
          if (r2 > outer) continue;
          area += this._coverage(x, y, lensX, bx, by, Math.sqrt(r2));
        }
      }
    }
    return 2 * area * h * h / (Math.PI * rho * rho);
  }

  // Abschnitte der Achse, über denen Bilder liegen können: Das hellere Bild bleibt in der Nähe des
  // Hintergrundsterns, das schwächere und die Störung durch den Planeten in der Nähe der Massen.
  // Überlappende Abschnitte werden zusammengelegt, damit keine Zelle doppelt zählt.
  _ranges(lensX) {
    const margin = 1.5 + this.rho;
    let lo = lensX, hi = lensX;
    for (const b of this.lens.bodies) { lo = Math.min(lo, lensX + b.offset); hi = Math.max(hi, lensX + b.offset); }
    const nearSource = [-margin, margin], nearLens = [lo - margin, hi + margin];
    if (nearLens[0] <= nearSource[1] && nearSource[0] <= nearLens[1]) {
      return [[Math.min(nearSource[0], nearLens[0]), Math.max(nearSource[1], nearLens[1])]];
    }
    return [nearSource, nearLens];
  }

  // Anteil der Zelle, der im Bild liegt. Am Rand der Sternscheibe wird linear über die Zelle gemittelt;
  // wie schnell der Abstand r zur Scheibenmitte über die Zelle wächst, sagt die Jacobi-Matrix.
  _coverage(x, y, lensX, bx, by, r) {
    let jxx = 1, jyy = 1, jxy = 0;
    for (const b of this.lens.bodies) {
      const dx = x - lensX - b.offset;
      const d2 = dx * dx + y * y + TINY;
      const a = b.mass * (y * y - dx * dx) / (d2 * d2);
      jxx -= a;
      jyy += a;
      jxy += 2 * b.mass * dx * y / (d2 * d2);
    }
    const ux = bx / (r + TINY), uy = by / (r + TINY);
    const slope = Math.hypot(jxx * ux + jxy * uy, jxy * ux + jyy * uy) * this.cell;
    const c = (this.rho - r) / (slope + TINY) + 0.5;
    return c <= 0 ? 0 : c >= 1 ? 1 : c;
  }
}

ML.ImageBrightness = ImageBrightness;
})(globalThis.Microlensing = globalThis.Microlensing || {});

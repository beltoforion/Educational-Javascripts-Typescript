// Das Bild des Hintergrundsterns, wie es die Linse verzerrt.
//
// Für jeden Bildpunkt wird gefragt, von welcher Stelle der Quellebene sein Lichtstrahl stammt. Liegt sie auf
// dem Stern, leuchtet der Bildpunkt mit dessen Helligkeit, denn eine Gravitationslinse lässt die
// Flächenhelligkeit unverändert. So entstehen Bögen, Mehrfachbilder und der Einsteinring von selbst.
(function (ML) {
'use strict';

const TINY = 1e-12;
const LUT_SIZE = 512;
const GLOW_REACH = 3.2;   // der Lichthof reicht bis zu diesem Vielfachen des Sternradius

// Farbe und Deckkraft des Sterns über dem Abstand von seiner Mitte, als fertige 32-Bit-Bildpunkte
function buildProfile() {
  const lut = new Uint32Array(LUT_SIZE + 1);
  const bytes = new Uint8ClampedArray(lut.buffer);
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = (i + 0.5) / LUT_SIZE * GLOW_REACH;
    let r, g, b, a;
    if (t < 1) {
      const limb = Math.sqrt(1 - t * t);              // zum Rand hin dunkler, wie im Bild der Sonne
      r = 240 + 15 * limb; g = 200 + 55 * limb; b = 70 + 80 * limb; a = 1;
    } else {
      r = 255; g = 206; b = 72;
      a = 0.55 * Math.exp(-(t - 1) * 2.4) * (1 - (t - 1) / (GLOW_REACH - 1));
    }
    bytes[4 * i] = r; bytes[4 * i + 1] = g; bytes[4 * i + 2] = b; bytes[4 * i + 3] = 255 * a;
  }
  return lut;
}

class SkyRaster {
  constructor(layout, sourceRadius) {
    this.layout = layout;
    this.rho = sourceRadius;
    this.profile = buildProfile();
    this.canvas = document.createElement('canvas');
    this.scale = 0;
  }

  // scale = Bildpunkte je logischem Pixel
  resize(scale) {
    if (scale === this.scale) return;
    const band = this.layout.band;
    this.scale = scale;
    this.canvas.width = Math.round(band.width * scale);
    this.canvas.height = 2 * Math.round(band.height * scale / 2);
    this.ctx = this.canvas.getContext('2d');
    this.image = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    this.pixels = new Uint32Array(this.image.data.buffer);
  }

  // Hintergrundstern im Ursprung, Linsenstern bei lensX
  render(lens, lensX) {
    const w = this.canvas.width, h = this.canvas.height, half = h / 2;
    const bodies = lens.bodies, n = bodies.length;
    const perAngle = this.layout.skyScale * this.scale;      // Bildpunkte je Einsteinradius
    const originX = (this.layout.cx - this.layout.band.x) * this.scale;
    const reach = GLOW_REACH * this.rho, reach2 = reach * reach;
    const toIndex = LUT_SIZE / reach;
    const pixels = this.pixels, profile = this.profile;
    pixels.fill(0);

    // Alle Massen liegen auf der Achse: Die untere Bildhälfte ist das Spiegelbild der oberen.
    for (let j = 0; j < half; j++) {
      const y = (j + 0.5 - half) / perAngle, y2 = y * y;
      const rowTop = j * w, rowBottom = (h - 1 - j) * w;
      for (let i = 0; i < w; i++) {
        const x = (i + 0.5 - originX) / perAngle;
        let bx = x, by = y;
        for (let k = 0; k < n; k++) {
          const dx = x - lensX - bodies[k].offset;
          const f = bodies[k].mass / (dx * dx + y2 + TINY);
          bx -= f * dx;
          by -= f * y;
        }
        const r2 = bx * bx + by * by;
        if (r2 >= reach2) continue;
        const color = profile[(Math.sqrt(r2) * toIndex) | 0];
        pixels[rowTop + i] = color;
        pixels[rowBottom + i] = color;
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
  }

  draw(ctx) {
    const band = this.layout.band;
    ctx.drawImage(this.canvas, band.x, band.y, band.width, band.height);
  }
}

ML.SkyRaster = SkyRaster;
})(globalThis.Microlensing = globalThis.Microlensing || {});

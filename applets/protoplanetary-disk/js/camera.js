// Die Kamera blickt aus Richtung dir auf den Stern. up legt fest, was im Bild oben ist. Beides ist frei drehbar,
// damit die Kamera um jede beliebige Scheibenachse mitlaufen kann. Kennt weder WebGL noch die Seite.
(function (Disk) {
'use strict';

class Camera {
  constructor() {
    this.dir = [Math.cos(0.42) * Math.sin(0.6), Math.sin(0.42), Math.cos(0.42) * Math.cos(0.6)];
    this.up = [0, 1, 0];
    this.dist = 5.6;
    this.auto = true;                            // Abstand folgt der Größe der Scheibe, bis jemand selbst zoomt
    this.goal = null;                            // Blickrichtung, zu der die Kamera gerade fährt
    this.view = null;                            // Kamerabasis des zuletzt berechneten Bildes
    this.viewProjection = new Float32Array(16);
    this.fixUp();
  }

  // up wieder senkrecht zur Blickrichtung stellen
  fixUp() {
    const { dot, cross, norm } = Disk.vec, d = dot(this.up, this.dir);
    let u = [this.up[0] - d * this.dir[0], this.up[1] - d * this.dir[1], this.up[2] - d * this.dir[2]];
    if (Math.hypot(u[0], u[1], u[2]) < 1e-6) u = cross(this.dir, Math.abs(this.dir[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]);
    this.up = norm(u);
  }

  // Dreht die Kamera um eine Achse durch den Stern
  turn(axis, angle) {
    const { norm, rot } = Disk.vec;
    this.dir = norm(rot(this.dir, axis, angle)); this.up = rot(this.up, axis, angle); this.fixUp();
  }

  // Ziehen mit Maus oder Finger um dx, dy Bildpunkte. Bricht eine laufende Kamerafahrt ab.
  drag(dx, dy) {
    if (!this.view) return;
    const { cross, norm } = Disk.vec;
    this.goal = null;
    this.turn(this.view.u, -dx * 0.006);
    this.turn(norm(cross(this.dir.map(v => -v), this.up)), -dy * 0.006);
  }

  zoom(factor) { this.dist = Math.max(0.4, Math.min(30, this.dist * factor)); this.auto = false; }

  // Blick aus der gegebenen Richtung, als Fahrt oder sofort
  lookFrom(direction, animate) {
    if (animate) this.goal = direction.slice();
    else { this.dir = direction.slice(); this.fixUp(); this.goal = null; }
  }

  // Führt eine laufende Kamerafahrt um ms Millisekunden weiter. Liefert true, solange sie läuft.
  travel(ms) {
    if (!this.goal) return false;
    const { dot, norm } = Disk.vec;
    const k = Math.min(1, ms * 0.007), g = this.goal, c = dot(this.dir, g);
    if (c > 0.9999999) { this.dir = g.slice(); this.goal = null; }
    else {
      const to = c < -0.99 ? this.up : g;   // genau gegenüber: erst seitlich ausweichen
      this.dir = norm([this.dir[0] + (to[0] - this.dir[0]) * k, this.dir[1] + (to[1] - this.dir[1]) * k, this.dir[2] + (to[2] - this.dir[2]) * k]);
    }
    this.fixUp();
    return true;
  }

  // Passt den Abstand an die Scheibe an, deren äußere Körper bei r90 liegen
  frameDisc(r90, ms) {
    if (!this.auto) return;
    const target = Math.max(2.2, Math.min(6.2, r90 * 3.3 + 0.9));
    this.dist += (target - this.dist) * Math.min(1, ms * 0.0006);
  }

  // Berechnet Kamerabasis und Projektionsmatrix für ein Bild mit dem gegebenen Seitenverhältnis
  updateView(aspect) {
    const { dot, cross, norm } = Disk.vec;
    const eye = this.dir.map(v => v * this.dist);
    const f = this.dir.map(v => -v);                 // Blickrichtung
    const r = norm(cross(f, this.up));               // im Bild nach rechts
    const u = cross(r, f);                           // im Bild nach oben
    const tf = Math.tan(Disk.constants.FOV / 2), near = 0.05, far = 200;
    const px = 1 / (tf * aspect), py = 1 / tf, pa = (far + near) / (near - far), pb = 2 * far * near / (near - far);
    const tx = -dot(r, eye), ty = -dot(u, eye), tz = dot(f, eye);
    // VP = P · V, spaltenweise
    this.viewProjection.set([px * r[0], py * u[0], -pa * f[0], f[0],
                             px * r[1], py * u[1], -pa * f[1], f[1],
                             px * r[2], py * u[2], -pa * f[2], f[2],
                             px * tx,   py * ty,   pa * tz + pb, -tz]);
    this.view = { eye, f, r, u, tf, aspect };
    return this.view;
  }

  // Punkt im Raum → Bildpunkt in einem Bild der Größe width × height, null wenn hinter der Kamera
  project(p, width, height) {
    const VP = this.viewProjection;
    const w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
    if (w < 0.05) return null;
    const x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13];
    return [(x / w * 0.5 + 0.5) * width, (0.5 - y / w * 0.5) * height];
  }

  // Bildpunkte je Längeneinheit am Ort p, in einem Bild der Höhe height
  pixelsPerUnit(p, height) {
    const v = this.view, depth = (p[0] - v.eye[0]) * v.f[0] + (p[1] - v.eye[1]) * v.f[1] + (p[2] - v.eye[2]) * v.f[2];
    return height / (2 * v.tf) / Math.max(depth, 0.05);
  }

  // Blickt die Kamera höchstens 40° neben der Achse auf die Ebene?
  isAbove(axis) { return Math.abs(Disk.vec.dot(this.dir, axis)) > 0.77; }

  // Wo trifft der Sehstrahl durch einen Bildpunkt die Ebene senkrecht zu axis durch den Stern?
  // nx, ny: Bildpunkt von -1 bis 1, y nach oben. Liefert den Abstand vom Stern oder null.
  planeRadius(nx, ny, axis) {
    const view = this.view, { dot } = Disk.vec;
    if (!view) return null;
    const ray = [0, 1, 2].map(i => view.f[i] + nx * view.tf * view.aspect * view.r[i] + ny * view.tf * view.u[i]);
    const slope = dot(ray, axis);
    if (Math.abs(slope) < 1e-6) return null;
    const t = -dot(view.eye, axis) / slope;
    if (t <= 0) return null;
    return Math.hypot(view.eye[0] + t * ray[0], view.eye[1] + t * ray[1], view.eye[2] + t * ray[2]);
  }
}

Disk.Camera = Camera;
})(globalThis.Disk = globalThis.Disk || {});

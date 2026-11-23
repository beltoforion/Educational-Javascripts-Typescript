// Zeichnet die Teilchen, den Stern, Achse und Ebene sowie die Bahnspuren. Liest den Zustand der Simulation nur.
// Gezeichnet wird in eine Gleitkomma-Textur, damit sich Helligkeiten aufsummieren können; ein letzter Durchgang
// staucht die Helligkeit und legt den Sternhintergrund darunter.
(function (Disk) {
'use strict';

const RING = 128;   // Stützpunkte des Rings in der Scheibenebene
const PARTICLE_SIZE = 0.034;   // Größe eines Teilchens im Bild bei 4 096 Teilchen, in Längeneinheiten

class Renderer {
  // gl: WebGL2-Kontext. canvas: seine Zeichenfläche (für die Bildgröße).
  constructor(gl, canvas) {
    const { createProgram } = Disk.glUtils, S = Disk.shaders;
    this.gl = gl;
    this.canvas = canvas;
    this.particles = createProgram(gl, S.particleVertex, S.particleFragment);
    this.star = createProgram(gl, S.starVertex, S.starFragment);
    this.lines = createProgram(gl, S.lineVertex, S.flat);
    this.fade = createProgram(gl, S.triangle, S.flat);
    this.tone = createProgram(gl, S.triangle, S.tone);

    this.emptyVao = gl.createVertexArray();
    this.lineVao = gl.createVertexArray();
    this.lineBuffer = gl.createBuffer();
    this.lineData = new Float32Array((2 + RING) * 3);   // zwei Punkte für die Achse, dann der Ring
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.lineData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.hdr = null;      // Zwischenbild mit Bahnspuren
    this.dirty = true;    // Bahnspuren beim nächsten Bild verwerfen
  }

  get aspect() { return this.canvas.width / this.canvas.height; }

  // Halbe Größe, mit der ein Körper der Masse mass (in Teilchenmassen) gezeichnet wird, in Bildpunkten.
  // pixelsPerUnit: Abbildungsmaßstab am Ort des Körpers. count0: Teilchenzahl beim Start.
  spriteRadius(mass, pixelsPerUnit, count0) {
    return 0.5 * Math.max(4, Math.min(72, PARTICLE_SIZE * Math.pow(4096 / count0, 0.25) * Math.sqrt(Math.cbrt(mass)) * pixelsPerUnit));
  }

  // Verwirft die Bahnspuren, etwa wenn sich die Kamera von Hand bewegt hat
  invalidate() { this.dirty = true; }

  // Passt die Zeichenfläche und das Zwischenbild an die Größe im Fenster an
  resize() {
    const gl = this.gl, canvas = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (this.hdr && canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    if (this.hdr) { gl.deleteTexture(this.hdr.tex); gl.deleteFramebuffer(this.hdr.fbo); }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    this.hdr = { tex, fbo }; this.dirty = true;
  }

  // Legt die Linien für die Drehimpulsachse und den Ring in der Scheibenebene neu
  setAxis(axis, plane) {
    const gl = this.gl, [a, b, c] = axis, { e1, e2 } = plane, data = this.lineData;
    data.set([-1.35 * a, -1.35 * b, -1.35 * c, 1.35 * a, 1.35 * b, 1.35 * c], 0);
    for (let i = 0; i < RING; i++) {
      const t = i / RING * 2 * Math.PI, cs = Math.cos(t), sn = Math.sin(t);
      data.set([e1[0] * cs + e2[0] * sn, e1[1] * cs + e2[1] * sn, e1[2] * cs + e2[2] * sn], 6 + i * 3);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  }

  // Zeichnet ein Bild. sim: die Simulation (nur gelesen). camera: Kamera mit aktueller Basis und Matrix.
  // params: mode, trails, axis. axis: Richtung der Scheibenachse.
  draw(sim, camera, params, axis) {
    const gl = this.gl, { bindTexture } = Disk.glUtils, FADE = Disk.constants.FADE;
    const w = this.canvas.width, h = this.canvas.height;
    const VP = camera.viewProjection, { f, r, u, tf, aspect } = camera.view;
    const pxScale = h / (2 * tf);
    const trail = params.trails;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdr.fbo);
    gl.viewport(0, 0, w, h);
    gl.enable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);
    if (trail && !this.dirty) {   // Bahnspuren: das alte Bild nur abdunkeln statt löschen
      gl.blendColor(0, 0, 0, FADE); gl.blendFunc(gl.ZERO, gl.CONSTANT_ALPHA);
      gl.useProgram(this.fade.p); gl.uniform4f(this.fade.u.uColor, 0, 0, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.dirty = false;
    gl.blendFunc(gl.ONE, gl.ONE);
    const still = trail ? 1 - FADE : 1;   // Ruhendes summiert sich mit Spuren auf 1/(1-FADE)

    if (params.axis) {
      gl.useProgram(this.lines.p);
      gl.uniformMatrix4fv(this.lines.u.uVP, false, VP);
      gl.bindVertexArray(this.lineVao);
      gl.uniform4f(this.lines.u.uColor, 0.20 * still, 0.25 * still, 0.36 * still, 1);
      gl.drawArrays(gl.LINES, 0, 2);
      gl.uniform4f(this.lines.u.uColor, 0.10 * still, 0.13 * still, 0.20 * still, 1);
      gl.drawArrays(gl.LINE_LOOP, 2, RING);
      gl.bindVertexArray(this.emptyVao);
    }

    const pu = this.particles.u, scale = 4096 / sim.count0;
    gl.useProgram(this.particles.p);
    bindTexture(gl, 0, sim.positionTexture); bindTexture(gl, 1, sim.velocityTexture);
    gl.uniform1i(pu.uPos, 0); gl.uniform1i(pu.uVel, 1); gl.uniform1i(pu.uTS, sim.size); gl.uniform1i(pu.uMode, params.mode);
    gl.uniformMatrix4fv(pu.uVP, false, VP);
    gl.uniform3f(pu.uL, axis[0], axis[1], axis[2]);
    gl.uniform1f(pu.uGMc, sim.starMass);
    gl.uniform1f(pu.uSize, PARTICLE_SIZE * Math.pow(scale, 0.25) * pxScale);
    gl.uniform1f(pu.uGain, 1.5 * Math.pow(scale, 0.35) * (trail ? 0.2 : 1));
    gl.drawArrays(gl.POINTS, 0, sim.slots);

    gl.useProgram(this.star.p);
    gl.uniformMatrix4fv(this.star.u.uVP, false, VP);
    gl.uniform1f(this.star.u.uSize, 0.55 * Math.cbrt(sim.starMass) * pxScale);
    gl.uniform1f(this.star.u.uGain, 5 * still);
    gl.drawArrays(gl.POINTS, 0, 1);

    // Belichtung, Sternhintergrund und Ausgabe auf den Bildschirm
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    const tu = this.tone.u;
    gl.useProgram(this.tone.p);
    bindTexture(gl, 0, this.hdr.tex);
    gl.uniform1i(tu.uHdr, 0); gl.uniform2f(tu.uRes, w, h);
    gl.uniform3f(tu.uR, r[0] * tf * aspect, r[1] * tf * aspect, r[2] * tf * aspect);
    gl.uniform3f(tu.uU, u[0] * tf, u[1] * tf, u[2] * tf);
    gl.uniform3f(tu.uF, f[0], f[1], f[2]);
    gl.uniform1f(tu.uExposure, 2.2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

Disk.Renderer = Renderer;
})(globalThis.Disk = globalThis.Disk || {});

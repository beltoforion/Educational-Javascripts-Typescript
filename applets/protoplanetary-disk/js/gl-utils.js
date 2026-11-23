// Kleine WebGL-Hilfen: Programme übersetzen, Gleitkomma-Texturen anlegen, Framebuffer verwalten
(function (Disk) {
'use strict';

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) + '\n' + source);
  return shader;
}

// Liefert { p: Programm, u: Tabelle der Uniform-Orte nach Namen }
function createProgram(gl, vertexSource, fragmentSource) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

let textureCount = 0;
// Quadratische RGBA32F-Textur ohne Filterung. Jede bekommt eine Nummer, an der TargetCache sie erkennt.
function floatTexture(gl, size, data) {
  const t = gl.createTexture();
  t.id = ++textureCount;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function bindTexture(gl, unit, texture) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture); }

// Framebuffer, die in eine bestimmte Kombination von Texturen schreiben. Jede Kombination wird einmal angelegt.
class TargetCache {
  constructor(gl) { this.gl = gl; this.map = new Map(); }

  // Bindet den Framebuffer, der in die genannten Texturen schreibt
  bind(...textures) {
    const gl = this.gl, key = textures.map(t => t.id).join('-');
    let f = this.map.get(key);
    if (f) { gl.bindFramebuffer(gl.FRAMEBUFFER, f); return f; }
    f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    textures.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer unvollständig');
    this.map.set(key, f);
    return f;
  }

  dispose() {
    for (const f of this.map.values()) this.gl.deleteFramebuffer(f);
    this.map.clear();
  }
}

Disk.glUtils = { createProgram, floatTexture, bindTexture, TargetCache };
})(globalThis.Disk = globalThis.Disk || {});

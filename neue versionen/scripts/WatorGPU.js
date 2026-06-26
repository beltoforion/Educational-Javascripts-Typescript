// WatorGPU — embeddable WebGL port of the World of Wator simulation.
// Mirrors the MagPendGPU embedding pattern: pass { cvid, width, height } and
// the constructor injects its own gl + overlay canvases into the parent.

"use strict";

var WatorGPU = (function () {

  // -----------------------------------------------------------------------
  // Constants matching the C++ implementation
  // -----------------------------------------------------------------------
  const TP_PRED  = 0;
  const TP_PREY  = 1;
  const TP_COUNT = 2;
  const TP_SEA   = 99;

  const SIZE_LABEL    = 120;
  const CHART_H       = 150;
  const CHART_ALPHA   = 210 / 255;
  const CIRC_BUF_SIZE = 400;

  // Phase-space plot (top-right overlay): prey on X, predators on Y.
  const PHASE_SIZE    = 220;
  const PHASE_MARGIN  = 16;
  const PHASE_PAD     = 6;   // inner padding inside the box for tick text breathing room

  const COLOR_PREY = [80, 212, 80];
  const COLOR_PRED = [100, 100, 252];

  function rnumRange(min, max) {
    return Math.floor(min + (max - min + 1) * Math.random());
  }
  function rnum(max) {
    return Math.floor((max + 1) * Math.random());
  }

  class Fish {
    constructor(x, y, energy, age, maxage) {
      this.x = x;
      this.y = y;
      this.energy = energy;
      this.age = age;
      this.maxage = maxage;
      this.next = null;
      this.pred = null;
    }
  }

  class StatBuffer {
    constructor(size) {
      this.cap = size;
      this.data = new Array(size).fill(0);
      this.head = 0;
      this.count = 0;
    }
    push(val) {
      this.data[this.head] = val;
      this.head = (this.head + 1) % this.cap;
      if (this.count < this.cap) this.count++;
    }
    size() { return this.count; }
    get(i) {
      const start = this.count < this.cap ? 0 : this.head;
      return this.data[(start + i) % this.cap];
    }
    min() {
      let m = this.data[0];
      for (let i = 1; i < this.count; ++i)
        if (this.data[i] < m) m = this.data[i];
      return m;
    }
    max() {
      let m = this.data[0];
      for (let i = 1; i < this.count; ++i)
        if (this.data[i] > m) m = this.data[i];
      return m;
    }
  }

  function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('Shader compile error: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }
  function makeProgram(gl, vsSrc, fsSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  const VS_SRC = `
    attribute vec2 aPos;
    attribute vec2 aUV;
    uniform vec2 uResolution;
    varying vec2 vUV;
    void main() {
      vec2 cs = (aPos / uResolution) * 2.0 - 1.0;
      gl_Position = vec4(cs.x, -cs.y, 0.0, 1.0);
      vUV = aUV;
    }
  `;

  const FS_TEX_SRC = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    uniform vec4 uColor;
    void main() {
      vec4 t = texture2D(uTex, vUV);
      gl_FragColor = vec4(t.rgb * uColor.rgb, uColor.a);
    }
  `;

  const FS_COLOR_SRC = `
    precision mediump float;
    uniform vec4 uColor;
    void main() {
      gl_FragColor = uColor;
    }
  `;

  // Grid shader: discard near-black pixels so that sea cells become transparent
  // and the water-background drawn beneath shows through.
  const FS_GRID_SRC = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    void main() {
      vec4 t = texture2D(uTex, vUV);
      if (t.r < 0.04 && t.g < 0.04 && t.b < 0.04) discard;
      gl_FragColor = vec4(t.rgb, 1.0);
    }
  `;

  class WatorGPU {
    constructor(cfg) {
      this.cvid       = cfg.cvid;
      this.width      = cfg.width  || 1200;
      this.height     = cfg.height || 600;
      this.texPath    = cfg.texPath || './scripts/assets/';

      // Configurable parameters
      this.pixSize       = cfg.pixSize       || 5;
      this.breedTime     = cfg.breedTime     || 10;
      this.energyPerPrey = cfg.energyPerPrey || 40;
      this.energyMin     = cfg.energyMin     || 120;
      this.chartSkip     = cfg.chartSkip     || 2;
      this.showStat      = cfg.showStat  !== undefined ? cfg.showStat  : true;
      this.showFps       = cfg.showFps   !== undefined ? cfg.showFps   : false;
      this.showParam     = cfg.showParam !== undefined ? cfg.showParam : false;
      this.showPhase     = cfg.showPhase !== undefined ? cfg.showPhase : true;
      this.labels        = Object.assign({
        phaseTitle:  'Phasenraum',
        sharks:      'Haie',
        fish:        'Fische',
        meanSharks:  'Ø Haie',
        meanFish:    'Ø Fische'
      }, cfg.labels || {});
      this.tickIntervalMs = 10;

      this._setupDom();

      const gl = this.glCanvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
      if (!gl) throw new Error('WebGL not supported');
      this.gl = gl;
      this.octx = this.overlayCanvas.getContext('2d');

      this.progTex   = makeProgram(gl, VS_SRC, FS_TEX_SRC);
      this.progColor = makeProgram(gl, VS_SRC, FS_COLOR_SRC);
      this.progGrid  = makeProgram(gl, VS_SRC, FS_GRID_SRC);

      this.locTex = {
        aPos:        gl.getAttribLocation (this.progTex, 'aPos'),
        aUV:         gl.getAttribLocation (this.progTex, 'aUV'),
        uResolution: gl.getUniformLocation(this.progTex, 'uResolution'),
        uTex:        gl.getUniformLocation(this.progTex, 'uTex'),
        uColor:      gl.getUniformLocation(this.progTex, 'uColor')
      };
      this.locColor = {
        aPos:        gl.getAttribLocation (this.progColor, 'aPos'),
        aUV:         gl.getAttribLocation (this.progColor, 'aUV'),
        uResolution: gl.getUniformLocation(this.progColor, 'uResolution'),
        uColor:      gl.getUniformLocation(this.progColor, 'uColor')
      };
      this.locGrid = {
        aPos:        gl.getAttribLocation (this.progGrid, 'aPos'),
        aUV:         gl.getAttribLocation (this.progGrid, 'aUV'),
        uResolution: gl.getUniformLocation(this.progGrid, 'uResolution'),
        uTex:        gl.getUniformLocation(this.progGrid, 'uTex')
      };

      this.posBuf = gl.createBuffer();
      this.uvBuf  = gl.createBuffer();

      // Fixed simulation viewport in pixels (CSS scales the canvas to its container)
      this.simWidth  = this.width;
      this.simHeight = this.height;
      gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);

      // Simulation state
      this.dimX = 0;
      this.dimY = 0;
      this.field = null;
      this.frameBuf = null;
      this.gridTex = gl.createTexture();
      this._initTexture(this.gridTex);

      this.tickCount = 0;
      this.frames = 0;
      this.fps = 0;
      this.lastFpsTime = performance.now();

      this.pRoot = [null, null];
      this.iNum  = [0, 0];
      this.circBuf = [new StatBuffer(CIRC_BUF_SIZE), new StatBuffer(CIRC_BUF_SIZE)];
      this.circBufScale = 1;

      this.tex = {};
      this._loadTexture('pred',  this.texPath + 'sharks_l.jpg');
      this._loadTexture('prey',  this.texPath + 'fish_l.jpg');
      this._loadTexture('water', this.texPath + 'water.jpg', true);

      this._running = false;
      this._lastTick = 0;

      this.initScene();
      this.start();

      // Auto-pause when the applet container scrolls out of the viewport.
      var self = this;
      observeAppletVisibility(document.getElementById(this.cvid),
        function () { self.start(); },
        function () { self.stop();  });
    }

    _setupDom() {
      const parent = document.getElementById(this.cvid);
      parent.style.position = 'relative';
      parent.style.display  = 'block';
      parent.style.width    = '100%';
      parent.style.height   = '100%';
      parent.style.background = '#000';

      this.glCanvas = document.createElement('canvas');
      this.glCanvas.width  = this.width;
      this.glCanvas.height = this.height;
      this.glCanvas.style.position = 'absolute';
      this.glCanvas.style.inset    = '0';
      this.glCanvas.style.width    = '100%';
      this.glCanvas.style.height   = '100%';
      this.glCanvas.style.display  = 'block';
      parent.appendChild(this.glCanvas);

      this.overlayCanvas = document.createElement('canvas');
      this.overlayCanvas.width  = this.width;
      this.overlayCanvas.height = this.height;
      this.overlayCanvas.style.position = 'absolute';
      this.overlayCanvas.style.inset    = '0';
      this.overlayCanvas.style.width    = '100%';
      this.overlayCanvas.style.height   = '100%';
      this.overlayCanvas.style.display  = 'block';
      this.overlayCanvas.style.pointerEvents = 'none';
      parent.appendChild(this.overlayCanvas);
    }

    _initTexture(tex, repeat) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    }

    _loadTexture(name, src, repeat) {
      const gl = this.gl;
      const tex = gl.createTexture();
      this._initTexture(tex, false);
      this.tex[name] = { tex, ready: false, repeat: !!repeat, w: 0, h: 0 };

      const img = new Image();
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

        const isPow2 = (n) => (n & (n - 1)) === 0;
        if (repeat && isPow2(img.width) && isPow2(img.height)) {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.generateMipmap(gl.TEXTURE_2D);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        this.tex[name].ready = true;
        this.tex[name].w = img.width;
        this.tex[name].h = img.height;
      };
      img.onerror = () => {
        console.warn('Failed to load texture: ' + src);
      };
      img.src = src;
    }

    initScene() {
      this._initField();
      const numPred = Math.floor((this.dimX * this.dimY) / 5);
      const numPrey = Math.floor((this.dimX * this.dimY) / 5);
      this._initPopulation(numPred, numPrey);

      this.circBuf[0] = new StatBuffer(CIRC_BUF_SIZE);
      this.circBuf[1] = new StatBuffer(CIRC_BUF_SIZE);
      this.circBufScale = (this.simWidth - 2 * SIZE_LABEL) / CIRC_BUF_SIZE;
    }

    _initField() {
      this.dimX = Math.max(1, Math.floor(this.simWidth  / this.pixSize));
      this.dimY = Math.max(1, Math.floor(this.simHeight / this.pixSize));

      this.field = new Uint8Array(this.dimX * this.dimY);
      this.field.fill(TP_SEA);
      this.frameBuf = new Uint8Array(this.dimX * this.dimY * 3);

      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.gridTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB,
                    this.dimX, this.dimY, 0,
                    gl.RGB, gl.UNSIGNED_BYTE, this.frameBuf);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    }

    _setFish(x, y, state) {
      const idx = y * this.dimX + x;
      this.field[idx] = state;

      const off = idx * 3;
      if (state === TP_PREY) {
        this.frameBuf[off]     = COLOR_PREY[0];
        this.frameBuf[off + 1] = COLOR_PREY[1];
        this.frameBuf[off + 2] = COLOR_PREY[2];
      } else {
        this.frameBuf[off]     = COLOR_PRED[0];
        this.frameBuf[off + 1] = COLOR_PRED[1];
        this.frameBuf[off + 2] = COLOR_PRED[2];
      }
    }

    _newFish(kind, x, y, energy, maxage) {
      const f = new Fish(x, y, energy, 0, maxage);
      this.iNum[kind]++;
      this._setFish(x, y, kind);
      return f;
    }

    _initPopulation(numPred, numPrey) {
      if (numPred === 0 || numPrey === 0) return;

      let pFish1 = null;
      let pFish2 = null;

      this.pRoot[TP_PREY] = pFish2 = this._newFish(TP_PREY, 0, 0, 0, rnumRange(1, this.breedTime));
      this.pRoot[TP_PREY].pred = null;

      for (let a = 0; a < numPrey; ++a) {
        let x, y;
        do {
          x = rnumRange(0, this.dimX - 1);
          y = rnumRange(0, this.dimY - 1);
        } while (this.field[y * this.dimX + x] !== TP_SEA);

        pFish1 = this._newFish(TP_PREY, x, y, 0, rnumRange(1, this.breedTime));
        pFish1.age = rnum(200);
        pFish1.maxage = pFish1.age + rnumRange(1, 300);
        pFish1.pred = pFish2;
        pFish2.next = pFish1;
        pFish2 = pFish1;
      }
      if (pFish1) pFish1.next = null;

      this.pRoot[TP_PRED] = pFish2 = this._newFish(TP_PRED, 0, 0, rnumRange(100, 400), 0);
      this.pRoot[TP_PRED].pred = null;

      for (let a = 0; a < numPred; ++a) {
        let x, y;
        do {
          x = rnumRange(0, this.dimX - 1);
          y = rnumRange(0, this.dimY - 1);
        } while (this.field[y * this.dimX + x] !== TP_SEA);

        pFish1 = this._newFish(TP_PRED, x, y, rnum(400), 0);
        pFish1.age = rnum(200);
        pFish1.maxage = pFish1.age + rnum(200);
        pFish1.pred = pFish2;
        pFish2.next = pFish1;
        pFish2 = pFish1;
      }
      if (pFish1) pFish1.next = null;
    }

    tick() {
      this.tickCount++;
      this._move();

      if (this.tickCount % this.chartSkip === 0) {
        for (let i = 0; i < TP_COUNT; ++i) {
          this.circBuf[i].push(this.iNum[i]);
        }
      }
    }

    _move() {
      const fb = this.frameBuf;
      fb.fill(0);

      const dimX = this.dimX, dimY = this.dimY;

      let pFish = this.pRoot[TP_PREY];
      while (pFish) {
        const cellIdx = pFish.y * dimX + pFish.x;

        if (this.iNum[TP_PREY] > 1 &&
            (this.field[cellIdx] === TP_PRED || this.field[cellIdx] === TP_SEA)) {
          const pNext = pFish.next;
          if (pFish === this.pRoot[TP_PREY]) {
            this.pRoot[TP_PREY] = pFish.next;
            if (this.pRoot[TP_PREY]) this.pRoot[TP_PREY].pred = null;
          } else {
            if (pFish.pred) pFish.pred.next = pFish.next;
            if (pFish.next) pFish.next.pred = pFish.pred;
          }
          this.iNum[TP_PREY]--;
          pFish = pNext;
          continue;
        }

        let nx = pFish.x + rnumRange(-1, 1);
        let ny = pFish.y + rnumRange(-1, 1);
        if (nx < 0)        nx = dimX - 1;
        if (nx >= dimX)    nx = 0;
        if (ny < 0)        ny = dimY - 1;
        if (ny >= dimY)    ny = 0;

        const newIdx = ny * dimX + nx;
        if (this.field[newIdx] === TP_SEA) {
          pFish.age++;
          if (pFish.age > pFish.maxage) {
            const child = this._newFish(TP_PREY, pFish.x, pFish.y, 0, this.breedTime);
            const root = this.pRoot[TP_PREY];
            if (root.next) root.next.pred = child;
            child.next = root.next;
            child.pred = root;
            root.next = child;
            pFish.age = 0;
          } else {
            this.field[cellIdx] = TP_SEA;
            const o = cellIdx * 3;
            fb[o] = 0; fb[o + 1] = 0; fb[o + 2] = 0;
          }
          pFish.x = nx;
          pFish.y = ny;
        }

        this._setFish(pFish.x, pFish.y, TP_PREY);
        pFish = pFish.next;
      }

      pFish = this.pRoot[TP_PRED];
      while (pFish) {
        const pNext = pFish.next;

        let nx = pFish.x + rnumRange(-1, 1);
        let ny = pFish.y + rnumRange(-1, 1);
        if (nx < 0)        nx = dimX - 1;
        if (nx >= dimX)    nx = 0;
        if (ny < 0)        ny = dimY - 1;
        if (ny >= dimY)    ny = 0;

        pFish.energy--;

        const oldIdx = pFish.y * dimX + pFish.x;
        const newIdx = ny * dimX + nx;
        if (this.field[newIdx] !== TP_PRED) {
          if (this.field[newIdx] === TP_PREY) {
            this.field[newIdx] = TP_SEA;
            pFish.energy += this.energyPerPrey;
          }

          if (pFish.energy > this.energyMin) {
            const child = this._newFish(TP_PRED, pFish.x, pFish.y, Math.floor(pFish.energy / 2), 0);
            const root = this.pRoot[TP_PRED];
            if (root.next) root.next.pred = child;
            child.next = root.next;
            child.pred = root;
            root.next = child;
            pFish.energy = Math.floor(pFish.energy / 2);
            pFish.age = 0;
          } else {
            this.field[oldIdx] = TP_SEA;
            const o = oldIdx * 3;
            fb[o] = 0; fb[o + 1] = 0; fb[o + 2] = 0;
          }

          pFish.x = nx;
          pFish.y = ny;
        }

        this._setFish(pFish.x, pFish.y, TP_PRED);

        if (pFish.energy <= 0 && this.iNum[TP_PRED] > 1) {
          const idx = pFish.y * dimX + pFish.x;
          this.field[idx] = TP_SEA;
          const o = idx * 3;
          fb[o] = 0; fb[o + 1] = 0; fb[o + 2] = 0;

          if (pFish === this.pRoot[TP_PRED]) {
            this.pRoot[TP_PRED] = pFish.next;
            if (this.pRoot[TP_PRED]) this.pRoot[TP_PRED].pred = null;
          } else {
            if (pFish.pred) pFish.pred.next = pFish.next;
            if (pFish.next) pFish.next.pred = pFish.pred;
          }
          this.iNum[TP_PRED]--;
        }

        pFish = pNext;
      }
    }

    _useProg(prog, locs) {
      const gl = this.gl;
      gl.useProgram(prog);
      gl.uniform2f(locs.uResolution, this.simWidth, this.simHeight);
    }

    _drawTexQuad(tex, x, y, w, h, color, u0, v0, u1, v1) {
      const gl = this.gl;
      const L = this.locTex;
      this._useProg(this.progTex, L);

      const positions = new Float32Array([
        x,     y,
        x + w, y,
        x + w, y + h,
        x,     y,
        x + w, y + h,
        x,     y + h,
      ]);
      const uvs = new Float32Array([
        u0, v0,  u1, v0,  u1, v1,
        u0, v0,  u1, v1,  u0, v1,
      ]);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(L.uTex, 0);
      gl.uniform4f(L.uColor, color[0], color[1], color[2], color[3]);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(L.aPos);
      gl.vertexAttribPointer(L.aPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(L.aUV);
      gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    _drawGridQuad(tex, x, y, w, h) {
      const gl = this.gl;
      const L = this.locGrid;
      this._useProg(this.progGrid, L);

      const positions = new Float32Array([
        x,     y,
        x + w, y,
        x + w, y + h,
        x,     y,
        x + w, y + h,
        x,     y + h,
      ]);
      const uvs = new Float32Array([
        0, 0,  1, 0,  1, 1,
        0, 0,  1, 1,  0, 1,
      ]);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(L.uTex, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(L.aPos);
      gl.vertexAttribPointer(L.aPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(L.aUV);
      gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    _drawColorRect(x, y, w, h, color) {
      const gl = this.gl;
      const L = this.locColor;
      this._useProg(this.progColor, L);

      const positions = new Float32Array([
        x,     y,
        x + w, y,
        x + w, y + h,
        x,     y,
        x + w, y + h,
        x,     y + h,
      ]);
      gl.uniform4f(L.uColor, color[0], color[1], color[2], color[3]);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(L.aPos);
      gl.vertexAttribPointer(L.aPos, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    _drawLineStrip(points, color) {
      const gl = this.gl;
      const L = this.locColor;
      this._useProg(this.progColor, L);

      const arr = new Float32Array(points);
      gl.uniform4f(L.uColor, color[0], color[1], color[2], color[3]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(L.aPos);
      gl.vertexAttribPointer(L.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINE_STRIP, 0, arr.length / 2);
    }

    draw() {
      this.frames++;
      const gl = this.gl;

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.gridTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0,
                       this.dimX, this.dimY,
                       gl.RGB, gl.UNSIGNED_BYTE, this.frameBuf);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);

      const water = this.tex.water;
      // Water as opaque background: tile via slowly drifting UVs.
      if (water && water.ready) {
        const f = (this.tickCount / 12000.0);
        this._drawTexQuad(water.tex,
                          0, 0, this.simWidth, this.simHeight,
                          [0.78, 0.78, 0.78, 1],
                          f, 0, f + 1, 1);
      }

      // Grid on top: sea cells are discarded → water shows through; fish stay opaque.
      this._drawGridQuad(this.gridTex, 0, 0, this.simWidth, this.simHeight);

      // Subtle moving red tint on top — keeps the "bloody water" effect of the original.
      if (water && water.ready) {
        gl.blendFunc(gl.SRC_ALPHA, gl.DST_COLOR);
        const f = (this.tickCount / 12000.0);
        this._drawTexQuad(water.tex,
                          0, 0, this.simWidth, this.simHeight,
                          [255 / 255, 15 / 255, 15 / 255, 80 / 255],
                          f, 0, f + 1, 1);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      if (this.showStat)  this._drawChart();
      if (this.showPhase) this._drawPhasePlot();

      this._drawOverlay();
    }

    _drawPhasePlot() {
      const x0 = this.simWidth  - PHASE_SIZE - PHASE_MARGIN;
      const y0 = PHASE_MARGIN;
      const x1 = x0 + PHASE_SIZE;
      const y1 = y0 + PHASE_SIZE;

      // Backing panel (same translucent slate as the time chart's plot area).
      this._drawColorRect(x0, y0, PHASE_SIZE, PHASE_SIZE,
                          [10 / 255, 10 / 255, 20 / 255, CHART_ALPHA]);

      const size = this.circBuf[0].size();
      if (size > 1) {
        // Mean over the buffer — this is the centerpoint of the phase view.
        let preySum = 0, predSum = 0;
        for (let i = 0; i < size; ++i) {
          preySum += this.circBuf[TP_PREY].get(i);
          predSum += this.circBuf[TP_PRED].get(i);
        }
        const preyMean = preySum / size;
        const predMean = predSum / size;

        // Symmetric half-window around the mean so the mean sits at the box center.
        // Independent per axis — prey and predator amplitudes differ.
        const preyMax = this.circBuf[TP_PREY].max();
        const preyMin = this.circBuf[TP_PREY].min();
        const predMax = this.circBuf[TP_PRED].max();
        const predMin = this.circBuf[TP_PRED].min();
        const preyHalf = Math.max(1, preyMax - preyMean, preyMean - preyMin);
        const predHalf = Math.max(1, predMax - predMean, predMean - predMin);

        const ax0 = x0 + PHASE_PAD;
        const ay0 = y0 + PHASE_PAD;
        const aw  = PHASE_SIZE - 2 * PHASE_PAD;
        const ah  = PHASE_SIZE - 2 * PHASE_PAD;

        const sx = (aw / 2) / preyHalf;
        const sy = (ah / 2) / predHalf;
        const cxPlot = ax0 + aw / 2;
        const cyPlot = ay0 + ah / 2;

        // Crosshair at the mean.
        const cross = [80 / 255, 80 / 255, 100 / 255, 1];
        this._drawLineStrip([ax0, cyPlot, ax0 + aw, cyPlot], cross);
        this._drawLineStrip([cxPlot, ay0, cxPlot, ay0 + ah], cross);

        // Trajectory (oldest → newest).
        const pts = [];
        for (let i = 0; i < size; ++i) {
          const px = cxPlot + (this.circBuf[TP_PREY].get(i) - preyMean) * sx;
          const py = cyPlot - (this.circBuf[TP_PRED].get(i) - predMean) * sy;
          pts.push(px, py);
        }
        this._drawLineStrip(pts, [220 / 255, 220 / 255, 90 / 255, 0.9]);

        // Highlight current state with a 5×5 marker.
        const cx = pts[pts.length - 2];
        const cy = pts[pts.length - 1];
        this._drawColorRect(cx - 2.5, cy - 2.5, 5, 5,
                            [1, 1, 1, 1]);

        this._phaseStats = {
          preyMean, predMean,
          preyHalf, predHalf,
          box: { x0, y0, x1, y1 }
        };
      } else {
        this._phaseStats = null;
      }

      // Outline.
      const outline = [35 / 255, 105 / 255, 135 / 255, 1];
      this._drawLineStrip([
        x0 + 0.5, y0 + 0.5,
        x1 - 0.5, y0 + 0.5,
        x1 - 0.5, y1 - 0.5,
        x0 + 0.5, y1 - 0.5,
        x0 + 0.5, y0 + 0.5,
      ], outline);
    }

    _drawChart() {
      const width  = this.simWidth - 1;
      const chartTop = this.simHeight - CHART_H;
      const chartBot = this.simHeight;

      const shark = this.tex.pred, fish = this.tex.prey;
      if (shark && shark.ready) {
        this._drawTexQuad(shark.tex, 0, chartTop, SIZE_LABEL, CHART_H,
                          [1, 1, 1, 180 / 255], 0, 0, 1, 1);
      } else {
        this._drawColorRect(0, chartTop, SIZE_LABEL, CHART_H,
                            [40 / 255, 40 / 255, 80 / 255, 180 / 255]);
      }
      if (fish && fish.ready) {
        this._drawTexQuad(fish.tex, width - SIZE_LABEL, chartTop, SIZE_LABEL, CHART_H,
                          [1, 1, 1, 180 / 255], 0, 0, 1, 1);
      } else {
        this._drawColorRect(width - SIZE_LABEL, chartTop, SIZE_LABEL, CHART_H,
                            [40 / 255, 80 / 255, 40 / 255, 180 / 255]);
      }

      this._drawColorRect(SIZE_LABEL, chartTop,
                          width - 2 * SIZE_LABEL, CHART_H,
                          [10 / 255, 10 / 255, 20 / 255, CHART_ALPHA]);

      const size = this.circBuf[0].size();
      if (size > 1) {
        const maxV = Math.max(this.circBuf[TP_PREY].max(), this.circBuf[TP_PRED].max());
        const minV = Math.min(this.circBuf[TP_PREY].min(), this.circBuf[TP_PRED].min());
        const range = Math.max(1, maxV - minV);
        const mult = CHART_H / range;

        const ppts = [];
        for (let x = 1; x < size; ++x) {
          const px = SIZE_LABEL + x * this.circBufScale;
          const py = chartBot - (this.circBuf[TP_PREY].get(x) - minV) * mult;
          ppts.push(px, py);
        }
        this._drawLineStrip(ppts, [80 / 255, 212 / 255, 80 / 255, 1]);

        const dpts = [];
        for (let x = 1; x < size; ++x) {
          const px = SIZE_LABEL + x * this.circBufScale;
          const py = chartBot - (this.circBuf[TP_PRED].get(x) - minV) * mult;
          dpts.push(px, py);
        }
        this._drawLineStrip(dpts, [100 / 255, 100 / 255, 252 / 255, 1]);
      }

      const outline = [35 / 255, 105 / 255, 135 / 255, 1];
      this._drawLineStrip([
        SIZE_LABEL + 0.5,         chartTop + 0.5,
        width - SIZE_LABEL + 0.5, chartTop + 0.5,
        width - SIZE_LABEL + 0.5, chartBot - 0.5,
        SIZE_LABEL + 0.5,         chartBot - 0.5,
        SIZE_LABEL + 0.5,         chartTop + 0.5,
      ], outline);
      this._drawLineStrip([
        0.5,                      chartTop + 0.5,
        SIZE_LABEL + 0.5,         chartTop + 0.5,
        SIZE_LABEL - 0.5,         chartBot - 0.5,
        0.5,                      chartBot - 0.5,
        0.5,                      chartTop + 0.5,
      ], outline);
      this._drawLineStrip([
        width - SIZE_LABEL + 0.5, chartTop + 0.5,
        width - 0.5,              chartTop + 0.5,
        width - 0.5,              chartBot - 0.5,
        width - SIZE_LABEL + 0.5, chartBot - 0.5,
        width - SIZE_LABEL + 0.5, chartTop + 0.5,
      ], outline);
    }

    _drawOverlay() {
      const ctx = this.octx;
      ctx.clearRect(0, 0, this.simWidth, this.simHeight);
      ctx.textBaseline = 'alphabetic';

      if (this.showStat) {
        ctx.font = '20px Verdana, Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        const y = this.simHeight - 12;
        ctx.fillText(String(this.iNum[TP_PRED]), SIZE_LABEL / 2,                y);
        ctx.fillText(String(this.iNum[TP_PREY]), this.simWidth - SIZE_LABEL / 2, y);
        ctx.textAlign = 'start';
      }

      if (this.showPhase && this._phaseStats) {
        const s = this._phaseStats;
        const b = s.box;
        const preyMean = Math.round(s.preyMean);
        const predMean = Math.round(s.predMean);
        ctx.font = '11px Verdana, Arial, sans-serif';

        const L = this.labels;
        // Title.
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(L.phaseTitle, (b.x0 + b.x1) / 2, b.y0 + 14);

        // Y-axis label (sharks) — top-left inside the box.
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgb(140, 140, 255)';
        ctx.fillText(L.sharks + ' ↑', b.x0 + 6, b.y0 + 28);

        // X-axis label (fish) — bottom-right inside the box.
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgb(120, 230, 120)';
        ctx.fillText(L.fish + ' →', b.x1 - 6, b.y1 - 6);

        // Mean values, bottom-left — each in its population's color.
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgb(140, 140, 255)';
        ctx.fillText(L.meanSharks + ' ' + predMean, b.x0 + 6, b.y1 - 20);
        ctx.fillStyle = 'rgb(120, 230, 120)';
        ctx.fillText(L.meanFish   + ' ' + preyMean, b.x0 + 6, b.y1 - 6);
      }

      if (this.showFps) {
        ctx.font = 'bold 20px Verdana, Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`FPS: ${this.fps.toFixed(2)}`, 20, 30);
      }

      if (this.showParam) {
        ctx.font = 'bold 16px Verdana, Arial, sans-serif';
        ctx.fillStyle = '#fff';
        const x = this.simWidth - 220;
        ctx.fillText(`Breed time: ${this.breedTime}`,          x, 30);
        ctx.fillText(`Energy per prey: ${this.energyPerPrey}`, x, 50);
        ctx.fillText(`Energymin: ${this.energyMin}`,           x, 70);
      }
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._lastTick = performance.now();
      this.lastFpsTime = performance.now();
      this.frames = 0;

      const loop = (now) => {
        if (!this._running) return;

        let elapsed = now - this._lastTick;
        let steps = 0;
        while (elapsed >= this.tickIntervalMs && steps < 5) {
          this.tick();
          this._lastTick += this.tickIntervalMs;
          elapsed = now - this._lastTick;
          steps++;
        }

        this.draw();

        const fpsDt = now - this.lastFpsTime;
        if (fpsDt >= 1000) {
          this.fps = (1000 * this.frames) / fpsDt;
          this.lastFpsTime = now;
          this.frames = 0;
        }

        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    stop() { this._running = false; }

    reset() {
      this.tickCount = 0;
      this.iNum = [0, 0];
      this.pRoot = [null, null];
      this.initScene();
    }
  }

  return WatorGPU;
})();

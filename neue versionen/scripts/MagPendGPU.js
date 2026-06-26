// MagPendGPU — WebGL 2 rewrite of the magnetic pendulum simulation.
// Each canvas pixel is one independent pendulum integrated in parallel on the GPU.
// State (pos+vel) and status (length, magnet idx, step count) live in two RGBA32F
// textures; we ping-pong each frame and advance N RK4 steps per pixel. A 2D overlay
// canvas keeps the live mouse trace, magnet sprites, and the text labels.

"use strict";

var MagPendGPU = (function () {

    // RGB triplets for stopped-magnet shading. Index 0 is the mount point (unused
    // for coloring), 1+ are the magnet colors — match ModelMagPend's palette.
    var COLORS = [
        [160, 160, 160],   // mount (pendulum suspension)
        [200,  30,  30],   // magnet 1
        [ 30, 200,  30],   // magnet 2
        [ 30,  30, 200]    // magnet 3
    ];

    function MagPendGPU(cfg) {
        this.cvid       = cfg.cvid;
        this.width      = cfg.width  || 1200;
        this.height     = cfg.height || 600;
        this.font       = cfg.font   || "24px Arial";

        // Match the original simulation parameters from ModelMagPend / the trace loop.
        // dt=2 matches IntegratorRK4's default h=2 — gives each pendulum a 60000 sim-sec
        // budget over maxSteps=30000, which is plenty for low-friction convergence.
        this.friction      = 0.001;
        this.dt            = 2.0;
        this.stepsPerFrame = 50;
        this.maxSteps      = 30000;
        this.pendHeight    = 15.0;
        this.abortVel2     = 2.0;

        // Aspect-correct world: vertical half-range matches the original ±1000
        // square world; horizontal half-range scales with canvas aspect so square
        // pixels stay square (no squeezed magnets).
        var aspect = this.width / this.height;
        if (aspect >= 1.0) {
            this.worldHalfW = 1000.0 * aspect;
            this.worldHalfH = 1000.0;
        } else {
            this.worldHalfW = 1000.0;
            this.worldHalfH = 1000.0 / aspect;
        }

        this._initSources();

        this._setupDom();
        this._setupGL();
        this.reset();
        var self = this;
        startAppletLoop(document.getElementById(this.cvid), function () { self._tick(); });
    }

    MagPendGPU.prototype.setFriction = function (friction) {
        this.friction = friction;
        this.reset();
    };

    // 1 linear restoring mount at origin, 3 inverse-cube magnets on a circle of
    // radius 300 — identical to ModelMagPend's constructor.
    MagPendGPU.prototype._initSources = function () {
        this.sources = [
            { x: 0, y: 0, k: 0.00001, r: 20, type: 0 }
        ];
        var rad = 300;
        for (var deg = 0; deg < 360; deg += 120) {
            var a = deg * Math.PI / 180.0;
            this.sources.push({
                x: rad * Math.sin(a),
                y: rad * Math.cos(a),
                k: 150,
                r: 30,
                type: 1
            });
        }
    };

    // Restore initial state: original magnet/mount positions and default friction.
    MagPendGPU.prototype.resetToInitialState = function () {
        this.friction = 0.001;
        this._initSources();
        this.reset();
    };

    MagPendGPU.prototype.reset = function () {
        this._initState();
        this.totalSteps = 0;
        // Reference length: trace from the corner of the ORIGINAL ±1000 sampled
        // area (not the extended aspect-correct world), so the shading distribution
        // matches the original MagPend.putPixel scheme.
        var ref = this._traceCPU(-1000, -1000);
        var len = 0;
        for (var i = 1; i < ref.points.length; i++) {
            var dx = ref.points[i][0] - ref.points[i-1][0];
            var dy = ref.points[i][1] - ref.points[i-1][1];
            len += Math.sqrt(dx*dx + dy*dy);
        }
        this.refLength = Math.max(len * 1.2, 1.0);
    };

    MagPendGPU.prototype._setupDom = function () {
        var parent = document.getElementById(this.cvid);
        parent.style.position = 'relative';
        parent.style.display  = 'block';
        parent.style.width    = '100%';
        parent.style.height   = '100%';

        this.glCanvas = document.createElement('canvas');
        this.glCanvas.width  = this.width;
        this.glCanvas.height = this.height;
        this.glCanvas.style.position = 'absolute';
        this.glCanvas.style.inset    = '0';
        this.glCanvas.style.width    = '100%';
        this.glCanvas.style.height   = '100%';
        this.glCanvas.style.display  = 'block';
        parent.appendChild(this.glCanvas);

        this.overlay = document.createElement('canvas');
        this.overlay.width  = this.width;
        this.overlay.height = this.height;
        this.overlay.style.position = 'absolute';
        this.overlay.style.inset    = '0';
        this.overlay.style.width    = '100%';
        this.overlay.style.height   = '100%';
        this.overlay.style.display  = 'block';
        parent.appendChild(this.overlay);
        this.ctx2d = this.overlay.getContext('2d');

        this.mouseX  = this.width  / 2;
        this.mouseY  = this.height / 2;
        this.hasMouse        = false;
        this.hoveredMagnet   = -1;
        this.draggingMagnet  = -1;
        var self = this;
        this.overlay.addEventListener('mousemove', function (e) {
            var r = self.overlay.getBoundingClientRect();
            self.mouseX = (e.clientX - r.left) * (self.width  / r.width);
            self.mouseY = (e.clientY - r.top)  * (self.height / r.height);
            self.hasMouse = true;
            if (self.draggingMagnet >= 0) {
                // Move the magnet under the cursor and re-init the simulation.
                // We skip refLength recomputation during drag (would be a CPU
                // trace per frame) — that runs once on mouseup via reset().
                var wx = ((self.mouseX / self.width)  - 0.5) * 2 * self.worldHalfW;
                var wy = ((self.mouseY / self.height) - 0.5) * 2 * self.worldHalfH;
                self.sources[self.draggingMagnet].x = wx;
                self.sources[self.draggingMagnet].y = wy;
                self._initState();
                self.totalSteps = 0;
            } else {
                self.hoveredMagnet = self._magnetUnderMouse();
                self.overlay.style.cursor = (self.hoveredMagnet >= 0) ? 'move' : 'default';
            }
        });
        this.overlay.addEventListener('mouseleave', function () {
            self.hasMouse      = false;
            self.hoveredMagnet = -1;
            self.overlay.style.cursor = 'default';
        });
        this.overlay.addEventListener('mousedown', function (e) {
            var idx = self._magnetUnderMouse();
            if (idx >= 0) {
                self.draggingMagnet = idx;
                self.overlay.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });
        // mouseup listens on window so a release outside the canvas still ends the
        // drag — without this the magnet would "stick" to the cursor if the user
        // released over the slider or off the page.
        window.addEventListener('mouseup', function () {
            if (self.draggingMagnet >= 0) {
                self.draggingMagnet = -1;
                self.reset();
                self.overlay.style.cursor = (self.hoveredMagnet >= 0) ? 'move' : 'default';
            }
        });
    };

    // Returns the index of the source (magnet OR mount) under the current mouse
    // position in screen space, using the visible overlay radius as the hit area.
    // Mount uses a larger radius (matches its 22 px crosshair arms).
    MagPendGPU.prototype._magnetUnderMouse = function () {
        if (!this.hasMouse) return -1;
        for (var i = 0; i < this.sources.length; i++) {
            var s    = this.sources[i];
            var hitR = (s.type === 0) ? 22 : 16;
            var mpx  = this._worldToPxX(s.x);
            var mpy  = this._worldToPxY(s.y);
            var dx   = mpx - this.mouseX;
            var dy   = mpy - this.mouseY;
            if (dx*dx + dy*dy < hitR*hitR) return i;
        }
        return -1;
    };

    MagPendGPU.prototype._setupGL = function () {
        var gl = this.glCanvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
        if (!gl) { throw new Error('WebGL 2 not supported'); }
        if (!gl.getExtension('EXT_color_buffer_float')) {
            throw new Error('EXT_color_buffer_float not supported');
        }
        this.gl = gl;

        var vsSrc = [
            '#version 300 es',
            'in vec2 a_pos;',
            'out vec2 v_uv;',
            'void main() {',
            '  v_uv = a_pos * 0.5 + 0.5;',
            '  gl_Position = vec4(a_pos, 0.0, 1.0);',
            '}'
        ].join('\n');

        var initFsSrc = [
            '#version 300 es',
            'precision highp float;',
            'in vec2 v_uv;',
            'uniform vec2 u_worldHalf;',
            'layout(location=0) out vec4 outState;',
            'layout(location=1) out vec4 outStatus;',
            'void main() {',
            // Flip Y: WebGL renders v_uv.y=1 at the canvas TOP, but the 2D overlay
            // (magnet sprites, mouse trace) uses standard screen Y-down. Mapping
            // v_uv.y=0 → world +worldHalfH aligns GL output with the overlay so
            // magnets sit in the centre of their colored basins.
            '  vec2 pos = vec2(v_uv.x - 0.5, 0.5 - v_uv.y) * 2.0 * u_worldHalf;',
            '  outState  = vec4(pos, 0.0, 0.0);',
            '  outStatus = vec4(0.0);',
            '}'
        ].join('\n');

        // Integration kernel. Loop bound is a compile-time constant; the runtime
        // u_stepsPerFrame just decides when to break early.
        var integrateFsSrc = [
            '#version 300 es',
            'precision highp float;',
            '#define MAX_SOURCES        8',
            '#define MAX_STEPS_PER_FRAME 200',
            'in vec2 v_uv;',
            'uniform sampler2D u_state;',
            'uniform sampler2D u_status;',
            'uniform int   u_srcCount;',
            'uniform vec4  u_src[MAX_SOURCES];',
            'uniform int   u_srcType[MAX_SOURCES];',
            'uniform float u_friction;',
            'uniform float u_dt;',
            'uniform int   u_stepsPerFrame;',
            'uniform int   u_maxSteps;',
            'uniform float u_pendHeight;',
            'uniform float u_abortVel2;',
            'layout(location=0) out vec4 outState;',
            'layout(location=1) out vec4 outStatus;',
            '',
            'vec2 accel(vec2 pos, vec2 vel) {',
            '  vec2 a = vec2(0.0);',
            '  for (int i = 0; i < MAX_SOURCES; i++) {',
            '    if (i >= u_srcCount) break;',
            '    vec4 s = u_src[i];',
            '    vec2 dr = s.xy - pos;',
            '    if (u_srcType[i] == 0) {',
            '      a += s.z * dr;',
            '    } else {',
            '      float d2 = dot(dr, dr) + u_pendHeight * u_pendHeight;',
            '      float d  = sqrt(d2);',
            '      a += (s.z / (d2 * d)) * dr;',
            '    }',
            '  }',
            '  a -= u_friction * vel;',
            '  return a;',
            '}',
            '',
            'void main() {',
            '  vec4 state  = texture(u_state,  v_uv);',
            '  vec4 status = texture(u_status, v_uv);',
            // Pixel already converged or maxed-out → pass through unchanged.
            '  if (status.y != 0.0) { outState = state; outStatus = status; return; }',
            '  vec2 pos = state.xy;',
            '  vec2 vel = state.zw;',
            '  float lenAcc = status.x;',
            '  float steps  = status.z;',
            '  float restIdx = 0.0;',
            '  bool stopped = false;',
            '  for (int s = 0; s < MAX_STEPS_PER_FRAME; s++) {',
            '    if (s >= u_stepsPerFrame) break;',
            // RK4 step (matches the order of accuracy of the original RK4/RK5).
            '    vec2 k1p = vel;',
            '    vec2 k1v = accel(pos, vel);',
            '    vec2 k2p = vel + 0.5*u_dt*k1v;',
            '    vec2 k2v = accel(pos + 0.5*u_dt*k1p, vel + 0.5*u_dt*k1v);',
            '    vec2 k3p = vel + 0.5*u_dt*k2v;',
            '    vec2 k3v = accel(pos + 0.5*u_dt*k2p, vel + 0.5*u_dt*k2v);',
            '    vec2 k4p = vel + u_dt*k3v;',
            '    vec2 k4v = accel(pos + u_dt*k3p, vel + u_dt*k3v);',
            '    vec2 dpos = (u_dt / 6.0) * (k1p + 2.0*k2p + 2.0*k3p + k4p);',
            '    vec2 dvel = (u_dt / 6.0) * (k1v + 2.0*k2v + 2.0*k3v + k4v);',
            '    pos += dpos;',
            '    vel += dvel;',
            '    lenAcc += length(dpos);',
            '    steps  += 1.0;',
            // Abort: any magnet (type==1) within its radius AND velocity² below threshold.
            '    if (dot(vel, vel) < u_abortVel2) {',
            '      float minD2 = 1e20;',
            '      int   idx   = 0;',
            '      bool  near  = false;',
            '      for (int j = 0; j < MAX_SOURCES; j++) {',
            '        if (j >= u_srcCount) break;',
            '        if (u_srcType[j] != 1) continue;',
            '        vec2 dr = u_src[j].xy - pos;',
            '        float d2 = dot(dr, dr);',
            '        if (d2 < u_src[j].w * u_src[j].w) near = true;',
            '        if (d2 < minD2) { minD2 = d2; idx = j; }',
            '      }',
            '      if (near) { restIdx = float(idx); stopped = true; break; }',
            '    }',
            '    if (steps >= float(u_maxSteps)) break;',
            '  }',
            '  outState = vec4(pos, vel);',
            '  float newStat = 0.0;',
            '  if (stopped) {',
            '    newStat = restIdx;',                  // positive = magnet index
            '  } else if (steps >= float(u_maxSteps)) {',
            '    newStat = -1.0;',                     // negative = timed out → mount color
            '  }',
            '  outStatus = vec4(lenAcc, newStat, steps, 0.0);',
            '}'
        ].join('\n');

        var displayFsSrc = [
            '#version 300 es',
            'precision highp float;',
            '#define MAX_SOURCES 8',
            'in vec2 v_uv;',
            'uniform sampler2D u_status;',
            'uniform vec3  u_colors[MAX_SOURCES];',
            'uniform float u_refLength;',
            'out vec4 fragColor;',
            'void main() {',
            '  vec4 st = texture(u_status, v_uv);',
            '  float stat = st.y;',
            '  float len  = st.x;',
            // stat == 0   → pixel still in flight (transient during scan) → black
            // stat <  0   → timed out without converging → render in mount color (0)
            // stat >  0   → settled on the magnet at that index
            '  if (stat == 0.0) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }',
            '  int idx = (stat < 0.0) ? 0 : int(stat + 0.5);',
            // Length shading normalized to the corner-pixel reference length.
            // Original was exp(-ln(256)·(len/ref)²) ≈ exp(-5.55·r²), which crushes
            // the wider 2:1 view to black at the edges. Gentler coefficient (2.0)
            // preserves color outside the original ±1000 box while still giving
            // the chaotic core a satisfying drop-off.
            '  float r = len / u_refLength;',
            '  float shade = exp(-2.0 * r * r);',
            '  fragColor = vec4(u_colors[idx] * shade, 1.0);',
            '}'
        ].join('\n');

        this.progInit      = this._buildProg(vsSrc, initFsSrc);
        this.progIntegrate = this._buildProg(vsSrc, integrateFsSrc);
        this.progDisplay   = this._buildProg(vsSrc, displayFsSrc);

        var quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
        this.quadBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);

        this.texState  = [this._makeFloatTex(), this._makeFloatTex()];
        this.texStatus = [this._makeFloatTex(), this._makeFloatTex()];
        this.fb        = [gl.createFramebuffer(), gl.createFramebuffer()];
        for (var i = 0; i < 2; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb[i]);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texState[i],  0);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.texStatus[i], 0);
            gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.src = 0; this.dst = 1;
    };

    MagPendGPU.prototype._makeFloatTex = function () {
        var gl = this.gl;
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.width, this.height, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    };

    MagPendGPU.prototype._buildProg = function (vsSrc, fsSrc) {
        var gl = this.gl;
        var vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsSrc); gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error('VS: ' + gl.getShaderInfoLog(vs));
        var fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSrc); gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error('FS: ' + gl.getShaderInfoLog(fs));
        var prog = gl.createProgram();
        gl.attachShader(prog, vs); gl.attachShader(prog, fs);
        gl.bindAttribLocation(prog, 0, 'a_pos');
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('LINK: ' + gl.getProgramInfoLog(prog));
        return prog;
    };

    MagPendGPU.prototype._initState = function () {
        var gl = this.gl;
        gl.viewport(0, 0, this.width, this.height);
        gl.useProgram(this.progInit);
        gl.uniform2f(gl.getUniformLocation(this.progInit, 'u_worldHalf'), this.worldHalfW, this.worldHalfH);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb[this.src]);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    MagPendGPU.prototype._integrate = function () {
        var gl = this.gl;
        var p  = this.progIntegrate;
        gl.viewport(0, 0, this.width, this.height);
        gl.useProgram(p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb[this.dst]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texState[this.src]);
        gl.uniform1i(gl.getUniformLocation(p, 'u_state'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.texStatus[this.src]);
        gl.uniform1i(gl.getUniformLocation(p, 'u_status'), 1);

        var srcArr  = new Float32Array(this.sources.length * 4);
        var typeArr = new Int32Array(this.sources.length);
        for (var i = 0; i < this.sources.length; i++) {
            var s = this.sources[i];
            srcArr[i*4+0] = s.x;
            srcArr[i*4+1] = s.y;
            srcArr[i*4+2] = s.k;
            srcArr[i*4+3] = s.r;
            typeArr[i]    = s.type;
        }
        gl.uniform1i (gl.getUniformLocation(p, 'u_srcCount'),     this.sources.length);
        gl.uniform4fv(gl.getUniformLocation(p, 'u_src'),          srcArr);
        gl.uniform1iv(gl.getUniformLocation(p, 'u_srcType'),      typeArr);
        gl.uniform1f (gl.getUniformLocation(p, 'u_friction'),     this.friction);
        gl.uniform1f (gl.getUniformLocation(p, 'u_dt'),           this.dt);
        gl.uniform1i (gl.getUniformLocation(p, 'u_stepsPerFrame'),this.stepsPerFrame);
        gl.uniform1i (gl.getUniformLocation(p, 'u_maxSteps'),     this.maxSteps);
        gl.uniform1f (gl.getUniformLocation(p, 'u_pendHeight'),   this.pendHeight);
        gl.uniform1f (gl.getUniformLocation(p, 'u_abortVel2'),    this.abortVel2);

        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        var tmp = this.src; this.src = this.dst; this.dst = tmp;
        this.totalSteps += this.stepsPerFrame;
    };

    MagPendGPU.prototype._display = function () {
        var gl = this.gl;
        var p  = this.progDisplay;
        gl.viewport(0, 0, this.width, this.height);
        gl.useProgram(p);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texStatus[this.src]);
        gl.uniform1i(gl.getUniformLocation(p, 'u_status'), 0);

        var colArr = new Float32Array(8 * 3);
        for (var i = 0; i < this.sources.length; i++) {
            var c = COLORS[i] || COLORS[0];
            colArr[i*3+0] = c[0] / 255;
            colArr[i*3+1] = c[1] / 255;
            colArr[i*3+2] = c[2] / 255;
        }
        gl.uniform3fv(gl.getUniformLocation(p, 'u_colors'), colArr);
        gl.uniform1f(gl.getUniformLocation(p, 'u_refLength'), this.refLength);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
    };

    // Single-pendulum CPU integration for the live mouse trace overlay.
    MagPendGPU.prototype._traceCPU = function (x0, y0) {
        var pos = [x0, y0];
        var vel = [0, 0];
        var dt  = this.dt;
        var pts = [[x0, y0]];
        var restIdx = -1;
        var maxIt   = 30000;
        var srcs    = this.sources;
        var friction = this.friction;
        var ph2 = this.pendHeight * this.pendHeight;

        function accel(px, py, vx, vy) {
            var ax = 0, ay = 0;
            for (var i = 0; i < srcs.length; i++) {
                var s = srcs[i];
                var drx = s.x - px, dry = s.y - py;
                if (s.type === 0) {
                    ax += s.k * drx; ay += s.k * dry;
                } else {
                    var d2 = drx*drx + dry*dry + ph2;
                    var d  = Math.sqrt(d2);
                    var f  = s.k / (d2 * d);
                    ax += f * drx; ay += f * dry;
                }
            }
            ax -= friction * vx; ay -= friction * vy;
            return [ax, ay];
        }

        for (var step = 0; step < maxIt; step++) {
            var k1a = accel(pos[0], pos[1], vel[0], vel[1]);
            var k1px = vel[0], k1py = vel[1];
            var k2a = accel(pos[0]+0.5*dt*k1px, pos[1]+0.5*dt*k1py, vel[0]+0.5*dt*k1a[0], vel[1]+0.5*dt*k1a[1]);
            var k2px = vel[0]+0.5*dt*k1a[0], k2py = vel[1]+0.5*dt*k1a[1];
            var k3a = accel(pos[0]+0.5*dt*k2px, pos[1]+0.5*dt*k2py, vel[0]+0.5*dt*k2a[0], vel[1]+0.5*dt*k2a[1]);
            var k3px = vel[0]+0.5*dt*k2a[0], k3py = vel[1]+0.5*dt*k2a[1];
            var k4a = accel(pos[0]+dt*k3px, pos[1]+dt*k3py, vel[0]+dt*k3a[0], vel[1]+dt*k3a[1]);
            var k4px = vel[0]+dt*k3a[0], k4py = vel[1]+dt*k3a[1];

            pos[0] += dt/6 * (k1px + 2*k2px + 2*k3px + k4px);
            pos[1] += dt/6 * (k1py + 2*k2py + 2*k3py + k4py);
            vel[0] += dt/6 * (k1a[0] + 2*k2a[0] + 2*k3a[0] + k4a[0]);
            vel[1] += dt/6 * (k1a[1] + 2*k2a[1] + 2*k3a[1] + k4a[1]);
            pts.push([pos[0], pos[1]]);

            if (vel[0]*vel[0] + vel[1]*vel[1] < this.abortVel2) {
                var near = false, minD2 = Infinity, idx = -1;
                for (var i = 0; i < srcs.length; i++) {
                    var s = srcs[i];
                    if (s.type !== 1) continue;
                    var drx = s.x - pos[0], dry = s.y - pos[1];
                    var d2  = drx*drx + dry*dry;
                    if (d2 < s.r*s.r) near = true;
                    if (d2 < minD2) { minD2 = d2; idx = i; }
                }
                if (near) { restIdx = idx; break; }
            }
        }
        return { points: pts, restIdx: restIdx };
    };

    MagPendGPU.prototype._worldToPxX = function (wx) { return (wx / (2*this.worldHalfW) + 0.5) * this.width;  };
    MagPendGPU.prototype._worldToPxY = function (wy) { return (wy / (2*this.worldHalfH) + 0.5) * this.height; };

    MagPendGPU.prototype._drawOverlay = function () {
        var ctx = this.ctx2d;
        ctx.clearRect(0, 0, this.width, this.height);

        var scaleX = this.width  / (2 * this.worldHalfW);
        var scaleY = this.height / (2 * this.worldHalfH);

        // Magnets and mount crosshair on top of the fractal. Fixed screen-px sizes
        // keep them readable regardless of the world-view zoom.
        var magnetRadiusPx = 14;
        var mountArmPx     = 22;
        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        for (var i = 0; i < this.sources.length; i++) {
            var s  = this.sources[i];
            var px = this._worldToPxX(s.x);
            var py = this._worldToPxY(s.y);
            if (s.type === 0) {
                ctx.strokeStyle = 'rgb(160,160,160)';
                ctx.beginPath();
                ctx.moveTo(px - mountArmPx, py); ctx.lineTo(px + mountArmPx, py);
                ctx.moveTo(px, py - mountArmPx); ctx.lineTo(px, py + mountArmPx);
                ctx.stroke();
            } else {
                // Each magnet sits inside its own colored basin, so a same-colored
                // ring would vanish. White ring stays visible on any basin color.
                ctx.strokeStyle = 'white';
                ctx.beginPath();
                ctx.arc(px, py, magnetRadiusPx, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.restore();

        // Live mouse trace + text labels — skipped during magnet drag so the
        // moving magnet stays unobstructed.
        if (this.hasMouse && this.draggingMagnet < 0 && this.hoveredMagnet < 0) {
            var wx = ((this.mouseX / this.width)  - 0.5) * 2 * this.worldHalfW;
            var wy = ((this.mouseY / this.height) - 0.5) * 2 * this.worldHalfH;
            var trace = this._traceCPU(wx, wy);

            if (trace.points.length > 1) {
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(this._worldToPxX(trace.points[0][0]), this._worldToPxY(trace.points[0][1]));
                for (var i = 1; i < trace.points.length; i++) {
                    ctx.lineTo(this._worldToPxX(trace.points[i][0]), this._worldToPxY(trace.points[i][1]));
                }
                ctx.stroke();
            }

            ctx.fillStyle = 'white';
            ctx.font = this.font;
            ctx.textBaseline = 'top';
            ctx.textAlign    = 'right';
            ctx.fillText('Start Point: x=' + wx.toFixed(0) + '; y=' + wy.toFixed(0), this.width - 20, 20);
            ctx.fillText('Stopped at Magnet: ' + trace.restIdx, this.width - 20, 50);
            ctx.textAlign    = 'left';
        }

        // "move me!" hint next to the magnet under the cursor (or being dragged).
        var hintIdx = (this.draggingMagnet >= 0) ? this.draggingMagnet : this.hoveredMagnet;
        if (hintIdx >= 0) {
            var hs  = this.sources[hintIdx];
            var hpx = this._worldToPxX(hs.x);
            var hpy = this._worldToPxY(hs.y);
            ctx.save();
            ctx.font         = '14px Arial';
            ctx.textBaseline = 'top';
            ctx.textAlign    = 'center';
            ctx.lineWidth    = 3;
            ctx.strokeStyle  = 'rgba(0, 0, 0, 0.85)';
            ctx.fillStyle    = '#fff';
            ctx.strokeText('move me!', hpx, hpy + 18);
            ctx.fillText  ('move me!', hpx, hpy + 18);
            ctx.restore();
        }
    };

    MagPendGPU.prototype._tick = function () {
        if (this.totalSteps < this.maxSteps) this._integrate();
        this._display();
        this._drawOverlay();
    };

    return MagPendGPU;
}());

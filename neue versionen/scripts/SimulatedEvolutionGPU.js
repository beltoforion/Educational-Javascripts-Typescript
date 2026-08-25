/*
 * Educational-Javascript-Typescript
 * https://github.com/beltoforion/Educational-Javascripts-Typescript
 *
 * Copyright (c) 2026, Ingo Berg
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the “Software”), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 * NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
// SimulatedEvolutionGPU — GPU-rendered port of the simulated-evolution applet.
// CPU sim (flat typed-array microbe pool, free-list slot reuse), GPU rendering:
//   - Food grid: R8 texture, full-grid upload per frame, scaled to canvas.
//   - Microbes:  single draw call as point sprites from a packed vertex buffer.
// Multiple sim ticks per RAF (configurable) keep evolution fast without the
// per-tick fillRect overhead of the original Canvas2D version.

"use strict";

var SimulatedEvolutionGPU = (function () {

    // 8-direction motion table in clockwise rotational order starting at N.
    // The original applet stored these in scan order, which broke the semantic
    // of STEERING_COST (which is symmetric around index 4 = "reverse") — gene[i]
    // didn't map to a consistent turn. With rotational order, gene[0]=forward,
    // gene[2]=right turn, gene[4]=reverse, gene[6]=left turn, matching costs.
    var MOTION = new Int8Array([
         0, -1,    1, -1,    1,  0,    1,  1,
         0,  1,   -1,  1,   -1,  0,   -1, -1
    ]);

    // Energy cost for direction change (hard turns cost more; index = turn step).
    var STEERING_COST = new Uint8Array([0, 1, 2, 4, 8, 4, 2, 1]);

    // Unit vectors per relative direction, used for genome-based colouring.
    // Σ gene[i] · DIR_UV[i] gives a 2D "drift bias" vector whose angle drives
    // the hue and whose magnitude drives the saturation. Isotropic genomes
    // sum to ~0 → grey; concentrated genomes give vivid colours.
    var DIR_UV = new Float32Array(16);
    (function () {
        for (var i = 0; i < 8; ++i) {
            var dx = MOTION[i * 2];
            var dy = MOTION[i * 2 + 1];
            var len = Math.sqrt(dx * dx + dy * dy);
            DIR_UV[i * 2]     = dx / len;
            DIR_UV[i * 2 + 1] = dy / len;
        }
    })();

    function hsv2rgb01(h, s, v) {
        var i = Math.floor(h * 6) % 6;
        if (i < 0) i += 6;
        var f = h * 6 - Math.floor(h * 6);
        var p = v * (1 - s);
        var q = v * (1 - f * s);
        var t = v * (1 - (1 - f) * s);
        switch (i) {
            case 0: return [v, t, p];
            case 1: return [q, v, p];
            case 2: return [p, v, t];
            case 3: return [p, q, v];
            case 4: return [t, p, v];
            default: return [v, p, q];
        }
    }
    function hsv2rgbCSS(h, s, v) {
        var c = hsv2rgb01(h, s, v);
        return 'rgb(' + (c[0]*255|0) + ',' + (c[1]*255|0) + ',' + (c[2]*255|0) + ')';
    }
    function rgbComplementCSS(h, s, v) {
        // RGB complement of the inner colour — matches the shader's border
        // formula (vec3(1.0) − inner).
        var c = hsv2rgb01(h, s, v);
        return 'rgb(' + (255 - (c[0]*255|0)) + ',' + (255 - (c[1]*255|0)) + ',' + (255 - (c[2]*255|0)) + ')';
    }

    var VS_FOOD = `#version 300 es
        in vec2 aPos;
        out vec2 vUV;
        void main() {
            vUV = aPos * 0.5 + 0.5;
            // Flip Y so texture row 0 lands at top of the canvas.
            vUV.y = 1.0 - vUV.y;
            gl_Position = vec4(aPos, 0.0, 1.0);
        }
    `;

    var FS_FOOD = `#version 300 es
        precision highp float;
        in vec2 vUV;
        uniform sampler2D uFood;
        uniform sampler2D uCost;
        uniform vec3 uColorFood;
        uniform vec3 uColorBack;
        // View transform: viewCenter is the world-UV coordinate (range 0..1)
        // at the screen centre; viewZoom is the linear magnification factor.
        // At zoom 1 the view covers the full world. clamp(viewCenter) in JS
        // keeps the view window inside [0,1]² so we never read outside the
        // texture and CLAMP_TO_EDGE bleed is irrelevant.
        uniform vec2 uViewCenter;
        uniform float uViewZoom;
        out vec4 outColor;
        void main() {
            vec2 uv = uViewCenter + (vUV - 0.5) / uViewZoom;
            float f = texture(uFood, uv).r;
            float k = texture(uCost, uv).r;  // hostility (cost) value
            vec3 c = mix(uColorBack, uColorFood, f);
            // Hostility → red tint, intensity proportional to cost magnitude.
            if (k > 0.0) {
                c = mix(c, vec3(0.65, 0.05, 0.05), 0.35 + 0.45 * k);
            }
            outColor = vec4(c, 1.0);
        }
    `;

    var VS_MICROBES = `#version 300 es
        in vec2 aPos;    // (cellX, cellY)
        in vec3 aHSV;    // (hue, sat, val) from drift-vector mapping
        uniform vec2 uCells;
        uniform float uPointSize;
        // View transform (see FS_FOOD). World-UV coord = (cellX, cellY) / cells;
        // screen-UV = 0.5 + (worldUV - viewCenter) * zoom; NDC = screenUV*2-1.
        uniform vec2 uViewCenter;
        uniform float uViewZoom;
        out vec3 vHSV;
        void main() {
            vec2 worldUV   = (aPos + 0.5) / uCells;
            vec2 screenUV  = 0.5 + (worldUV - uViewCenter) * uViewZoom;
            vec2 ndc       = screenUV * 2.0 - 1.0;
            gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
            gl_PointSize = uPointSize * uViewZoom;
            vHSV = aHSV;
        }
    `;

    // Colour microbes by the dominant direction in their genome (drift vector
    // → hue, magnitude → saturation). A 1-pixel ring of the RGB-complementary
    // colour is painted around the sprite so adjacent microbes don't visually
    // merge. Gray (isotropic-genome) microbes get a gray border by
    // construction — that's a feature: "no genetic colour" is legible at a
    // glance.
    var FS_MICROBES = `#version 300 es
        precision highp float;
        in vec3 vHSV;
        uniform float uPointSize;
        uniform float uShowBorder;
        out vec4 outColor;
        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }
        void main() {
            vec2 d = gl_PointCoord - 0.5;
            float r = max(abs(d.x), abs(d.y));
            float edgeStart = 0.5 - 1.0 / uPointSize;
            vec3 inner  = hsv2rgb(vHSV);
            vec3 border = vec3(1.0) - inner;
            bool drawBorder = uShowBorder > 0.5 && r > edgeStart;
            vec3 c = drawBorder ? border : inner;
            outColor = vec4(c, 1.0);
        }
    `;

    function compile(gl, type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error('Shader compile error: ' + gl.getShaderInfoLog(s));
        }
        return s;
    }

    function makeProgram(gl, vs, fs) {
        var p = gl.createProgram();
        gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
        gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + gl.getProgramInfoLog(p));
        }
        return p;
    }

    function parseColor(s) {
        // Accept "rgb(r,g,b)" — same syntax the original used.
        var m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(s);
        if (!m) return [0, 0, 0];
        return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
    }

    function SimulatedEvolutionGPU(cfg) {
        this.cvid    = cfg.cvid;
        this.width   = cfg.width   || 1600;
        this.height  = cfg.height  || 900;
        // Cell grid: cellPx px per cell. Per-frame pixel jump = ticksPerFrame * cellPx.
        // microbeCells = microbe edge length in cells; sprite is microbeCells² big.
        this.cellPx       = cfg.cellPx       || 2;
        this.microbeCells = cfg.microbeCells || 3;
        this.cellsX       = cfg.cellsX       || (this.width  / this.cellPx) | 0;
        this.cellsY       = cfg.cellsY       || (this.height / this.cellPx) | 0;

        this.maxMicrobes       = cfg.maxMicrobes       || 4096;
        this.initialMicrobes   = cfg.initialMicrobes   || 10;
        this.initialFood       = cfg.initialFood       || (this.cellsX * this.cellsY * 0.33) | 0;
        // foodSpawnPerTick scales with grid size: tripled from the original
        // baseline (6 per tick for 400×300 cells) so additive deposits and the
        // exponential growth don't starve the population at low densities.
        this.foodSpawnPerTick  = cfg.foodSpawnPerTick  ||
                                 Math.max(6, Math.round(6 * this.cellsX * this.cellsY / 120000));
        this.energyPerFood     = cfg.energyPerFood     || 150;
        // Per-tick exponential growth factor applied to every cell that
        // already contains food (cap 255). 1.0 = static deposits; >1 grows.
        this.foodGrowthFactor  = (cfg.foodGrowthFactor !== undefined) ? cfg.foodGrowthFactor : 1.001;
        this.energyMax         = cfg.energyMax         || 1500;
        this.energyToReproduce = cfg.energyToReproduce || 1000;
        // 0 = no metabolic cost (microbes only die from steering).
        this.energyPerTick     = (cfg.energyPerTick !== undefined) ? cfg.energyPerTick : 4;
        // Constant hostility value (extra energy drain per tick) written into
        // every cell of the moving-circle's toxic ring. The ring itself has
        // width 0 at reset (rIn = rOut = side) and widens as the food zone
        // shrinks — so the *area* of damage grows with the ramp while the
        // per-cell damage stays constant. Default 10.
        this.ringHostility     = (cfg.ringHostility !== undefined) ? cfg.ringHostility : 10;
        // Sim ticks per displayed frame. Per-frame pixel jump = ticksPerFrame * cellPx.
        this.ticksPerFrame     = cfg.ticksPerFrame     || 5;

        this.colMicrobe = parseColor(cfg.colMicrobe || "rgb(50,100,255)");
        this.colFood    = parseColor(cfg.colFood    || "rgb(0,200,0)");
        this.colBack    = parseColor(cfg.colBack    || "rgb(0,0,0)");

        this.spawnStrategy = cfg.spawnStrategy || 0;
        // 0 = genome-drift colouring (default), 1 = age, 2 = energy.
        this.colorMode = cfg.colorMode || 0;

        // Pause + inspect state. While paused, _frame skips _tick() but still
        // re-renders. Selection state lives in `selected` (a per-slot bitmap
        // allocated in _allocPool) plus `selectedCount`; single-click and
        // arrow nav degenerate to a 1-microbe selection, the rubberband sets
        // many bits at once. _singleSelIdx() returns the single selected slot
        // when count === 1, else -1 — overlay branches on that.
        this.paused      = false;

        // View transform. viewCenter is in world-UV space (0..1), viewZoom is
        // the linear magnification (1 = full world view, larger = zoomed in).
        // Mausrad-Zoom auf Cursorposition; Shift+Linksdrag pannt. Bei zoom=1
        // ist viewCenter fix auf (0.5, 0.5) — Pan ist dann ein No-op, die
        // Welt füllt das Fenster komplett.
        this.viewZoom    = 1;
        this.viewCenterX = 0.5;
        this.viewCenterY = 0.5;
        this.viewZoomMin = 1;
        this.viewZoomMax = 16;

        this._setupDom();
        this._setupGL();
        this._allocPool();
        this.reset();
        this._setupKeyboard();
        this._setupMouse();

        var self = this;
        startAppletLoop(document.getElementById(this.cvid), function () { self._frame(); });
    }

    SimulatedEvolutionGPU.prototype.setSpawnStrategy = function (s) {
        var old = this.spawnStrategy;
        this.spawnStrategy = s | 0;
        // Only the moving-circle mode uses the hostility map; clear it when
        // leaving so stale toxic cells don't poison other modes, and write
        // the static bands when entering.
        if (old === 3 && this.spawnStrategy !== 3 && this.costMap) {
            this.costMap.fill(0);
        } else if (old !== 3 && this.spawnStrategy === 3) {
            this._writeBandsToCostMap();
        }
    };

    SimulatedEvolutionGPU.prototype.setColorMode = function (m) {
        this.colorMode = m | 0;
    };

    SimulatedEvolutionGPU.prototype.setPaused = function (p) {
        var was = this.paused;
        this.paused = !!p;
        if (was !== this.paused && typeof this.onPauseChange === 'function') {
            this.onPauseChange(this.paused);
        }
    };

    SimulatedEvolutionGPU.prototype.deselect = function () {
        this._clearSelection();
    };

    SimulatedEvolutionGPU.prototype.togglePause = function () {
        this.setPaused(!this.paused);
    };

    // --- Selection helpers ----------------------------------------------
    // `selected` is a Uint8Array (1 = selected), `selectedCount` caches the
    // popcount. The set is the single source of truth — _drawGenomeOverlay
    // branches on count (0/1/N). Slots are auto-pruned on death in _freeSlot.

    SimulatedEvolutionGPU.prototype._clearSelection = function () {
        if (this.selectedCount === 0) return;
        this.selected.fill(0);
        this.selectedCount = 0;
    };

    SimulatedEvolutionGPU.prototype._setSingleSelection = function (idx) {
        this._clearSelection();
        if (idx >= 0 && this.mAlive[idx]) {
            this.selected[idx] = 1;
            this.selectedCount = 1;
        }
    };

    SimulatedEvolutionGPU.prototype._singleSelIdx = function () {
        if (this.selectedCount !== 1) return -1;
        var sel = this.selected, N = this.maxMicrobes;
        for (var i = 0; i < N; ++i) {
            if (sel[i] && this.mAlive[i]) return i;
        }
        return -1;
    };

    // Replace the current selection with all alive microbes whose cell falls
    // inside the inclusive grid-coord rectangle. Snapshot semantics: the set
    // is fixed at call time; the microbes are free to wander afterwards.
    SimulatedEvolutionGPU.prototype.selectInRect = function (x0, y0, x1, y1) {
        if (x0 > x1) { var tx = x0; x0 = x1; x1 = tx; }
        if (y0 > y1) { var ty = y0; y0 = y1; y1 = ty; }
        this._clearSelection();
        var N = this.maxMicrobes;
        var sel = this.selected;
        var cnt = 0;
        for (var idx = 0; idx < N; ++idx) {
            if (this.mAlive[idx] === 0) continue;
            var x = this.mX[idx], y = this.mY[idx];
            if (x < x0 || x > x1 || y < y0 || y > y1) continue;
            sel[idx] = 1;
            cnt++;
        }
        this.selectedCount = cnt;
    };

    // Advance exactly one simulation tick and redraw. Forces pause first so
    // repeated clicks scrub forward one tick at a time instead of fighting
    // the running loop.
    SimulatedEvolutionGPU.prototype.stepOnce = function () {
        if (!this.paused) this.setPaused(true);
        this._tick();
        this._computeStats();
        this._render();
        this._drawGenomeOverlay();
    };

    SimulatedEvolutionGPU.prototype.setOnPauseChange = function (fn) {
        this.onPauseChange = fn;
    };

    // Iterate through alive microbes in slot order. dir = +1 / -1. If no
    // single microbe is currently selected (count !== 1), picks the first /
    // last alive slot — also collapses any multi-selection to a single.
    SimulatedEvolutionGPU.prototype.selectNext = function (dir) {
        if (this.microbeNum === 0) { this._clearSelection(); return; }
        var N = this.maxMicrobes;
        var cur = this._singleSelIdx();
        var start = cur >= 0 ? cur : (dir > 0 ? -1 : N);
        for (var k = 1; k <= N; ++k) {
            var idx = ((start + dir * k) % N + N) % N;
            if (this.mAlive[idx]) { this._setSingleSelection(idx); return; }
        }
        this._clearSelection();
    };

    // Focus the currently oldest alive microbe. Does not pause: the selection
    // tracks the microbe across ticks (and _freeSlot will clear it on death).
    SimulatedEvolutionGPU.prototype.selectOldest = function () {
        var N = this.maxMicrobes;
        var bestIdx = -1, bestAge = -1;
        for (var idx = 0; idx < N; ++idx) {
            if (this.mAlive[idx] === 0) continue;
            if (this.mAge[idx] > bestAge) { bestAge = this.mAge[idx]; bestIdx = idx; }
        }
        if (bestIdx < 0) return;
        this._setSingleSelection(bestIdx);
    };

    // Select the alive microbe nearest to grid-cell coords (cx, cy).
    // Squared distance is enough — we only need the argmin.
    SimulatedEvolutionGPU.prototype.selectNearest = function (cx, cy) {
        var N = this.maxMicrobes;
        var bestIdx = -1, bestD2 = Infinity;
        for (var idx = 0; idx < N; ++idx) {
            if (this.mAlive[idx] === 0) continue;
            var dx = this.mX[idx] - cx;
            var dy = this.mY[idx] - cy;
            var d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; bestIdx = idx; }
        }
        if (bestIdx >= 0) this._setSingleSelection(bestIdx);
    };

    // Clamp viewCenter so the visible window stays inside the world [0,1]².
    // At zoom 1 this forces center back to (0.5, 0.5) — no panning possible
    // when everything is visible anyway.
    SimulatedEvolutionGPU.prototype._clampView = function () {
        var half = 0.5 / this.viewZoom;
        if (this.viewCenterX < half)        this.viewCenterX = half;
        if (this.viewCenterX > 1 - half)    this.viewCenterX = 1 - half;
        if (this.viewCenterY < half)        this.viewCenterY = half;
        if (this.viewCenterY > 1 - half)    this.viewCenterY = 1 - half;
    };

    // Convert screen-UV (px ∈ [0,1] of canvas) to world-UV (∈ [0,1] of world)
    // through the inverse of the current view transform.
    SimulatedEvolutionGPU.prototype._screenToWorldUV = function (sx, sy) {
        return {
            u: this.viewCenterX + (sx - 0.5) / this.viewZoom,
            v: this.viewCenterY + (sy - 0.5) / this.viewZoom
        };
    };

    SimulatedEvolutionGPU.prototype._setupMouse = function () {
        var self = this;
        // Pointer-events on the WebGL canvas drive single-click selection,
        // rubberband-Mehrfachauswahl AND Shift+drag panning. The overlay
        // above the canvas has pointer-events:none so events land here.
        // Coords are normalised against getBoundingClientRect so the mapping
        // survives CSS scaling / fullscreen letterboxing.
        this.dragActive = false;
        this.dragMode   = 'select';   // 'select' (rubberband) or 'pan'
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragCurX   = 0;
        this.dragCurY   = 0;
        var pxStartX = 0, pxStartY = 0;
        // Pan-mode bookkeeping. We anchor at down-time and update from absolute
        // screen-UV delta each move — accumulating per-move increments would
        // drift if any single move event got dropped under pointer-capture.
        var panStartCx = 0, panStartCy = 0;
        var panStartSx = 0, panStartSy = 0;
        // Movement below this many CSS pixels stays a "click" — anything
        // beyond switches the gesture to a rubberband. 4 px ≈ trembly mouse
        // tolerance; below that selecting a single microbe must still work
        // reliably even on touchpads.
        var DRAG_THRESHOLD_PX = 4;
        var crossed = false;

        function localCoords(e) {
            var rect = self.canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return null;
            var px = e.clientX - rect.left;
            var py = e.clientY - rect.top;
            var sx = px / rect.width;
            var sy = py / rect.height;
            var w = self._screenToWorldUV(sx, sy);
            return {
                px: px, py: py,
                sx: sx, sy: sy,           // screen-UV (0..1)
                gx: w.u * self.cellsX,    // world cell coords (through view inverse)
                gy: w.v * self.cellsY
            };
        }

        this.canvas.addEventListener('pointerdown', function (e) {
            if (e.button !== 0) return;
            var c = localCoords(e);
            if (!c) return;
            pxStartX = c.px; pxStartY = c.py;
            crossed = false;
            self.dragActive = true;
            // Shift held at down-time chooses pan; toggling Shift mid-drag
            // does not switch modes (a half-pan, half-rubberband would be
            // disorienting). Pan is a no-op when zoom=1 but the gesture still
            // ends as a clean release — no accidental rubberband.
            self.dragMode = e.shiftKey ? 'pan' : 'select';
            if (self.dragMode === 'pan') {
                panStartCx = self.viewCenterX;
                panStartCy = self.viewCenterY;
                panStartSx = c.sx;
                panStartSy = c.sy;
            } else {
                self.dragStartX = self.dragCurX = c.gx;
                self.dragStartY = self.dragCurY = c.gy;
            }
            // Pointer capture keeps move/up events flowing even if the
            // cursor leaves the canvas mid-drag.
            try { self.canvas.setPointerCapture(e.pointerId); } catch (_) {}
            e.preventDefault();
        });

        this.canvas.addEventListener('pointermove', function (e) {
            if (!self.dragActive) return;
            var c = localCoords(e);
            if (!c) return;
            if (self.dragMode === 'pan') {
                // Solve: anchor world-UV under cursor stays fixed during drag.
                // newCenter = panStartCenter - (s_now - s_down) / zoom
                self.viewCenterX = panStartCx - (c.sx - panStartSx) / self.viewZoom;
                self.viewCenterY = panStartCy - (c.sy - panStartSy) / self.viewZoom;
                self._clampView();
            } else {
                self.dragCurX = c.gx;
                self.dragCurY = c.gy;
                if (!crossed) {
                    var dpx = c.px - pxStartX;
                    var dpy = c.py - pxStartY;
                    if (dpx * dpx + dpy * dpy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
                        crossed = true;
                    }
                }
            }
        });

        function finishDrag(e) {
            if (!self.dragActive) return;
            var wasPan = (self.dragMode === 'pan');
            self.dragActive = false;
            self.dragMode   = 'select';
            try { self.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
            if (!wasPan) {
                if (!crossed) {
                    // Treated as click — single nearest microbe.
                    self.selectNearest(self.dragStartX, self.dragStartY);
                } else {
                    self.selectInRect(self.dragStartX, self.dragStartY,
                                      self.dragCurX,   self.dragCurY);
                }
            }
            // Refocus the applet container so subsequent arrow/space keys
            // continue to reach the keyboard handler.
            var container = document.getElementById(self.cvid);
            if (container) container.focus();
        }

        this.canvas.addEventListener('pointerup', finishDrag);
        this.canvas.addEventListener('pointercancel', function (e) {
            // OS / browser cancelled the gesture (e.g. context menu) —
            // drop the in-progress rectangle without touching the selection.
            self.dragActive = false;
            self.dragMode   = 'select';
            try { self.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        });

        // Mausrad-Zoom: deltaY < 0 = zoom in. Wir verankern den Welt-Punkt
        // unter dem Cursor so, dass er nach dem Zoom dieselbe Bildschirm-
        // Position behält. Faktor 1.15 pro Notch (genug Spürbarkeit, ohne
        // dass ein einzelner Tritt direkt an die Zoom-Grenze knallt).
        this.canvas.addEventListener('wheel', function (e) {
            var c = localCoords(e);
            if (!c) return;
            var factor = Math.exp(-e.deltaY * 0.0015);
            var newZoom = self.viewZoom * factor;
            if (newZoom < self.viewZoomMin) newZoom = self.viewZoomMin;
            if (newZoom > self.viewZoomMax) newZoom = self.viewZoomMax;
            if (newZoom === self.viewZoom) {
                e.preventDefault();
                return;
            }
            // Welt-UV unter dem Cursor vor dem Zoom — soll danach exakt
            // dort bleiben.
            var anchor = self._screenToWorldUV(c.sx, c.sy);
            self.viewZoom = newZoom;
            // newCenter = anchorWorldUV - (cursorScreenUV - 0.5) / newZoom
            self.viewCenterX = anchor.u - (c.sx - 0.5) / newZoom;
            self.viewCenterY = anchor.v - (c.sy - 0.5) / newZoom;
            self._clampView();
            e.preventDefault();
        }, { passive: false });
    };

    SimulatedEvolutionGPU.prototype._setupKeyboard = function () {
        var self = this;
        var container = document.getElementById(this.cvid);
        // Make the container focusable. Arrow / space keys only fire when the
        // user has clicked into the applet — otherwise they'd hijack page
        // scrolling, which is hostile to a long article page.
        if (container && container.tabIndex < 0) container.tabIndex = 0;
        container.addEventListener('keydown', function (e) {
            // Don't fight native button/input behaviour: space activates a
            // focused button on its own, arrows in a number input change the
            // value. Let those pass through unmolested.
            var tag = e.target && e.target.tagName;
            var isInteractive = tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
            if (isInteractive) return;

            if (e.key === ' ' || e.key === 'Spacebar') {
                self.togglePause();
                e.preventDefault();
                return;
            }
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                self.selectNext(+1);
                e.preventDefault();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                self.selectNext(-1);
                e.preventDefault();
            }
        });
    };

    SimulatedEvolutionGPU.prototype._allocPool = function () {
        var N = this.maxMicrobes;
        this.mX      = new Int16Array(N);
        this.mY      = new Int16Array(N);
        this.mDir    = new Uint8Array(N);
        this.mEnergy = new Int32Array(N);
        this.mAge    = new Int32Array(N);
        this.mAlive  = new Uint8Array(N);
        // 8-dim genome: 8 relative-turn probabilities (Σ = 1). The action
        // sampled each tick picks the relative turn 0..7 against the current
        // direction; gene 0 = "geradeaus", gene 4 = "Umkehr".
        this.mGenes    = new Float32Array(N * 8);
        // Set to 1 for slots that just received a newborn this tick — skipped by
        // the iteration so a child doesn't move/age in the same tick as its birth.
        this.mBornThisTick = new Uint8Array(N);

        // Free-slot stack: contains all indices in [0, N) on init; reproduction
        // pops, death pushes back. The pool auto-grows when exhausted (see
        // _growPool) up to a hard cap of cellsX·cellsY (one microbe per cell).
        this.freeStack = new Int32Array(N);
        this.freeTop   = 0;

        // Render buffer per microbe: (x, y, hue, sat, val) — 5 floats per slot.
        this.renderXY = new Float32Array(N * 5);

        // Per-slot selection bitmap (1 = selected). _freeSlot prunes on death,
        // _growPool grows it alongside the other per-slot arrays.
        this.selected      = new Uint8Array(N);
        this.selectedCount = 0;

        // Fractional carry for exponential food growth. The food grid is Uint8
        // and would otherwise stagnate at small values because gain·food < 1
        // truncates to 0 — the accumulator keeps the fractional part across
        // ticks and adds an integer step when it crosses 1.
        this.foodGrowAcc = new Float32Array(this.cellsX * this.cellsY);

        // Per-cell hostility map (Uint8, 0..255 = extra energy drain per tick
        // when a microbe stands on that cell). 0 everywhere by default. The
        // moving-circle's toxic bands write positive values here; other modes
        // leave the map at 0 so they behave exactly as before.
        this.costMap = new Uint8Array(this.cellsX * this.cellsY);

        // Static perpendicular distance from each cell to the patch's path
        // line. Used to populate costMap with the toxic bands at simulation
        // start and whenever ringHostility is tweaked at runtime.
        this.pathDistMap = new Float32Array(this.cellsX * this.cellsY);

        // Fixed point sources for the "Punktquellen" mode (spawnStrategy=4):
        // 1000 paired sources (2000 cells total — two adjacent cells per pair).
        // Each tick all 2000 cells receive a _putFood deposit. Layout is fixed
        // per reset() so the spatial food pattern is stable but varies between
        // runs.
        this.pointSourceCount = 1000;
        this.pointSourcesX    = new Int16Array(this.pointSourceCount * 2);
        this.pointSourcesY    = new Int16Array(this.pointSourceCount * 2);

        // Same count as the regular Punktquellen-Sources, but confined to the
        // bottom-right quadrant for the "Mix" strategy (spawnStrategy=5).
        // Kept separate from pointSourcesX/Y so both strategies stay
        // deterministic-within-run independently.
        this.mixPointSourcesX = new Int16Array(this.pointSourceCount * 2);
        this.mixPointSourcesY = new Int16Array(this.pointSourceCount * 2);

        this.microbeNum = 0;

        // Moving-rectangle drift: starts at 0 on reset() and ramps linearly to
        // the target value below over `movRectRampTicks` ticks of being in
        // moving-rect mode. Gives the population time to colonise the patch
        // before drift selection kicks in. Target 0.4 c/t per axis = the
        // pre-ramp default; effective magnitude at full speed ≈ 0.566 c/t.
        this.movRectTargetVx  = 0.2;
        this.movRectTargetVy  = 0.2;
        this.movRectRampTicks = 20000;
        this.movRectTick = 0;
        this.movRectVx = 0;
        this.movRectVy = 0;
        // Periodic drift reversal: every movRectReversePeriod ticks the drift
        // vector flips sign (full 180°). Creates time-pressure for following:
        // a microbe with high reverse-gene recovers in 1 tick, gradual turners
        // need 2–4 ticks and lose more patch-radii in the meantime — so reverse
        // becomes selectively valuable despite its cost of 8.
        this.movRectReversePeriod = 600;
        this.movRectDirSign       = 1;

        // pathDistMap depends only on grid size and target drift direction
        // (both fixed for the lifetime of the instance), so compute once.
        this._initPathDistMap();
    };

    SimulatedEvolutionGPU.prototype._resetPool = function () {
        var N = this.maxMicrobes;
        this.mAlive.fill(0);
        for (var i = 0; i < N; ++i) this.freeStack[i] = N - 1 - i; // pop 0,1,2,...
        this.freeTop = N;
        this.microbeNum = 0;
    };

    SimulatedEvolutionGPU.prototype._allocSlot = function () {
        if (this.freeTop === 0) {
            if (!this._growPool()) return -1;
        }
        return this.freeStack[--this.freeTop];
    };

    // Double the pool size on demand. Hard cap at cellsX·cellsY: not a
    // per-cell rule (multiple microbes can share a cell now), just a sane
    // upper bound that scales with grid size. Re-allocates every per-slot
    // typed array, the free-stack and the GPU vertex buffer; the VAO's
    // attribute pointers continue to refer to the same VBO object so no
    // rebinding is needed.
    SimulatedEvolutionGPU.prototype._growPool = function () {
        var oldN = this.maxMicrobes;
        var cap  = this.cellsX * this.cellsY;
        if (oldN >= cap) return false;
        var newN = oldN * 2;
        if (newN > cap) newN = cap;

        function resize(arr, Cls) {
            var per = arr.length / oldN;
            var nu  = new Cls(newN * per);
            nu.set(arr);
            return nu;
        }

        this.mX            = resize(this.mX,            Int16Array);
        this.mY            = resize(this.mY,            Int16Array);
        this.mDir          = resize(this.mDir,          Uint8Array);
        this.mEnergy       = resize(this.mEnergy,       Int32Array);
        this.mAge          = resize(this.mAge,          Int32Array);
        this.mAlive        = resize(this.mAlive,        Uint8Array);
        this.mGenes        = resize(this.mGenes,        Float32Array);
        this.mBornThisTick = resize(this.mBornThisTick, Uint8Array);
        this.renderXY     = resize(this.renderXY,      Float32Array);
        this.selected      = resize(this.selected,      Uint8Array);

        // Free-stack: keep the (currently empty) old contents, then push the
        // newly available high-indexed slots so they get allocated first.
        var oldTop = this.freeTop;
        var newStack = new Int32Array(newN);
        if (oldTop > 0) newStack.set(this.freeStack.subarray(0, oldTop));
        this.freeStack = newStack;
        for (var i = oldN; i < newN; ++i) this.freeStack[this.freeTop++] = i;

        this.maxMicrobes = newN;

        var gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.microbeVBO);
        gl.bufferData(gl.ARRAY_BUFFER, newN * 5 * 4, gl.DYNAMIC_DRAW);
        return true;
    };

    SimulatedEvolutionGPU.prototype._freeSlot = function (idx) {
        this.mAlive[idx] = 0;
        this.freeStack[this.freeTop++] = idx;
        this.microbeNum -= 1;
        // The slot is about to be eligible for a fresh microbe; drop it from
        // the selection set so the inspection panel doesn't silently switch
        // to whoever inherits the slot next.
        if (this.selected && this.selected[idx]) {
            this.selected[idx] = 0;
            this.selectedCount--;
        }
    };

    SimulatedEvolutionGPU.prototype._randomGenes = function (idx) {
        var base = idx * 8;
        var sum = 0;
        for (var i = 0; i < 8; ++i) {
            var v = Math.random();
            this.mGenes[base + i] = v;
            sum += v;
        }
        for (var j = 0; j < 8; ++j) this.mGenes[base + j] /= sum;
    };

    SimulatedEvolutionGPU.prototype._mutateGenesInto = function (childIdx, parentIdx) {
        var cBase = childIdx  * 8;
        var pBase = parentIdx * 8;
        for (var i = 0; i < 8; ++i) this.mGenes[cBase + i] = this.mGenes[pBase + i];
        var n = (Math.random() * 8) | 0;
        this.mGenes[cBase + n] += (Math.random() - 0.5);
        if (this.mGenes[cBase + n] < 0) this.mGenes[cBase + n] = 0;
        var sum = 0;
        for (var k = 0; k < 8; ++k) sum += this.mGenes[cBase + k];
        if (sum > 0) for (var l = 0; l < 8; ++l) this.mGenes[cBase + l] /= sum;
    };

    SimulatedEvolutionGPU.prototype._spawnMicrobe = function (parentIdx) {
        // Initial spawn: random cell. Reproduction: daughter inherits the
        // mother's cell — both then share the cell and compete for its food.
        // No occupancy check needed (multi-occupancy is allowed).
        var idx = this._allocSlot();
        if (idx < 0) return -1;
        this.mAlive[idx]    = 1;
        this.microbeNum += 1;

        if (parentIdx < 0) {
            this.mX[idx]      = (Math.random() * this.cellsX) | 0;
            this.mY[idx]      = (Math.random() * this.cellsY) | 0;
            this.mDir[idx]    = (Math.random() * 8) | 0;
            this.mEnergy[idx] = this.microbeNum + 100;
            this.mAge[idx]    = 0;
            this._randomGenes(idx);
        } else {
            this.mX[idx]      = this.mX[parentIdx];
            this.mY[idx]      = this.mY[parentIdx];
            this.mDir[idx]    = (Math.random() * 8) | 0;
            this.mEnergy[idx] = (this.mEnergy[parentIdx] / 2) | 0;
            this.mAge[idx]    = 0;
            this._mutateGenesInto(idx, parentIdx);
            this.mEnergy[parentIdx] = (this.mEnergy[parentIdx] / 2) | 0;
        }
        return idx;
    };

    SimulatedEvolutionGPU.prototype.reset = function () {
        this._resetPool();
        this.food.fill(0);
        this.foodGrowAcc.fill(0);
        this.costMap.fill(0);
        if (this.spawnStrategy === 3) this._writeBandsToCostMap();
        this._initPointSources();
        this._initMixPointSources();
        this._clearSelection();
        // View-Transform zurück auf Default (kompletter Welt-Blick) — Pan/Zoom
        // sind UI-Zustand, der zu einer frischen Simulation logisch dazugehört.
        this.viewZoom    = 1;
        this.viewCenterX = 0.5;
        this.viewCenterY = 0.5;

        // Restart the moving-rectangle source at the centre of the domain,
        // with velocity 0 — the ramp in _spawnFoodMovingRect grows it from
        // there. movRectDirSign back to +1 so the first half-cycle drifts
        // along +target.
        this.movRectX  = this.cellsX / 2;
        this.movRectY  = this.cellsY / 2;
        this.movRectTick    = 0;
        this.movRectVx      = 0;
        this.movRectVy      = 0;
        this.movRectDirSign = 1;

        for (var i = 0; i < this.initialMicrobes; ++i) this._spawnMicrobe(-1);
        for (var j = 0; j < this.initialFood; ++j) {
            this._putFood(
                (Math.random() * this.cellsX) | 0,
                (Math.random() * this.cellsY) | 0
            );
        }
    };

    SimulatedEvolutionGPU.prototype._putFood = function (x, y) {
        if (x < 0 || x >= this.cellsX || y < 0 || y >= this.cellsY) return;
        // Food is additive — repeated spawns on the same cell stack up to a
        // hard cap of 255 (Uint8 limit). Each deposit adds one "portion" worth
        // of energy (energyPerFood). A microbe still eats only one portion per
        // tick, so fat cells get harvested over multiple ticks.
        var i = y * this.cellsX + x;
        var v = this.food[i] + this.energyPerFood;
        this.food[i] = v > 255 ? 255 : v;
    };

    SimulatedEvolutionGPU.prototype._spawnFoodNormal = function () {
        for (var i = 0; i < this.foodSpawnPerTick; ++i) {
            this._putFood(
                (Math.random() * this.cellsX) | 0,
                (Math.random() * this.cellsY) | 0
            );
        }
    };

    SimulatedEvolutionGPU.prototype._spawnFoodBox = function () {
        var cx = this.cellsX >> 1, cy = this.cellsY >> 1;
        var w = this.cellsX >> 3, h = this.cellsY >> 3;
        for (var j = 0; j < this.foodSpawnPerTick; ++j) {
            var bx = (cx + Math.random() * w - w / 2) | 0;
            var by = (cy + Math.random() * h - h / 2) | 0;
            this._putFood(bx, by);
        }
        // Hintergrund-Sprenkel: 1/10 der Box-Rate, gleichverteilt über das
        // gesamte Feld — damit liegt auch außerhalb des Rechtecks ein dünner
        // Nahrungsstrom an, der Mikroben außerhalb der zentralen Oase nicht
        // sofort verhungern lässt.
        var nBg = (this.foodSpawnPerTick * 0.1) | 0;
        for (var k = 0; k < nBg; ++k) {
            this._putFood(
                (Math.random() * this.cellsX) | 0,
                (Math.random() * this.cellsY) | 0
            );
        }
    };

    // Generate the fixed paired point sources. Called from reset() so each
    // run gets a different deterministic-within-run layout.
    SimulatedEvolutionGPU.prototype._initPointSources = function () {
        var cellsX = this.cellsX, cellsY = this.cellsY;
        var xs = this.pointSourcesX, ys = this.pointSourcesY;
        var n  = this.pointSourceCount;
        for (var i = 0; i < n; ++i) {
            var x = (Math.random() * cellsX) | 0;
            var y = (Math.random() * cellsY) | 0;
            var d = (Math.random() * 8) | 0;
            var nx = x + MOTION[d * 2];
            var ny = y + MOTION[d * 2 + 1];
            if (nx < 0) nx = cellsX - 1; else if (nx >= cellsX) nx = 0;
            if (ny < 0) ny = cellsY - 1; else if (ny >= cellsY) ny = 0;
            xs[2 * i]     = x;
            ys[2 * i]     = y;
            xs[2 * i + 1] = nx;
            ys[2 * i + 1] = ny;
        }
    };

    // Punktquellen mode: same as "Gleichverteilt" plus each tick a deposit
    // at every cell of every pair-source. With energyPerFood = 40 (default),
    // every source cell receives +40 per tick (Uint8-capped at 255), so the
    // sources fill up fast and then act as continuous food fountains.
    SimulatedEvolutionGPU.prototype._spawnFoodPoints = function () {
        this._spawnFoodNormal();
        var xs = this.pointSourcesX, ys = this.pointSourcesY;
        for (var i = 0, n = xs.length; i < n; ++i) {
            this._putFood(xs[i], ys[i]);
        }
    };

    // Generate point sources for the Mix mode — same paired-cell layout as
    // _initPointSources, but every source sits inside the bottom-right
    // quadrant. Neighbours that would land outside the quadrant are clamped
    // to its edge instead of wrapping toroidally — toroidal wrap would put
    // some "bottom-right" cells back into the lines or box zones.
    SimulatedEvolutionGPU.prototype._initMixPointSources = function () {
        var cellsX = this.cellsX, cellsY = this.cellsY;
        var x0 = cellsX >> 1, y0 = cellsY >> 1;
        var w  = cellsX - x0, h  = cellsY - y0;
        var xs = this.mixPointSourcesX, ys = this.mixPointSourcesY;
        var n  = this.pointSourceCount;
        for (var i = 0; i < n; ++i) {
            var x = x0 + ((Math.random() * w) | 0);
            var y = y0 + ((Math.random() * h) | 0);
            var d  = (Math.random() * 8) | 0;
            var nx = x + MOTION[d * 2];
            var ny = y + MOTION[d * 2 + 1];
            if (nx < x0)         nx = x0;
            else if (nx >= cellsX) nx = cellsX - 1;
            if (ny < y0)         ny = y0;
            else if (ny >= cellsY) ny = cellsY - 1;
            xs[2 * i]     = x;
            ys[2 * i]     = y;
            xs[2 * i + 1] = nx;
            ys[2 * i + 1] = ny;
        }
    };

    // Mix strategy: domain is split 50/50 horizontally. Left half = square
    // line grid (lines confined to x ∈ [0, cellsX/2]). Top-right quadrant
    // = central food box (mirrors _spawnFoodBox scaled to the quadrant).
    // Bottom-right quadrant = continuous point-source pumps from
    // mixPointSourcesX/Y (1000 paired sources, populated in
    // _initMixPointSources). A small uniform sprinkle still runs across the
    // whole domain so dead zones aren't completely barren.
    SimulatedEvolutionGPU.prototype._spawnFoodMix = function () {
        var cellsX = this.cellsX, cellsY = this.cellsY;
        var halfX = cellsX >> 1, halfY = cellsY >> 1;
        var perTick = this.foodSpawnPerTick;

        var sprinkle = Math.max(1, perTick / 10) | 0;
        for (var i = 0; i < sprinkle; ++i) {
            this._putFood(
                (Math.random() * cellsX) | 0,
                (Math.random() * cellsY) | 0
            );
        }

        // Left half — square grid. Spacing chosen so the grid cells are
        // visually square (cellPx is isotropic).
        var spacing = Math.max(20, Math.round(Math.min(halfX, cellsY) / 5));
        var vCount = Math.max(2, Math.floor(halfX  / spacing));
        var hCount = Math.max(2, Math.floor(cellsY / spacing));
        var totalLines = vCount + hCount;
        for (var k = 0; k < perTick; ++k) {
            var li = (Math.random() * totalLines) | 0;
            if (li < vCount) {
                var lx = Math.round((li + 0.5) * halfX / vCount);
                this._putFood(lx, (Math.random() * cellsY) | 0);
            } else {
                var ly = Math.round((li - vCount + 0.5) * cellsY / hCount);
                this._putFood((Math.random() * halfX) | 0, ly);
            }
        }

        // Top-right quadrant — central box scaled to the quadrant.
        var cxB = halfX + (halfX >> 1);
        var cyB = halfY >> 1;
        var wB  = halfX >> 3;
        var hB  = halfY >> 3;
        for (var j = 0; j < perTick; ++j) {
            var bx = (cxB + Math.random() * wB - wB / 2) | 0;
            var by = (cyB + Math.random() * hB - hB / 2) | 0;
            this._putFood(bx, by);
        }

        // Bottom-right quadrant — point-source pumps.
        var xs = this.mixPointSourcesX, ys = this.mixPointSourcesY;
        for (var p = 0, n = xs.length; p < n; ++p) {
            this._putFood(xs[p], ys[p]);
        }
    };

    SimulatedEvolutionGPU.prototype._spawnFoodLines = function () {
        // Light uniform background sprinkle so areas outside the lines still
        // host the occasional microbe.
        var sprinkle = Math.max(1, this.foodSpawnPerTick / 10) | 0;
        for (var i = 0; i < sprinkle; ++i) {
            this._putFood(
                (Math.random() * this.cellsX) | 0,
                (Math.random() * this.cellsY) | 0
            );
        }
        // Grid of evenly-spaced horizontal & vertical lines covering the whole
        // domain. With numLines=5 the lines sit at 10/30/50/70/90 % of each axis.
        var numLines = 5;
        for (var k = 0; k < this.foodSpawnPerTick; ++k) {
            var lineIdx = (Math.random() * numLines) | 0;
            if (Math.random() < 0.5) {
                var y = Math.round((lineIdx + 0.5) * this.cellsY / numLines);
                this._putFood((Math.random() * this.cellsX) | 0, y);
            } else {
                var x = Math.round((lineIdx + 0.5) * this.cellsX / numLines);
                this._putFood(x, (Math.random() * this.cellsY) | 0);
            }
        }
    };

    // Moving-circle mode (historically "moving rectangle" — variable names
    // kept). A small circular patch drifts diagonally across the domain with
    // toroidal wrap; periodic drift reversal (every movRectReversePeriod
    // ticks) flips the direction by 180°. Patch radius is *constant* (no
    // shrinking ramp) — the spawn-circle starts at its final size.
    //
    // Toxic geometry is *static* bands flanking the patch's path. They are
    // precomputed at startup from the pathDistMap (perpendicular distance to
    // the diagonal path line) and written into the cost map (Uint8); each
    // band cell adds `ringHostility` energy drain per tick when a microbe
    // stands on it. Inner band edge = rIn (so the bands never enter the
    // patch's movement zone), outer edge = side. Bands are static, so they
    // don't punish microbes that have the right drift gene — they only
    // punish perpendicular drift away from the path.
    //
    // Per-tick work here: velocity ramp + position update, food spawn inside
    // the patch, food erase in a small box around the patch (cells outside
    // the spawn circle but in the box). The cost map is rewritten only every
    // 64 ticks (cheap full-grid threshold pass) to pick up live UI changes
    // to ringHostility.
    SimulatedEvolutionGPU.prototype._spawnFoodMovingRect = function () {
        // Drift flip every movRectReversePeriod ticks (full 180° U-turn).
        if (this.movRectTick > 0 && (this.movRectTick % this.movRectReversePeriod) === 0) {
            this.movRectDirSign = -this.movRectDirSign;
        }
        var progress = this.movRectTick / this.movRectRampTicks;
        if (progress > 1) progress = 1;
        var sign = this.movRectDirSign;
        this.movRectVx = this.movRectTargetVx * progress * sign;
        this.movRectVy = this.movRectTargetVy * progress * sign;
        this.movRectTick += 1;

        this.movRectX = (this.movRectX + this.movRectVx + this.cellsX) % this.cellsX;
        this.movRectY = (this.movRectY + this.movRectVy + this.cellsY) % this.cellsY;

        var rIn  = this._patchRIn();
        var rIn2 = rIn * rIn;
        var cx = this.movRectX | 0, cy = this.movRectY | 0;
        var cellsX = this.cellsX, cellsY = this.cellsY;

        // Random food deposits inside the spawn circle (rejection-sample in
        // the unit disk, scale by rIn).
        var spawns = this.foodSpawnPerTick * 20;
        for (var i = 0; i < spawns; ++i) {
            var ux, uy;
            do {
                ux = Math.random() * 2 - 1;
                uy = Math.random() * 2 - 1;
            } while (ux * ux + uy * uy > 1);
            var bx = (cx + ux * rIn) | 0;
            var by = (cy + uy * rIn) | 0;
            bx = (bx + cellsX) % cellsX;
            by = (by + cellsY) % cellsY;
            this._putFood(bx, by);
        }

        // Box around patch: clear food + acc for cells outside the spawn
        // circle. Cost is NOT touched here — band cells in the box must keep
        // their static hostility value.
        var food = this.food;
        var acc  = this.foodGrowAcc;
        var box  = Math.ceil(rIn) + 2;
        for (var dy = -box; dy <= box; ++dy) {
            var dy2 = dy * dy;
            var ey  = (cy + dy + cellsY) % cellsY;
            var row = ey * cellsX;
            for (var dx = -box; dx <= box; ++dx) {
                var d2 = dx * dx + dy2;
                if (d2 <= rIn2) continue;
                var ex = (cx + dx + cellsX) % cellsX;
                var ei = row + ex;
                food[ei] = 0;
                acc[ei]  = 0;
            }
        }

        // Periodic refresh of the band cost map (picks up live UI changes
        // to ringHostility). Bands themselves are geometrically static.
        if ((this.movRectTick & 63) === 0) this._writeBandsToCostMap();
    };

    // Constant patch radius — no shrinking ramp.
    SimulatedEvolutionGPU.prototype._patchRIn = function () {
        var side = Math.max(2, Math.round(Math.min(this.cellsX, this.cellsY) / 16 * 1.32));
        return side * 0.375;
    };

    // Perpendicular distance from each cell to the path line through
    // (initialCx, initialCy) with direction (targetVx, targetVy). Uses
    // shorter-wrap toroidal dx/dy — approximates the toroidal min-distance
    // well enough for the band threshold check (cells near the wrap seam
    // may be misclassified by a few cells but the bulk of the grid is
    // accurate). Computed once in _allocPool; values don't change unless
    // grid size or target direction change.
    SimulatedEvolutionGPU.prototype._initPathDistMap = function () {
        var cellsX = this.cellsX, cellsY = this.cellsY;
        if (!this.pathDistMap || this.pathDistMap.length !== cellsX * cellsY) {
            this.pathDistMap = new Float32Array(cellsX * cellsY);
        }
        var vx = this.movRectTargetVx, vy = this.movRectTargetVy;
        var vmag = Math.sqrt(vx * vx + vy * vy);
        var nx = vx / vmag, ny = vy / vmag;
        // Path passes through the centre — same point reset() places the
        // patch at, so the bands and the patch's trajectory are aligned.
        var cx0 = cellsX / 2, cy0 = cellsY / 2;
        var halfX = cellsX / 2, halfY = cellsY / 2;
        var map = this.pathDistMap;
        for (var y = 0; y < cellsY; ++y) {
            var dy = y - cy0;
            if (dy >  halfY) dy -= cellsY;
            else if (dy < -halfY) dy += cellsY;
            var row = y * cellsX;
            for (var x = 0; x < cellsX; ++x) {
                var dx = x - cx0;
                if (dx >  halfX) dx -= cellsX;
                else if (dx < -halfX) dx += cellsX;
                // Perpendicular component = dx·ny − dy·nx.
                var perp = dx * ny - dy * nx;
                map[row + x] = perp < 0 ? -perp : perp;
            }
        }
    };

    // Write `ringHostility` into cells whose perp distance to the path is in
    // (rIn, rOut], 0 elsewhere. Static geometry — rIn and rOut don't change
    // across ticks; this is called on (re)setup and periodically to pick up
    // ringHostility UI tweaks.
    SimulatedEvolutionGPU.prototype._writeBandsToCostMap = function () {
        if (!this.pathDistMap) return;
        var hostility = this.ringHostility | 0;
        if (hostility < 0)   hostility = 0;
        if (hostility > 255) hostility = 255;
        var side = Math.max(2, Math.round(Math.min(this.cellsX, this.cellsY) / 16 * 1.32));
        var rIn  = this._patchRIn();
        var rOut = side;
        var dist = this.pathDistMap;
        var cost = this.costMap;
        for (var i = 0, n = cost.length; i < n; ++i) {
            var d = dist[i];
            cost[i] = (d > rIn && d <= rOut) ? hostility : 0;
        }
    };

    SimulatedEvolutionGPU.prototype._spawnFood = function () {
        if      (this.spawnStrategy === 1) this._spawnFoodLines();
        else if (this.spawnStrategy === 2) this._spawnFoodBox();
        else if (this.spawnStrategy === 3) this._spawnFoodMovingRect();
        else if (this.spawnStrategy === 4) this._spawnFoodPoints();
        else if (this.spawnStrategy === 5) this._spawnFoodMix();
        else                               this._spawnFoodNormal();
    };

    // Exponential per-cell growth: each non-empty cell's food is multiplied
    // by foodGrowthFactor every tick. A fractional accumulator bridges the
    // Uint8 quantisation so even small deposits grow instead of stagnating.
    // When a cell is already at the 255 cap, its would-be growth doesn't
    // vanish — it spills over into a randomly chosen non-full 8-neighbour
    // (mass-conserving). If all 8 neighbours are also full, the surplus is
    // discarded ("rots in place").
    SimulatedEvolutionGPU.prototype._growFood = function () {
        var f       = this.food;
        var acc     = this.foodGrowAcc;
        var delta   = this.foodGrowthFactor - 1;
        if (delta <= 0) return;
        var cellsX  = this.cellsX;
        var cellsY  = this.cellsY;
        var N       = f.length;
        var order   = this._nbOrder || (this._nbOrder = new Uint8Array([0,1,2,3,4,5,6,7]));

        for (var i = 0; i < N; ++i) {
            var v = f[i];
            if (v === 0) { acc[i] = 0; continue; }

            var a = acc[i] + v * delta;
            var add = a | 0;
            if (add <= 0) { acc[i] = a; continue; }

            if (v < 255) {
                v += add;
                if (v > 255) v = 255;
                f[i] = v;
                acc[i] = a - add;
                continue;
            }

            // Spill-over: donate `add` units to a random non-full neighbour.
            var y = (i / cellsX) | 0;
            var x = i - y * cellsX;
            for (var s = 7; s > 0; --s) {
                var ri = (Math.random() * (s + 1)) | 0;
                var tmp = order[s]; order[s] = order[ri]; order[ri] = tmp;
            }
            var placed = false;
            for (var k = 0; k < 8; ++k) {
                var d  = order[k];
                var nx = x + MOTION[d * 2];
                var ny = y + MOTION[d * 2 + 1];
                if (nx >= cellsX) nx = 0; else if (nx < 0) nx = cellsX - 1;
                if (ny >= cellsY) ny = 0; else if (ny < 0) ny = cellsY - 1;
                var nfidx = ny * cellsX + nx;
                if (f[nfidx] < 255) {
                    var nv = f[nfidx] + add;
                    f[nfidx] = nv > 255 ? 255 : nv;
                    acc[i] = a - add;
                    placed = true;
                    break;
                }
            }
            if (!placed) acc[i] = 0;
        }
    };

    SimulatedEvolutionGPU.prototype._tick = function () {
        this._growFood();
        this._spawnFood();

        var N      = this.maxMicrobes;
        var cellsX = this.cellsX;
        var cellsY = this.cellsY;
        var food   = this.food;
        var cost   = this.costMap;
        var energyMax         = this.energyMax;
        var energyPerFood     = this.energyPerFood;
        var energyToReproduce = this.energyToReproduce;
        var energyPerTick     = this.energyPerTick;

        for (var idx = 0; idx < N; ++idx) {
            if (this.mAlive[idx] === 0 || this.mBornThisTick[idx]) continue;

            this.mAge[idx]    += 1;
            this.mEnergy[idx] -= energyPerTick;

            var dir = this.mDir[idx];
            var oldX = this.mX[idx];
            var oldY = this.mY[idx];
            var nx = oldX + MOTION[dir * 2];
            var ny = oldY + MOTION[dir * 2 + 1];
            if (nx >= cellsX) nx = 0; else if (nx < 0) nx = cellsX - 1;
            if (ny >= cellsY) ny = 0; else if (ny < 0) ny = cellsY - 1;

            // Eat food on current cell. Per-tick bite is capped at
            // energyPerFood AND at the microbe's remaining headroom — satt
            // microbes leave everything; partial nibbles leave the rest for
            // later (or another microbe).
            var fidx = ny * cellsX + nx;
            if (food[fidx] > 0 && this.mEnergy[idx] < energyMax) {
                var headroom = energyMax - this.mEnergy[idx];
                var bite = food[fidx];
                if (bite > energyPerFood) bite = energyPerFood;
                if (bite > headroom)      bite = headroom;
                this.mEnergy[idx] += bite;
                food[fidx]        -= bite;
                if (food[fidx] === 0) this.foodGrowAcc[fidx] = 0;
            }
            // Hostility map: extra per-tick drain encoded as Uint8. 0 = no
            // effect (default), so this is a no-op outside the moving-circle's
            // toxic ring.
            this.mEnergy[idx] -= cost[fidx];

            // Sample next relative turn (0..7) by roulette over the 8 genes.
            var rnd = Math.random();
            var sum = 0;
            var gBase = idx * 8;
            var actionIdx = 7;
            for (var i = 0; i < 8; ++i) {
                sum += this.mGenes[gBase + i];
                if (rnd < sum) { actionIdx = i; break; }
            }
            this.mDir[idx]     = (dir + actionIdx) & 7;
            this.mEnergy[idx] -= STEERING_COST[actionIdx];

            this.mX[idx] = nx;
            this.mY[idx] = ny;

            if (this.mEnergy[idx] < 0) {
                this._freeSlot(idx);
            } else if (this.mEnergy[idx] > energyToReproduce) {
                var childIdx = this._spawnMicrobe(idx);
                if (childIdx >= 0) this.mBornThisTick[childIdx] = 1;
            }
        }

        this.mBornThisTick.fill(0);
    };

    SimulatedEvolutionGPU.prototype._setupDom = function () {
        var parent = document.getElementById(this.cvid);
        parent.style.position = 'relative';
        parent.style.display  = 'block';
        parent.style.width    = '100%';
        parent.style.height   = '100%';

        this.canvas = document.createElement('canvas');
        this.canvas.width  = this.width;
        this.canvas.height = this.height;
        this.canvas.style.position = 'absolute';
        this.canvas.style.inset    = '0';
        this.canvas.style.width    = '100%';
        this.canvas.style.height   = '100%';
        this.canvas.style.display  = 'block';
        parent.appendChild(this.canvas);

        // 2D overlay on top of the WebGL canvas for the genome compass.
        // pointer-events:none lets fullscreen and other clicks pass through.
        this.overlay = document.createElement('canvas');
        this.overlay.width  = this.width;
        this.overlay.height = this.height;
        this.overlay.style.position      = 'absolute';
        this.overlay.style.inset         = '0';
        this.overlay.style.width         = '100%';
        this.overlay.style.height        = '100%';
        this.overlay.style.display       = 'block';
        this.overlay.style.pointerEvents = 'none';
        parent.appendChild(this.overlay);
        this.octx = this.overlay.getContext('2d');
    };

    SimulatedEvolutionGPU.prototype._setupGL = function () {
        var gl = this.canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
        if (!gl) throw new Error('WebGL2 not supported');
        this.gl = gl;

        this.progFood     = makeProgram(gl, VS_FOOD,     FS_FOOD);
        this.progMicrobes = makeProgram(gl, VS_MICROBES, FS_MICROBES);

        this.locFood = {
            aPos:        gl.getAttribLocation (this.progFood, 'aPos'),
            uFood:       gl.getUniformLocation(this.progFood, 'uFood'),
            uCost:       gl.getUniformLocation(this.progFood, 'uCost'),
            uColorFood:  gl.getUniformLocation(this.progFood, 'uColorFood'),
            uColorBack:  gl.getUniformLocation(this.progFood, 'uColorBack'),
            uViewCenter: gl.getUniformLocation(this.progFood, 'uViewCenter'),
            uViewZoom:   gl.getUniformLocation(this.progFood, 'uViewZoom')
        };
        this.locMicro = {
            aPos:        gl.getAttribLocation (this.progMicrobes, 'aPos'),
            aHSV:        gl.getAttribLocation (this.progMicrobes, 'aHSV'),
            uCells:      gl.getUniformLocation(this.progMicrobes, 'uCells'),
            uPointSize:  gl.getUniformLocation(this.progMicrobes, 'uPointSize'),
            uShowBorder: gl.getUniformLocation(this.progMicrobes, 'uShowBorder'),
            uViewCenter: gl.getUniformLocation(this.progMicrobes, 'uViewCenter'),
            uViewZoom:   gl.getUniformLocation(this.progMicrobes, 'uViewZoom')
        };

        // Fullscreen quad for the food pass.
        var quad = new Float32Array([-1,-1,  1,-1, -1, 1,  -1, 1,  1,-1,  1, 1]);
        this.quadVAO = gl.createVertexArray();
        gl.bindVertexArray(this.quadVAO);
        var quadVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.locFood.aPos);
        gl.vertexAttribPointer(this.locFood.aPos, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);

        // Per-microbe vertex buffer (positions + HSV, re-uploaded each frame).
        // Stride 20 = 5 floats: pos (vec2) at offset 0, hsv (vec3) at offset 8.
        this.microbeVAO = gl.createVertexArray();
        gl.bindVertexArray(this.microbeVAO);
        this.microbeVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.microbeVBO);
        gl.bufferData(gl.ARRAY_BUFFER, this.maxMicrobes * 5 * 4, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.locMicro.aPos);
        gl.vertexAttribPointer(this.locMicro.aPos, 2, gl.FLOAT, false, 20, 0);
        gl.enableVertexAttribArray(this.locMicro.aHSV);
        gl.vertexAttribPointer(this.locMicro.aHSV, 3, gl.FLOAT, false, 20, 8);
        gl.bindVertexArray(null);

        // Food texture (R8, one byte per cell). Allocated empty here; reset()
        // populates the backing array and the first frame uploads it.
        this.food = new Uint8Array(this.cellsX * this.cellsY);
        this.foodTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.foodTex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this.cellsX, this.cellsY, 0,
                      gl.RED, gl.UNSIGNED_BYTE, this.food);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Cost (hostility) texture: same layout as food. Re-uploaded each
        // frame from this.costMap.
        this.costTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.costTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this.cellsX, this.cellsY, 0,
                      gl.RED, gl.UNSIGNED_BYTE, this.costMap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.pointSizePx = this.microbeCells * this.cellPx;
    };

    SimulatedEvolutionGPU.prototype._packRenderBuffer = function () {
        // Pack each alive microbe as (x, y, hue, sat, val). Hue/sat come from
        // the *turn* genes only (indices 1..7) — gene[0] (go straight) is
        // close to 1 for almost every microbe, so including it would wash all
        // colours into the same forward-axis hue. Excluding it lets the much
        // subtler turn-preference differences (which is where selection
        // actually plays out) drive the colouring. Magnitudes are normalised
        // by the turn-gene sum so a microbe's hue reflects *which* turn it
        // prefers, regardless of how rarely it turns at all. Value is fixed
        // at 1; the complementary 1-px border keeps grey (isotropic) microbes
        // visible against any background.
        var n = 0;
        var N = this.maxMicrobes;
        var INV_2PI = 1.0 / (2 * Math.PI);
        var mode = this.colorMode;
        // Reference values for the age/energy ramps. Age normalises against the
        // current oldest microbe so the contrast tracks the live population
        // rather than absolute tick count. Energy uses energyMax so the ramp
        // matches the "Ø Energie" readout in the overlay.
        var ageRef = this._maxAge || 1;
        if (ageRef < 1) ageRef = 1;
        var invAgeRef = 1 / ageRef;
        var invEnergyMax = 1 / this.energyMax;

        for (var idx = 0; idx < N; ++idx) {
            if (this.mAlive[idx] === 0) continue;

            var hue, sat, val;
            if (mode === 1) {
                // Age mode: young = blue (cool), old = red (hot).
                var aNorm = this.mAge[idx] * invAgeRef;
                if (aNorm > 1) aNorm = 1;
                hue = (1 - aNorm) * 0.67;
                sat = 1;
                val = 1;
            } else if (mode === 2) {
                // Energy mode: low = red, high = blue. Same 0..0.67 hue ramp
                // as the "Ø Energie" readout, for visual consistency.
                var eNorm = this.mEnergy[idx] * invEnergyMax;
                if (eNorm > 1) eNorm = 1;
                else if (eNorm < 0) eNorm = 0;
                hue = eNorm * 0.67;
                sat = 1;
                val = 1;
            } else {
                // Genome-drift mode (default): hue from turn-gene drift vector.
                var base = idx * 8;
                var turnSum = 0;
                var vx = 0, vy = 0;
                for (var i = 1; i < 8; ++i) {
                    var g = this.mGenes[base + i];
                    turnSum += g;
                    vx += g * DIR_UV[i * 2];
                    vy += g * DIR_UV[i * 2 + 1];
                }
                hue = 0;
                sat = 0;
                if (turnSum > 1e-6) {
                    vx /= turnSum;
                    vy /= turnSum;
                    var mag = Math.sqrt(vx * vx + vy * vy);
                    if (mag > 1) mag = 1;
                    hue = Math.atan2(vy, vx) * INV_2PI + 0.5;
                    if (hue >= 1) hue -= 1;
                    sat = mag;
                }
                val = 1;
            }

            this.renderXY[5 * n    ] = this.mX[idx];
            this.renderXY[5 * n + 1] = this.mY[idx];
            this.renderXY[5 * n + 2] = hue;
            this.renderXY[5 * n + 3] = sat;
            this.renderXY[5 * n + 4] = val;
            n++;
        }
        return n;
    };

    SimulatedEvolutionGPU.prototype._render = function () {
        var gl = this.gl;

        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

        // Upload food grid.
        gl.bindTexture(gl.TEXTURE_2D, this.foodTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.cellsX, this.cellsY,
                         gl.RED, gl.UNSIGNED_BYTE, this.food);

        // Upload cost (hostility) grid.
        gl.bindTexture(gl.TEXTURE_2D, this.costTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.cellsX, this.cellsY,
                         gl.RED, gl.UNSIGNED_BYTE, this.costMap);

        gl.viewport(0, 0, this.width, this.height);
        gl.disable(gl.BLEND);

        // Food background pass.
        gl.useProgram(this.progFood);
        gl.uniform1i(this.locFood.uFood, 0);
        gl.uniform1i(this.locFood.uCost, 1);
        gl.uniform3fv(this.locFood.uColorFood, this.colFood);
        gl.uniform3fv(this.locFood.uColorBack, this.colBack);
        gl.uniform2f(this.locFood.uViewCenter, this.viewCenterX, this.viewCenterY);
        gl.uniform1f(this.locFood.uViewZoom,   this.viewZoom);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.foodTex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.costTex);
        gl.bindVertexArray(this.quadVAO);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Microbe pass.
        var n = this._packRenderBuffer();
        if (n > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.microbeVBO);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.renderXY.subarray(0, n * 5));

            gl.useProgram(this.progMicrobes);
            gl.uniform2f(this.locMicro.uCells, this.cellsX, this.cellsY);
            gl.uniform1f(this.locMicro.uPointSize, this.pointSizePx);
            gl.uniform2f(this.locMicro.uViewCenter, this.viewCenterX, this.viewCenterY);
            gl.uniform1f(this.locMicro.uViewZoom,   this.viewZoom);
            // Only the genome colour-mode benefits from the complementary
            // border (which encodes "isotropic genome"). Age/energy ramps lose
            // their gradient when half the sprite is the complement colour, so
            // those modes draw the inner colour flat across the whole sprite.
            gl.uniform1f(this.locMicro.uShowBorder, this.colorMode === 0 ? 1.0 : 0.0);
            gl.bindVertexArray(this.microbeVAO);
            gl.drawArrays(gl.POINTS, 0, n);
        }

        gl.bindVertexArray(null);
    };

    // Per-frame stats over all alive microbes: mean genes, mean/max age, mean
    // energy. Results stored on `this` so both the overlay and the render
    // packer (age/energy colour modes) can read them without re-iterating.
    SimulatedEvolutionGPU.prototype._computeStats = function () {
        var mean = this._meanGenes || (this._meanGenes = new Float32Array(8));
        for (var i = 0; i < 8; ++i) mean[i] = 0;
        var n = 0;
        var energySum = 0;
        var ageSum = 0;
        var ageMax = 0;
        var N = this.maxMicrobes;
        for (var idx = 0; idx < N; ++idx) {
            if (this.mAlive[idx] === 0) continue;
            var base = idx * 8;
            for (var g = 0; g < 8; ++g) mean[g] += this.mGenes[base + g];
            energySum += this.mEnergy[idx];
            var a = this.mAge[idx];
            ageSum += a;
            if (a > ageMax) ageMax = a;
            n++;
        }
        if (n > 0) for (var k = 0; k < 8; ++k) mean[k] /= n;
        this._meanEnergy = n > 0 ? energySum / n : 0;
        this._meanAge    = n > 0 ? ageSum    / n : 0;
        this._maxAge     = ageMax;
    };

    // Direction arrows for genes 0..7 (CW from N), matching the rotational
    // MOTION table. Drawn under each bar so the gene index and physical
    // direction are visible together.
    var GENE_DIR_LABEL = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

    // Per-frame stats over only the selected subset. Mirrors _computeStats
    // but iterates `selected` instead of all alive microbes. Reuses cached
    // typed arrays so the per-frame allocation cost stays at zero.
    SimulatedEvolutionGPU.prototype._computeSelectionStats = function () {
        var mean = this._selMeanGenes || (this._selMeanGenes = new Float32Array(8));
        for (var i = 0; i < 8; ++i) mean[i] = 0;
        var n = 0, eSum = 0, aSum = 0, aMax = 0;
        var N = this.maxMicrobes;
        var sel = this.selected;
        for (var idx = 0; idx < N; ++idx) {
            if (!sel[idx] || !this.mAlive[idx]) continue;
            var base = idx * 8;
            for (var g = 0; g < 8; ++g) mean[g] += this.mGenes[base + g];
            eSum += this.mEnergy[idx];
            var a = this.mAge[idx];
            aSum += a;
            if (a > aMax) aMax = a;
            n++;
        }
        if (n > 0) for (var k = 0; k < 8; ++k) mean[k] /= n;
        this._selMeanEnergy = n > 0 ? eSum / n : 0;
        this._selMeanAge    = n > 0 ? aSum / n : 0;
        this._selMaxAge     = aMax;
        this._selLiveCount  = n;
    };

    // Bar chart of mean gene probabilities. With uniform random behavior every
    // bar sits at 1/8 ≈ 0.125 — the dashed reference line makes deviations
    // from the random baseline obvious at a glance.
    SimulatedEvolutionGPU.prototype._drawGenomeOverlay = function () {
        var ctx = this.octx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Pan-Hinweis nur sichtbar, solange wirklich hineingezoomt wird;
        // bei zoom=1 ist Pan ohnehin no-op und ein Hinweis wäre Lärm.
        if (this.viewZoom > 1.001) this._drawZoomHint();

        // Rubberband-Rechteck zuerst, damit es auch sichtbar bleibt, wenn
        // gleich ein early return wegen leerer Welt kommt.
        if (this.dragActive) this._drawRubberband();

        if (this.microbeNum === 0) return;

        // Selection branches: 0 → population mode, 1 → single inspection,
        // N → aggregate over the selected subset.
        var singleSel = this._singleSelIdx();
        var multiSel  = this.selectedCount > 1;

        var genes, title;
        if (singleSel >= 0) {
            if (!this._selGenes) this._selGenes = new Float32Array(8);
            var gBase = singleSel * 8;
            for (var sg = 0; sg < 8; ++sg) this._selGenes[sg] = this.mGenes[gBase + sg];
            genes = this._selGenes;
            title = 'Mikrobe #' + singleSel + '  @ (' + this.mX[singleSel] + ',' + this.mY[singleSel] + ')';
        } else if (multiSel) {
            this._computeSelectionStats();
            genes = this._selMeanGenes;
            title = 'Auswahl: ' + this._selLiveCount + ' Mikroben';
        } else {
            genes = this._meanGenes;
            title = 'Ø Genom (' + this.microbeNum + ' Mikroben)';
        }
        // Backwards-compat alias — the radial chart and sprite code below still
        // reads `mean`. Same array reference, just renamed for the selection
        // branch to make sense at the top.
        var mean = genes;

        var pw = 280, ph = 320;
        var px = this.width - pw - 20;
        var py = 20;

        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

        ctx.fillStyle    = '#fff';
        ctx.font         = '14px Arial';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(title, px + pw / 2, py + 8);

        // Bar width preserved from the previous horizontal layout
        // (barStep = barAreaW / 8, barW = barStep * 0.75 with barAreaW = 226).
        var barW = 21;

        // Radial layout: bars radiate from the panel centre in their gene's
        // direction. Length encodes the mean gene weight. Below the chart
        // sits the population stats strip (mean energy / mean age / max age).
        var statsStripBot = py + ph - 8;
        var statsStripTop = statsStripBot - 54;

        var chartTop = py + 32;
        var chartBot = statsStripTop - 6;
        var cx       = px + pw / 2;
        var cy       = (chartTop + chartBot) / 2;
        var rMax     = Math.min(pw / 2 - 32, (chartBot - chartTop) / 2 - 10);
        // Bars start at rInner (free zone in the middle) and grow outward.
        // Inner zone hosts the magnified average-microbe sprite.
        var rInner   = 40;
        var barLenMax = rMax - rInner;

        // Scale: at least 0.3 (so the 1/8 ring sits comfortably mid-radius);
        // grow if any bar peaks higher than that.
        var yMax = 0.3;
        for (var i = 0; i < 8; ++i) if (mean[i] * 1.15 > yMax) yMax = mean[i] * 1.15;

        // Concentric reference rings at ½ yMax and yMax + their scale labels.
        ctx.strokeStyle  = 'rgba(255,255,255,0.12)';
        ctx.fillStyle    = '#aaa';
        ctx.font         = '10px Arial';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        for (var t = 1; t <= 2; ++t) {
            var rr  = rInner + barLenMax * t / 2;
            var val = yMax * t / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillText(val.toFixed(2), cx + 2, cy - rr);
        }

        // 1/8 reference ring (uniform-distribution expectation across 8 genes).
        var uniform = 1 / 8;
        var refR = rInner + barLenMax * (uniform / yMax);
        ctx.strokeStyle = 'rgba(255,200,80,0.75)';
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, refR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle    = 'rgba(255,200,80,0.95)';
        ctx.font         = '9px Arial';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('1/8', cx + 2, cy - refR);

        // Radial bars: gene b points in direction b * 45° (CW from north),
        // matching MOTION's rotational order. Bars start at rInner so the
        // panel centre stays free.
        for (var b = 0; b < 8; ++b) {
            var angle = b * Math.PI / 4;
            var len   = barLenMax * (mean[b] / yMax);
            var hue   = 120 - STEERING_COST[b] * 15;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.fillStyle = 'hsl(' + hue + ',75%,55%)';
            ctx.fillRect(-barW / 2, -(rInner + len), barW, len);
            ctx.restore();

            var dx = Math.sin(angle);
            var dy = -Math.cos(angle);

            // Value label just outside the bar tip.
            var vR = rInner + len + 10;
            ctx.fillStyle    = '#fff';
            ctx.font         = '10px Arial';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mean[b].toFixed(2), cx + dx * vR, cy + dy * vR);

            // Direction arrow on the outer ring.
            var labelR = rMax + 16;
            ctx.fillStyle    = '#ddd';
            ctx.font         = '13px Arial';
            ctx.fillText(GENE_DIR_LABEL[b], cx + dx * labelR, cy + dy * labelR);
        }

        // Magnified average-microbe sprite at the centre, painted with the
        // same HSV mapping that drives the live microbes (turn-gene drift →
        // hue/sat, val fixed at 1, RGB-complementary 2-px border).
        var avgTurnSum = 0, avx = 0, avy = 0;
        for (var ag = 1; ag < 8; ++ag) {
            var amg = mean[ag];
            avgTurnSum += amg;
            avx += amg * DIR_UV[ag * 2];
            avy += amg * DIR_UV[ag * 2 + 1];
        }
        var avgHue = 0, avgSat = 0;
        if (avgTurnSum > 1e-6) {
            avx /= avgTurnSum;
            avy /= avgTurnSum;
            var avgMag = Math.sqrt(avx * avx + avy * avy);
            if (avgMag > 1) avgMag = 1;
            avgHue = Math.atan2(avy, avx) / (2 * Math.PI) + 0.5;
            if (avgHue >= 1) avgHue -= 1;
            avgSat = avgMag;
        }
        var avgVal = 1;
        var inner  = hsv2rgbCSS(avgHue, avgSat, avgVal);
        var border = rgbComplementCSS(avgHue, avgSat, avgVal);

        var sprSize = 36;
        var sprBd   = 2;
        var sprX    = cx - sprSize / 2;
        var sprY    = cy - sprSize / 2;
        ctx.fillStyle = border;
        ctx.fillRect(sprX - sprBd, sprY - sprBd, sprSize + 2 * sprBd, sprSize + 2 * sprBd);
        ctx.fillStyle = inner;
        ctx.fillRect(sprX, sprY, sprSize, sprSize);

        // Population stats strip below the chart. Energy uses the same
        // 0..0.67 hue ramp as the energy colour mode; ages stay neutral white.
        var statRows;
        if (singleSel >= 0) {
            var selE     = this.mEnergy[singleSel];
            var selENorm = Math.max(0, Math.min(1, selE / this.energyMax));
            var selEHue  = selENorm * 0.67 * 360;
            statRows = [
                { label: 'Energie',  value: selE.toFixed(0),                 color: 'hsl(' + selEHue + ',100%,55%)' },
                { label: 'Alter',    value: this.mAge[singleSel].toFixed(0), color: '#fff' },
                { label: 'Richtung', value: GENE_DIR_LABEL[this.mDir[singleSel]], color: '#fff' }
            ];
        } else if (multiSel) {
            var smE     = this._selMeanEnergy || 0;
            var smENorm = Math.max(0, Math.min(1, smE / this.energyMax));
            var smEHue  = smENorm * 0.67 * 360;
            statRows = [
                { label: 'Ø Energie', value: smE.toFixed(0),                 color: 'hsl(' + smEHue + ',100%,55%)' },
                { label: 'Ø Alter',   value: (this._selMeanAge || 0).toFixed(0), color: '#fff' },
                { label: 'Max Alter', value: (this._selMaxAge  || 0).toFixed(0), color: '#fff' }
            ];
        } else {
            var meanE   = this._meanEnergy || 0;
            var meanA   = this._meanAge    || 0;
            var maxA    = this._maxAge     || 0;
            var eNorm   = Math.max(0, Math.min(1, meanE / this.energyMax));
            var eHueDeg = eNorm * 0.67 * 360;
            statRows = [
                { label: 'Ø Energie', value: meanE.toFixed(0), color: 'hsl(' + eHueDeg + ',100%,55%)' },
                { label: 'Ø Alter',   value: meanA.toFixed(0), color: '#fff' },
                { label: 'Max Alter', value: maxA.toFixed(0),  color: '#fff' }
            ];
        }
        var rowStep = (statsStripBot - statsStripTop) / statRows.length;
        ctx.textBaseline = 'middle';
        for (var sr = 0; sr < statRows.length; ++sr) {
            var rowY = statsStripTop + rowStep * (sr + 0.5);
            ctx.fillStyle = '#aaa';
            ctx.font      = '10px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(statRows[sr].label, cx - 4, rowY);
            ctx.fillStyle = statRows[sr].color;
            ctx.font      = 'bold 12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(statRows[sr].value, cx + 6, rowY);
        }

        if (singleSel >= 0) this._drawCrosshair(singleSel);
        else if (multiSel)  this._drawMultiSelectionMarkers();
    };

    // Pan-Hinweis im oberen Bereich des Canvas, sichtbar während zoom > 1.
    // Großer weißer Text mit dunklem Outline, damit er auf Nahrung und auf
    // dunklem Hintergrund gleich lesbar bleibt.
    SimulatedEvolutionGPU.prototype._drawZoomHint = function () {
        var ctx = this.octx;
        var text = 'Shift + left mouse to pan';
        var cx = this.width / 2;
        var cy = 38;

        ctx.save();
        ctx.font         = 'bold 28px Arial';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth    = 5;
        ctx.strokeStyle  = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeText(text, cx, cy);
        ctx.fillStyle    = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(text, cx, cy);
        ctx.restore();
    };

    // Helper: world cell coord → canvas pixel through view transform. Used by
    // every overlay primitive that draws on top of the GL-rendered world
    // (rubberband, crosshair, selection rings) so they track zoom/pan.
    SimulatedEvolutionGPU.prototype._cellToPx = function (cx, cy) {
        var sx = 0.5 + (cx / this.cellsX - this.viewCenterX) * this.viewZoom;
        var sy = 0.5 + (cy / this.cellsY - this.viewCenterY) * this.viewZoom;
        return { px: sx * this.width, py: sy * this.height };
    };

    // Rubberband-Rechteck in CSS-Pixel-Koordinaten. Wird jedes Frame neu
    // gezeichnet, solange dragActive ist — der Klar-Schritt am Anfang von
    // _drawGenomeOverlay räumt den alten Rahmen ab.
    SimulatedEvolutionGPU.prototype._drawRubberband = function () {
        // Pan-Modus zeichnet kein Rubberband (es ist gar keine Auswahl-Geste).
        if (this.dragMode === 'pan') return;
        var ctx = this.octx;
        var x0 = this.dragStartX, y0 = this.dragStartY;
        var x1 = this.dragCurX,   y1 = this.dragCurY;
        if (x0 > x1) { var tx = x0; x0 = x1; x1 = tx; }
        if (y0 > y1) { var ty = y0; y0 = y1; y1 = ty; }
        var p0 = this._cellToPx(x0, y0);
        var p1 = this._cellToPx(x1, y1);
        var px = p0.px, py = p0.py;
        var pw = p1.px - p0.px;
        var ph = p1.py - p0.py;
        if (pw < 1 && ph < 1) return;

        ctx.save();
        ctx.fillStyle   = 'rgba(255,255,255,0.10)';
        ctx.fillRect(px, py, pw, ph);
        ctx.lineWidth   = 1;
        // Doppel-Stroke (dunkel + hell, leicht versetztes Dash) damit der
        // Rahmen auf hellem Futter und dunklem Untergrund gleich lesbar ist.
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
        ctx.lineDashOffset = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
        ctx.restore();
    };

    // Marker für jede selektierte Mikrobe — kleiner Ring um das Sprite. Bei
    // |selection| === 1 übernimmt _drawCrosshair das vollständige Fadenkreuz;
    // ab 2 Mikroben wird's mit Fadenkreuzen unleserlich, deshalb nur Ringe.
    SimulatedEvolutionGPU.prototype._drawMultiSelectionMarkers = function () {
        var ctx = this.octx;
        // Sprite-Radius skaliert mit Zoom (genau wie das gerenderte Sprite im
        // GL-Pass über gl_PointSize * uViewZoom), damit der Ring auf jeder
        // Zoom-Stufe knapp ums Sprite sitzt.
        var spriteR = (this.pointSizePx * this.viewZoom) / 2;
        var r = spriteR + 3;
        var N = this.maxMicrobes;
        var sel = this.selected;

        ctx.save();
        // Zwei Pässe: dunkler Schatten zuerst, dann weiß darüber — bleibt auf
        // jedem Untergrund lesbar.
        for (var pass = 0; pass < 2; ++pass) {
            ctx.strokeStyle = pass === 0 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)';
            ctx.lineWidth   = pass === 0 ? 2.0 : 1.0;
            ctx.beginPath();
            for (var i = 0; i < N; ++i) {
                if (!sel[i] || !this.mAlive[i]) continue;
                var p = this._cellToPx(this.mX[i] + 0.5, this.mY[i] + 0.5);
                ctx.moveTo(p.px + r, p.py);
                ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
            }
            ctx.stroke();
        }
        ctx.restore();
    };

    // White crosshair around the currently selected microbe. Four short
    // strokes from outside the sprite outward + a thin outline rectangle on
    // the sprite itself — visible against any background and on top of the
    // overlay panel if they happen to overlap.
    SimulatedEvolutionGPU.prototype._drawCrosshair = function (idx) {
        var ctx = this.octx;
        var p = this._cellToPx(this.mX[idx] + 0.5, this.mY[idx] + 0.5);
        var cx = p.px, cy = p.py;
        // Sprite-Radius skaliert mit Zoom (siehe gl_PointSize * uViewZoom);
        // Fadenkreuz-Strichlängen sind dagegen fix in CSS-Pixeln — sonst
        // werden sie auf hohem Zoom unangenehm groß.
        var spriteR = (this.pointSizePx * this.viewZoom) / 2;
        var gap = spriteR + 3;
        var len = 18;

        ctx.save();
        ctx.lineWidth   = 1.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        // Drop-shadow stroke (rendered first, slightly thicker via two passes)
        // so the crosshair stays legible over bright food / pale microbes.
        for (var pass = 0; pass < 2; ++pass) {
            ctx.beginPath();
            ctx.moveTo(cx - gap - len, cy); ctx.lineTo(cx - gap, cy);
            ctx.moveTo(cx + gap,        cy); ctx.lineTo(cx + gap + len, cy);
            ctx.moveTo(cx, cy - gap - len); ctx.lineTo(cx, cy - gap);
            ctx.moveTo(cx, cy + gap);       ctx.lineTo(cx, cy + gap + len);
            ctx.stroke();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth   = 1;
        }
        // Light outline around the sprite itself.
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeRect(cx - spriteR - 0.5, cy - spriteR - 0.5,
                       spriteR * 2 + 1, spriteR * 2 + 1);

        // Energie / Alter neben dem Fadenkreuz. Standardmäßig rechts oben;
        // wenn die Mikrobe nah am rechten Rand sitzt, links spiegeln, damit
        // der Text nicht über die Canvas-Kante läuft.
        var labelOff = gap + len + 6;
        var nearRight = cx + labelOff + 80 > this.width;
        var lx, align;
        if (nearRight) { lx = cx - labelOff; align = 'right'; }
        else           { lx = cx + labelOff; align = 'left'; }
        var lyE = cy - 6;
        var lyA = cy + 8;
        var eTxt = 'E: ' + this.mEnergy[idx];
        var aTxt = 'A: ' + this.mAge[idx];

        ctx.font         = 'bold 12px Arial';
        ctx.textAlign    = align;
        ctx.textBaseline = 'middle';
        // Dunkle Outline für Lesbarkeit über Nahrung/Hintergrund.
        ctx.lineWidth   = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(eTxt, lx, lyE);
        ctx.strokeText(aTxt, lx, lyA);
        ctx.fillStyle   = '#fff';
        ctx.fillText(eTxt, lx, lyE);
        ctx.fillText(aTxt, lx, lyA);

        ctx.restore();
    };

    SimulatedEvolutionGPU.prototype._frame = function () {
        if (!this.paused) {
            for (var t = 0; t < this.ticksPerFrame; ++t) {
                this._tick();
            }
        }
        this._computeStats();
        this._render();
        this._drawGenomeOverlay();
    };

    return SimulatedEvolutionGPU;
})();

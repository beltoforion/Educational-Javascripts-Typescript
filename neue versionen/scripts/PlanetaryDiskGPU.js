// Planetary disk simulation (GPU). 2D leapfrog integrator for ~10^5
// massless tracers perturbed by a handful of CPU-stepped planets. Tracer
// integration runs on the GPU via WebGL2 transform feedback; the CPU only
// steps the planets and draws the 2D overlay.

(function () {
"use strict";

// ===================================================================
// Constants
// ===================================================================
var GAMMA   = 6.67428e-20;     // km^3 / (kg s^2)
var L       = 1e6;             // length scale: 1 unit = 1 Mm
var DEG2RAD = Math.PI / 180;
var C_KMS   = 299792.458;      // speed of light

var DEFAULT_CONFIG = {
	DELTA_T:     20000,
	NUM_TRACERS: 100000,
	DISK_RADIUS: 1e9,
	PLANETS: [
		{ name: "Sun",     rad: 695700, mass: 1.989e30, orbit: null,
		  color: [1.00, 1.00, 1.00, 1.0], css: "rgba(255,255,255,1)" },
		{ name: "Earth",   rad: 6378,   mass: 5.974e24,
		  orbit: { around: "Sun", elonDeg: -90, dist: 149600000 },
		  color: [0.00, 0.48, 0.38, 1.0], css: "rgba(0,123,98,1)" },
		{ name: "Jupiter", rad: 71492,  mass: 1.899e27,
		  orbit: { around: "Sun", elonDeg: 0,   dist: 778570000 },
		  color: [1.00, 0.38, 0.14, 1.0], css: "rgba(255,97,35,1)" },
	],
};

// ===================================================================
// Shader sources
// ===================================================================
var VS_INTEGRATE = `#version 300 es
precision highp float;

// Leapfrog (kick-drift) integrator: state is (pos, vel) instead of
// (pos, oldPos) used by position-Verlet. Float32 captures the per-step
// kick a*dt accurately even at the outer disk.

layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_vel;
layout(location = 2) in vec2 a_stats;
layout(location = 3) in float a_size;

uniform vec2  u_planetPos[8];
uniform float u_planetMass[8];
uniform float u_planetRadX10[8];
uniform int   u_numPlanets;

uniform float u_Kv;
uniform float u_dt;
uniform float u_V0Sun;
uniform float u_Rmin;
uniform float u_Rmax;
uniform float u_seed;
uniform float u_eccGate;
uniform float u_prCoef;

out vec2 v_pos;
out vec2 v_vel;
out vec2 v_stats;
out float v_size;

uint pcg(uint s) {
	s = s * 747796405u + 2891336453u;
	uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
	return (w >> 22u) ^ w;
}
float rand01(uint s) { return float(pcg(s)) * (1.0 / 4294967296.0); }

void doReset(uint id, float seed,
             out vec2 pos, out vec2 vel, out vec2 stats, out float size) {
	uint h1 = id * 1973u + uint(seed * 977.0);
	uint h2 = h1 + 7919u;
	uint h3 = h1 * 2654435761u + 13u;
	float u1 = rand01(h1);
	float u2 = rand01(h2);
	float angle = 6.28318530718 * u1;
	float r = sqrt(u_Rmin * u_Rmin + u2 * (u_Rmax * u_Rmax - u_Rmin * u_Rmin));
	vec2 newPos = u_planetPos[0] + r * vec2(cos(angle), sin(angle));
	vec2 rv = newPos - u_planetPos[0];
	float d = length(rv);
	float vmag = u_V0Sun / sqrt(d);
	vec2 newVel = vec2(rv.y, -rv.x) * (vmag / d);
	pos   = newPos;
	vel   = newVel;
	stats = vec2(1.0e9, 0.0);
	size  = rand01(h3);
}

void main() {
	gl_Position = vec4(0.0, 0.0, 0.0, 1.0);

	vec2 pos = a_pos;
	vec2 vel = a_vel;
	vec2 stats = a_stats;
	float size = a_size;
	uint id = uint(gl_VertexID);

	vec2 acc = vec2(0.0);
	float dist0 = 0.0;
	bool collided = false;

	for (int j = 0; j < 8; ++j) {
		if (j >= u_numPlanets) break;
		vec2 r = pos - u_planetPos[j];
		float d2 = dot(r, r) + 1e-12;
		float d = sqrt(d2);
		float g = u_planetMass[j] / (d2 * d);
		if (j == 0) dist0 = d;
		acc += g * r;
		if (d < u_planetRadX10[j]) collided = true;
	}

	if (collided) {
		doReset(id, u_seed, v_pos, v_vel, v_stats, v_size);
		return;
	}

	vec2 newVel = vel + u_Kv * acc;

	if (u_prCoef > 0.0) {
		float invR2 = 1.0 / (dist0 * dist0 + 1e-12);
		float beta  = u_prCoef / max(size, 0.02);
		newVel -= beta * invR2 * vel;
	}

	vec2 newPos = pos + newVel * u_dt;

	stats.x = min(stats.x, dist0);
	stats.y = max(stats.y, dist0);

	vec2 sunPos = u_planetPos[0];
	if (newPos.x > sunPos.x && pos.x < sunPos.x && newPos.y > sunPos.y) {
		float exc = stats.x / max(stats.y, 1e-12);
		if (exc < u_eccGate) { doReset(id, u_seed + 0.5, v_pos, v_vel, v_stats, v_size); return; }
		stats = vec2(1.0e9, 0.0);
	}

	float relDist = length(newPos - sunPos);
	if (relDist > u_Rmax || relDist < u_Rmin * 0.5) {
		doReset(id, u_seed + 0.25, v_pos, v_vel, v_stats, v_size);
		return;
	}

	v_pos   = newPos;
	v_size  = size;
	v_vel   = newVel;
	v_stats = stats;
}
`;

var FS_INTEGRATE = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(0.0); }
`;

var VS_RENDER = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
layout(location = 1) in float a_size;
uniform vec2 u_centerPos;
uniform vec2 u_invFov;
uniform vec2 u_rot;
out float v_size;
void main() {
	vec2 d = a_pos - u_centerPos;
	vec2 rotated = vec2(d.x * u_rot.x - d.y * u_rot.y,
	                    d.x * u_rot.y + d.y * u_rot.x);
	vec2 ndc = rotated * u_invFov;
	gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
	gl_PointSize = mix(6.0, 12.0, a_size);
	v_size = clamp(a_size, 0.0, 1.0);
}
`;

var FS_RENDER = `#version 300 es
precision highp float;
in float v_size;
out vec4 outColor;
void main() {
	vec2 c = gl_PointCoord - 0.5;
	float r2 = dot(c, c);
	float a = 0.18 * exp(-r2 * 11.0);
	vec3 col = mix(vec3(0.45, 0.65, 1.0), vec3(1.0, 0.85, 0.45), v_size);
	outColor = vec4(col * a, a);
}
`;

// ===================================================================
// GL helpers
// ===================================================================
function compileShader(gl, type, src) {
	var sh = gl.createShader(type);
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
		throw new Error("Shader compile error:\n" + gl.getShaderInfoLog(sh));
	return sh;
}
function linkProgram(gl, vs, fs, tfVaryings) {
	var p = gl.createProgram();
	gl.attachShader(p, vs);
	gl.attachShader(p, fs);
	if (tfVaryings) gl.transformFeedbackVaryings(p, tfVaryings, gl.SEPARATE_ATTRIBS);
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS))
		throw new Error("Program link error:\n" + gl.getProgramInfoLog(p));
	return p;
}

// ===================================================================
// CPU planets
// ===================================================================
function PlanetarySystem(cfg) {
	this.dt = cfg.DELTA_T;
	this.time = 0;
	this.steps = 0;
	var n = cfg.PLANETS.length;
	this.nP = n;
	this.plX  = new Float64Array(n);
	this.plY  = new Float64Array(n);
	this.plOX = new Float64Array(n);
	this.plOY = new Float64Array(n);
	this.plVX = new Float64Array(n);
	this.plVY = new Float64Array(n);
	this.plAX = new Float64Array(n);
	this.plAY = new Float64Array(n);
	this.plMass = new Float64Array(n);
	this.plRad  = new Float64Array(n);
	this.plName = [];
	this.plColorCss = [];

	for (var i = 0; i < n; ++i) {
		var p = cfg.PLANETS[i];
		this.plName.push(p.name);
		this.plColorCss.push(p.css);
		this.plMass[i] = p.mass;
		this.plRad[i]  = p.rad;
		if (p.orbit) {
			var j = this.plName.indexOf(p.orbit.around);
			var elon = p.orbit.elonDeg * DEG2RAD;
			var x = p.orbit.dist * Math.sin(elon);
			var y = p.orbit.dist * Math.cos(elon);
			this.plX[i] = x;
			this.plY[i] = y;
			var v = this._orbitalVel(j, x, y);
			this.plVX[i] = v.vx;
			this.plVY[i] = v.vy;
		}
	}
	for (var k = 0; k < n; ++k) {
		this.plOX[k] = this.plX[k] - this.dt * this.plVX[k];
		this.plOY[k] = this.plY[k] - this.dt * this.plVY[k];
	}
}
PlanetarySystem.prototype._orbitalVel = function (idx, x, y) {
	var rx = x - this.plX[idx], ry = y - this.plY[idx];
	var d = Math.sqrt(rx * rx + ry * ry);
	var v = Math.sqrt(GAMMA * this.plMass[idx] / d);
	return { vx: (ry / d) * v, vy: (-rx / d) * v };
};
PlanetarySystem.prototype.movePlanets = function () {
	var n = this.nP, ax = this.plAX, ay = this.plAY;
	for (var i = 0; i < n; ++i) { ax[i] = 0; ay[i] = 0; }
	for (var a = 0; a < n; ++a) {
		for (var b = a + 1; b < n; ++b) {
			var rx = this.plX[a] - this.plX[b];
			var ry = this.plY[a] - this.plY[b];
			var d2 = rx * rx + ry * ry;
			var d  = Math.sqrt(d2);
			var kk = -GAMMA * this.plMass[a] * this.plMass[b] / (d2 * d);
			var fx = kk * rx, fy = kk * ry;
			ax[a] += fx / this.plMass[a];
			ay[a] += fy / this.plMass[a];
			ax[b] -= fx / this.plMass[b];
			ay[b] -= fy / this.plMass[b];
		}
	}
	var dt2 = this.dt * this.dt;
	for (var i2 = 0; i2 < n; ++i2) {
		var bx = this.plX[i2], by = this.plY[i2];
		this.plX[i2] = 2 * bx - this.plOX[i2] + ax[i2] * dt2;
		this.plY[i2] = 2 * by - this.plOY[i2] + ay[i2] * dt2;
		this.plOX[i2] = bx;
		this.plOY[i2] = by;
	}
	this.time += this.dt;
	this.steps += 1;
};

// ===================================================================
// GPU simulation (transform-feedback ping-pong)
// ===================================================================
function GPUSimulation(gl, sys, n, diskRadius) {
	this.gl = gl;
	this.sys = sys;
	this.n = n;
	this.read = 0;
	this.stepSeed = 0;
	this.eccGate  = 0.75;
	this.prScale  = 0;

	var vsInt = compileShader(gl, gl.VERTEX_SHADER,   VS_INTEGRATE);
	var fsInt = compileShader(gl, gl.FRAGMENT_SHADER, FS_INTEGRATE);
	var vsRen = compileShader(gl, gl.VERTEX_SHADER,   VS_RENDER);
	var fsRen = compileShader(gl, gl.FRAGMENT_SHADER, FS_RENDER);
	this.intProg = linkProgram(gl, vsInt, fsInt, ["v_pos", "v_vel", "v_stats", "v_size"]);
	this.renProg = linkProgram(gl, vsRen, fsRen, null);

	this.intU = {
		planetPos:    gl.getUniformLocation(this.intProg, "u_planetPos[0]"),
		planetMass:   gl.getUniformLocation(this.intProg, "u_planetMass[0]"),
		planetRadX10: gl.getUniformLocation(this.intProg, "u_planetRadX10[0]"),
		numPlanets:   gl.getUniformLocation(this.intProg, "u_numPlanets"),
		Kv:           gl.getUniformLocation(this.intProg, "u_Kv"),
		V0Sun:        gl.getUniformLocation(this.intProg, "u_V0Sun"),
		dt:           gl.getUniformLocation(this.intProg, "u_dt"),
		Rmin:         gl.getUniformLocation(this.intProg, "u_Rmin"),
		Rmax:         gl.getUniformLocation(this.intProg, "u_Rmax"),
		seed:         gl.getUniformLocation(this.intProg, "u_seed"),
		eccGate:      gl.getUniformLocation(this.intProg, "u_eccGate"),
		prCoef:       gl.getUniformLocation(this.intProg, "u_prCoef"),
	};
	this.renU = {
		centerPos: gl.getUniformLocation(this.renProg, "u_centerPos"),
		invFov:    gl.getUniformLocation(this.renProg, "u_invFov"),
		rot:       gl.getUniformLocation(this.renProg, "u_rot"),
	};

	this.Rmin = (this.sys.plRad[0] * 20) / L;
	this.Rmax = diskRadius / L;

	var empty  = new Float32Array(n * 2);
	var empty1 = new Float32Array(n);
	this.states = [
		this._createState(empty, empty, empty, empty1),
		this._createState(empty, empty, empty, empty1),
	];
	this.resetDisk();
}
GPUSimulation.prototype._initTracerData = function (pos, vel, stats, size) {
	var sunXkm = this.sys.plX[0], sunYkm = this.sys.plY[0];
	var RminKm = this.Rmin * L, RmaxKm = this.Rmax * L;
	var Rmin2 = RminKm * RminKm, Rmax2 = RmaxKm * RmaxKm;
	for (var i = 0; i < this.n; ++i) {
		var u = Math.random();
		var dKm = Math.sqrt(Rmin2 + u * (Rmax2 - Rmin2));
		var elon = 2 * Math.PI * Math.random();
		var xKm = sunXkm + dKm * Math.cos(elon);
		var yKm = sunYkm + dKm * Math.sin(elon);
		var v   = this.sys._orbitalVel(0, xKm, yKm);
		pos[2*i]     = xKm / L;
		pos[2*i + 1] = yKm / L;
		vel[2*i]     = v.vx / L;
		vel[2*i + 1] = v.vy / L;
		stats[2*i]     = 1e9;
		stats[2*i + 1] = 0;
		size[i]        = Math.random();
	}
};
GPUSimulation.prototype._createState = function (initPos, initVel, initStats, initSize) {
	var gl = this.gl;
	function mkBuf(data) {
		var b = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, b);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY);
		return b;
	}
	var posBuf   = mkBuf(initPos);
	var velBuf   = mkBuf(initVel);
	var statsBuf = mkBuf(initStats);
	var sizeBuf  = mkBuf(initSize);

	var intVAO = gl.createVertexArray();
	gl.bindVertexArray(intVAO);
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, velBuf);
	gl.enableVertexAttribArray(1);
	gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, statsBuf);
	gl.enableVertexAttribArray(2);
	gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
	gl.enableVertexAttribArray(3);
	gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
	gl.bindVertexArray(null);

	var renVAO = gl.createVertexArray();
	gl.bindVertexArray(renVAO);
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
	gl.enableVertexAttribArray(1);
	gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
	gl.bindVertexArray(null);

	var tf = gl.createTransformFeedback();
	gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
	gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, posBuf);
	gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, velBuf);
	gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, statsBuf);
	gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 3, sizeBuf);
	gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

	return { posBuf: posBuf, velBuf: velBuf, statsBuf: statsBuf, sizeBuf: sizeBuf,
	         intVAO: intVAO, renVAO: renVAO, tf: tf };
};
GPUSimulation.prototype.step = function () {
	this.sys.movePlanets();
	this.stepSeed += 1;

	var gl = this.gl;
	var sys = this.sys;
	var writeIdx = 1 - this.read;

	gl.useProgram(this.intProg);

	var planetPos    = new Float32Array(8 * 2);
	var planetMass   = new Float32Array(8);
	var planetRadX10 = new Float32Array(8);
	for (var i = 0; i < sys.nP; ++i) {
		planetPos[2*i]     = sys.plX[i] / L;
		planetPos[2*i + 1] = sys.plY[i] / L;
		planetMass[i]      = sys.plMass[i];
		planetRadX10[i]    = (sys.plRad[i] * 10) / L;
	}
	gl.uniform2fv(this.intU.planetPos,    planetPos);
	gl.uniform1fv(this.intU.planetMass,   planetMass);
	gl.uniform1fv(this.intU.planetRadX10, planetRadX10);
	gl.uniform1i(this.intU.numPlanets, sys.nP);

	var Kv = -GAMMA * sys.dt / (L * L * L);
	gl.uniform1f(this.intU.Kv, Kv);
	var V0 = Math.sqrt(GAMMA * sys.plMass[0] / (L * L * L));
	gl.uniform1f(this.intU.V0Sun, V0);
	gl.uniform1f(this.intU.dt, sys.dt);
	gl.uniform1f(this.intU.Rmin, this.Rmin);
	gl.uniform1f(this.intU.Rmax, this.Rmax);
	gl.uniform1f(this.intU.seed, this.stepSeed);
	gl.uniform1f(this.intU.eccGate, this.eccGate);
	var prCoefBase = (GAMMA * sys.plMass[0] * sys.dt) / (C_KMS * L * L);
	gl.uniform1f(this.intU.prCoef, this.prScale * prCoefBase);

	gl.bindVertexArray(this.states[this.read].intVAO);
	gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.states[writeIdx].tf);
	gl.enable(gl.RASTERIZER_DISCARD);
	gl.beginTransformFeedback(gl.POINTS);
	gl.drawArrays(gl.POINTS, 0, this.n);
	gl.endTransformFeedback();
	gl.disable(gl.RASTERIZER_DISCARD);
	gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
	gl.bindVertexArray(null);

	gl.flush();

	if (this._checkError !== false) {
		var err = gl.getError();
		if (err) { this.lastGlError = err; this._checkError = false; }
		else if (this.stepSeed > 4) this._checkError = false;
	}

	this.read = writeIdx;
};
GPUSimulation.prototype.render = function (centerWorldX, centerWorldY, fovKm, rotCos, rotSin) {
	var gl = this.gl;
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.useProgram(this.renProg);
	gl.uniform2f(this.renU.centerPos, centerWorldX / L, centerWorldY / L);
	// fovKm is the *vertical* world span; horizontal stretches with aspect
	// so a 16:9 canvas shows fov*aspect horizontally — keeps world isotropic.
	var fovScaled = fovKm / L;
	var aspect = gl.canvas.width / gl.canvas.height;
	gl.uniform2f(this.renU.invFov, 2 / (fovScaled * aspect), 2 / fovScaled);
	gl.uniform2f(this.renU.rot, rotCos, rotSin);

	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
	gl.bindVertexArray(this.states[this.read].renVAO);
	gl.drawArrays(gl.POINTS, 0, this.n);
	gl.bindVertexArray(null);
	gl.disable(gl.BLEND);
};
GPUSimulation.prototype.injectTracer = function (xKm, yKm, centerIdx) {
	if (this._injIdx === undefined) this._injIdx = 0;
	this._injIdx = (this._injIdx + 1) % this.n;
	var i = this._injIdx;

	var v = this.sys._orbitalVel(centerIdx, xKm, yKm);
	var xs = xKm / L, ys = yKm / L;
	var vxs = v.vx / L, vys = v.vy / L;

	var gl = this.gl;
	var st = this.states[this.read];
	var tmp = new Float32Array([xs, ys]);
	gl.bindBuffer(gl.ARRAY_BUFFER, st.posBuf);
	gl.bufferSubData(gl.ARRAY_BUFFER, i * 8, tmp);
	tmp[0] = vxs; tmp[1] = vys;
	gl.bindBuffer(gl.ARRAY_BUFFER, st.velBuf);
	gl.bufferSubData(gl.ARRAY_BUFFER, i * 8, tmp);
	var tmp2 = new Float32Array([1e9, 0]);
	gl.bindBuffer(gl.ARRAY_BUFFER, st.statsBuf);
	gl.bufferSubData(gl.ARRAY_BUFFER, i * 8, tmp2);
	var tmp3 = new Float32Array([Math.random()]);
	gl.bindBuffer(gl.ARRAY_BUFFER, st.sizeBuf);
	gl.bufferSubData(gl.ARRAY_BUFFER, i * 4, tmp3);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
};
GPUSimulation.prototype.resetDisk = function () {
	var initPos   = new Float32Array(this.n * 2);
	var initVel   = new Float32Array(this.n * 2);
	var initStats = new Float32Array(this.n * 2);
	var initSize  = new Float32Array(this.n);
	this._initTracerData(initPos, initVel, initStats, initSize);
	var gl = this.gl;
	for (var s = 0; s < this.states.length; ++s) {
		var st = this.states[s];
		gl.bindBuffer(gl.ARRAY_BUFFER, st.posBuf);
		gl.bufferData(gl.ARRAY_BUFFER, initPos, gl.DYNAMIC_COPY);
		gl.bindBuffer(gl.ARRAY_BUFFER, st.velBuf);
		gl.bufferData(gl.ARRAY_BUFFER, initVel, gl.DYNAMIC_COPY);
		gl.bindBuffer(gl.ARRAY_BUFFER, st.statsBuf);
		gl.bufferData(gl.ARRAY_BUFFER, initStats, gl.DYNAMIC_COPY);
		gl.bindBuffer(gl.ARRAY_BUFFER, st.sizeBuf);
		gl.bufferData(gl.ARRAY_BUFFER, initSize, gl.DYNAMIC_COPY);
	}
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
};

// ===================================================================
// Overlay (Canvas2D): axes, planet markers, solar-system ring, HUD
// ===================================================================
function OverlayRenderer(canvas, sys, numTracers) {
	this.canvas = canvas;
	this.ctx = canvas.getContext("2d");
	this.sys = sys;
	this.numTracers = numTracers;
	this.w = canvas.width;
	this.h = canvas.height;
	this.cx = this.w >> 1;
	this.cy = this.h >> 1;
	this.fov = 2e9;
	this.center = 0;
	this.coRotateIdx = sys.nP > 2 ? 2 : (sys.nP > 1 ? 1 : -1);
	this.resonance = 0;
	this.showSolarSystem = false;
	this.contSource = false;
	this.contX = 0; this.contY = 0;
	this.stepsPerFrame = 150;
	this.fpsFrames = 0;
	this.fpsT0 = performance.now();
	this.frameFps = 0;
}
// fov is the world span across the *shorter* canvas dimension (= h for 16:9),
// so world coords stay isotropic and the longer dimension just shows more world.
Object.defineProperty(OverlayRenderer.prototype, "scale", {
	get: function () { return this.h / this.fov; }
});
OverlayRenderer.prototype.cycleCoRotate = function () {
	if (this.coRotateIdx < 0) {
		this.coRotateIdx = this.sys.nP > 1 ? 1 : -1;
	} else {
		this.coRotateIdx = (this.coRotateIdx + 1 < this.sys.nP) ? this.coRotateIdx + 1 : -1;
	}
};
OverlayRenderer.prototype.getRotation = function () {
	if (this.coRotateIdx <= 0) return { c: 1, s: 0 };
	var sys = this.sys;
	var dx = sys.plX[this.coRotateIdx] - sys.plX[0];
	var dy = sys.plY[this.coRotateIdx] - sys.plY[0];
	var d = Math.sqrt(dx * dx + dy * dy);
	if (d < 1e-9) return { c: 1, s: 0 };
	return { c: dx / d, s: -dy / d };
};
OverlayRenderer.prototype.getEffectiveCenter = function () {
	if (this.coRotateIdx > 0) {
		return { x: this.sys.plX[0], y: this.sys.plY[0] };
	}
	return { x: this.sys.plX[this.center], y: this.sys.plY[this.center] };
};
OverlayRenderer.prototype.worldToScreen = function (x, y) {
	var sc = this.scale;
	var c = this.getEffectiveCenter();
	var dx = x - c.x;
	var dy = y - c.y;
	var r = this.getRotation();
	var rx = dx * r.c - dy * r.s;
	var ry = dx * r.s + dy * r.c;
	return { x: this.cx + rx * sc, y: this.cy + ry * sc };
};
OverlayRenderer.prototype.setCenter = function (idx) {
	if (idx >= 0 && idx < this.sys.nP) this.center = idx;
};
OverlayRenderer.prototype.toggleResonance = function (idx) {
	if (idx >= 0 && idx < this.sys.nP) this.resonance ^= (1 << idx);
};
OverlayRenderer.prototype.zoom = function (f) { this.fov *= f; };
OverlayRenderer.prototype.render = function (simStepsPerSec, lastGlError) {
	var ctx = this.ctx;
	ctx.clearRect(0, 0, this.w, this.h);
	this._drawAxes();
	this._drawPlanets();
	for (var i = 0; i < this.sys.nP; ++i) {
		if (this.resonance & (1 << i)) this._drawResonance(i);
	}
	if (this.showSolarSystem) this._drawSolarSystem();
	this._drawStat(simStepsPerSec, lastGlError);
};
OverlayRenderer.prototype._drawAxes = function () {
	var ctx = this.ctx;
	ctx.strokeStyle = "rgba(68,68,170,1)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(this.cx + 0.5, 0); ctx.lineTo(this.cx + 0.5, this.h);
	ctx.moveTo(0, this.cy + 0.5); ctx.lineTo(this.w, this.cy + 0.5);
	ctx.stroke();
};
OverlayRenderer.prototype._drawPlanets = function () {
	var s = this.sys, ctx = this.ctx;
	for (var i = 0; i < s.nP; ++i) {
		var p = this.worldToScreen(s.plX[i], s.plY[i]);
		if (p.x < 0 || p.x > this.w || p.y < 0 || p.y > this.h) continue;
		var col = s.plColorCss[i];
		ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(p.x, p.y - 15); ctx.lineTo(p.x, p.y + 15);
		ctx.moveTo(p.x - 15, p.y); ctx.lineTo(p.x + 15, p.y);
		ctx.stroke();
		var r = Math.max(1, s.plRad[i] * this.scale);
		ctx.beginPath();
		ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
		ctx.fill();
	}
};
OverlayRenderer.prototype._drawSolarSystem = function () {
	var cols = ["rgba(255,255,255,1)","rgba(251,230,111,1)","rgba(0,123,98,1)",
	            "rgba(242,98,42,1)","rgba(255,97,35,1)","rgba(255,216,0,1)",
	            "rgba(101,144,255,1)","rgba(5,54,178,1)"];
	var dist = [57910000,108210000,149600000,227920000,
	            778570000,1433530000,2872460000,4495060000];
	var names = ["Merkur","Venus","Erde","Mars","Jupiter","Saturn","Uranus","Neptun"];
	var ctx = this.ctx, s = this.sys;
	var sun = this.worldToScreen(s.plX[0], s.plY[0]);
	var cx = sun.x, cy = sun.y;
	ctx.lineWidth = 1; ctx.font = "11px Consolas, monospace";
	for (var i = 0; i < dist.length; ++i) {
		var r = dist[i] * this.scale;
		ctx.strokeStyle = cols[i]; ctx.fillStyle = cols[i];
		ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
		ctx.fillText(names[i], cx, cy + r - 2);
	}
};
OverlayRenderer.prototype._drawResonance = function (idx) {
	var s = this.sys, ctx = this.ctx, idxMain = 0;
	var rx = s.plX[idxMain] - s.plX[idx];
	var ry = s.plY[idxMain] - s.plY[idx];
	var dist = Math.sqrt(rx * rx + ry * ry);
	var v = Math.sqrt(GAMMA * s.plMass[idxMain] / dist);
	var period = 2 * Math.PI * dist / v;
	var ratios = [1, 1/2, 1/3, 1/4, 2/3, 2/5];
	var names  = [" 1:1", " 2:1", " 3:1", " 4:1", " 3:2", " 5:2"];
	var G_SI = 6.67428e-11;
	var main = this.worldToScreen(s.plX[idxMain], s.plY[idxMain]);
	var cx = main.x, cy = main.y;
	ctx.strokeStyle = s.plColorCss[idx]; ctx.fillStyle = s.plColorCss[idx];
	ctx.lineWidth = 1; ctx.font = "11px Consolas, monospace";
	for (var i = 0; i < ratios.length; ++i) {
		var T = period * ratios[i];
		var radKm = Math.cbrt(G_SI * s.plMass[idxMain] * T * T / (4 * Math.PI * Math.PI)) / 1000;
		var rPx = radKm * this.scale;
		ctx.beginPath(); ctx.arc(cx, cy, rPx, 0, 2 * Math.PI); ctx.stroke();
		ctx.fillText(names[i], cx, cy - rPx - 4);
	}
};
OverlayRenderer.prototype._drawStat = function (simStepsPerSec, lastGlError) {
	var s = this.sys, ctx = this.ctx;
	ctx.font = "12px Consolas, monospace";
	ctx.fillStyle = "#fff";
	ctx.textBaseline = "top";
	ctx.textAlign = "left";
	var yr = s.time / (86400 * 365.25);
	var lines = [
		"Tracer:         " + this.numTracers.toLocaleString() + "  (GPU)",
		"Sim-Zeit:       " + yr.toFixed(2) + " Jahre",
		"Schritte/s:     " + Math.round(simStepsPerSec),
		"Render-FPS:     " + Math.round(this.frameFps),
		"Schritte/Frame: " + this.stepsPerFrame,
		"Zentrum:        " + s.plName[this.center] + "   FOV: " + this.fov.toExponential(2) + " km",
		"Co-Rotation:    " + (this.coRotateIdx < 0 ? "aus (inertial)" : s.plName[this.coRotateIdx]),
	];
	if (this.contSource) lines.push("Dauerquelle:    aktiv");
	if (this.resonance) {
		var txt = "Resonanzen:     ";
		for (var k = 0; k < s.nP; ++k)
			if (this.resonance & (1 << k)) txt += s.plName[k] + " ";
		lines.push(txt);
	}
	var y0 = this.h - 12 - 15 * lines.length;
	for (var i = 0; i < lines.length; ++i) ctx.fillText(lines[i], 12, y0 + 15 * i);
	if (lastGlError) {
		ctx.fillStyle = "#f88";
		ctx.fillText("GL-Fehler 0x" + lastGlError.toString(16), 12, y0 - 18);
	}
};
OverlayRenderer.prototype.bumpFrame = function () {
	this.fpsFrames += 1;
	var now = performance.now();
	var dt = now - this.fpsT0;
	if (dt > 1000) {
		this.frameFps = this.fpsFrames * 1000 / dt;
		this.fpsFrames = 0;
		this.fpsT0 = now;
	}
};

// ===================================================================
// Public class
// ===================================================================
function PlanetaryDiskGPU(opts) {
	this.cvid = opts.cvid;
	this.width  = opts.width  || 1600;
	this.height = opts.height || 900;
	this.config = Object.assign({}, DEFAULT_CONFIG, opts.config || {});

	this._setupDom();

	this.gl = this.glCanvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: false });
	if (!this.gl) {
		this.ctx2d.fillStyle = "#f88";
		this.ctx2d.font = "16px sans-serif";
		this.ctx2d.fillText("WebGL2 wird benötigt, ist aber nicht verfügbar.", 20, 40);
		return;
	}

	this.sys = new PlanetarySystem(this.config);
	this.sim = new GPUSimulation(this.gl, this.sys, this.config.NUM_TRACERS, this.config.DISK_RADIUS);
	this.overlay = new OverlayRenderer(this.cv2dCanvas, this.sys, this.config.NUM_TRACERS);

	this._wireInput();
	this._start();
}
PlanetaryDiskGPU.prototype._setupDom = function () {
	var parent = document.getElementById(this.cvid);
	parent.style.position = "relative";
	parent.style.display  = "block";
	parent.style.width    = "100%";
	parent.style.height   = "100%";
	parent.style.background = "#000";

	this.glCanvas = document.createElement("canvas");
	this.glCanvas.width = this.width;
	this.glCanvas.height = this.height;
	this.glCanvas.style.position = "absolute";
	this.glCanvas.style.inset    = "0";
	this.glCanvas.style.width    = "100%";
	this.glCanvas.style.height   = "100%";
	this.glCanvas.style.display  = "block";
	parent.appendChild(this.glCanvas);

	this.cv2dCanvas = document.createElement("canvas");
	this.cv2dCanvas.width = this.width;
	this.cv2dCanvas.height = this.height;
	this.cv2dCanvas.style.position = "absolute";
	this.cv2dCanvas.style.inset    = "0";
	this.cv2dCanvas.style.width    = "100%";
	this.cv2dCanvas.style.height   = "100%";
	this.cv2dCanvas.style.display  = "block";
	this.cv2dCanvas.style.cursor   = "crosshair";
	parent.appendChild(this.cv2dCanvas);
	this.ctx2d = this.cv2dCanvas.getContext("2d");
};
PlanetaryDiskGPU.prototype._wireInput = function () {
	var self = this;

	// Click to inject a tracer at world coordinates under the cursor.
	this.cv2dCanvas.addEventListener("mousedown", function (e) {
		self.cv2dCanvas.focus();
		var rect = self.cv2dCanvas.getBoundingClientRect();
		var px = (e.clientX - rect.left) * (self.cv2dCanvas.width  / rect.width);
		var py = (e.clientY - rect.top)  * (self.cv2dCanvas.height / rect.height);
		// World coords are isotropic; use fov/h on both axes.
		var sx = (px - self.overlay.cx) * self.overlay.fov / self.overlay.h;
		var sy = (py - self.overlay.cy) * self.overlay.fov / self.overlay.h;
		var r = self.overlay.getRotation();
		var dx =  sx * r.c + sy * r.s;
		var dy = -sx * r.s + sy * r.c;
		var c = self.overlay.getEffectiveCenter();
		var wx = dx + c.x;
		var wy = dy + c.y;
		self.sim.injectTracer(wx, wy, self.overlay.center);
		self.overlay.contX = wx; self.overlay.contY = wy;
	});

	// Keyboard. Canvas must be focusable to receive these; click focuses it.
	this.cv2dCanvas.tabIndex = 0;
	this.cv2dCanvas.style.outline = "none";
	this.cv2dCanvas.addEventListener("keydown", function (e) {
		switch (e.key) {
			case "+": case "=":  self.overlay.zoom(1.2); break;
			case "-": case "_":  self.overlay.zoom(1 / 1.2); break;
			case "s": case "S":  self.overlay.showSolarSystem = !self.overlay.showSolarSystem; break;
			case "c": case "C":  self.overlay.contSource = !self.overlay.contSource; break;
			case "1": self.overlay.setCenter(0); break;
			case "2": self.overlay.setCenter(1); break;
			case "3": self.overlay.setCenter(2); break;
			case "4": self.overlay.setCenter(3); break;
			case "F1": self.overlay.toggleResonance(0); e.preventDefault(); break;
			case "F2": self.overlay.toggleResonance(1); e.preventDefault(); break;
			case "F3": self.overlay.toggleResonance(2); e.preventDefault(); break;
			case "F4": self.overlay.toggleResonance(3); e.preventDefault(); break;
			case "[":  self.overlay.stepsPerFrame = Math.max(1, self.overlay.stepsPerFrame - 1); break;
			case "]":  self.overlay.stepsPerFrame += 1; break;
			case "t": case "T": self.overlay.cycleCoRotate(); break;
			case "r": case "R": self.sim.resetDisk(); break;
		}
	});
};
PlanetaryDiskGPU.prototype._start = function () {
	var self = this;
	var stepsLastSec = 0, stepsAcc = 0, stepsT0 = performance.now();
	startAppletLoop(document.getElementById(this.cvid), function () {
		for (var i = 0; i < self.overlay.stepsPerFrame; ++i) {
			if (self.overlay.contSource) self.sim.injectTracer(self.overlay.contX, self.overlay.contY, self.overlay.center);
			self.sim.step();
			stepsAcc += 1;
		}
		var now = performance.now();
		if (now - stepsT0 > 1000) {
			stepsLastSec = stepsAcc * 1000 / (now - stepsT0);
			stepsAcc = 0;
			stepsT0 = now;
		}
		var rot = self.overlay.getRotation();
		var c = self.overlay.getEffectiveCenter();
		self.sim.render(c.x, c.y, self.overlay.fov, rot.c, rot.s);
		self.overlay.render(stepsLastSec, self.sim.lastGlError);
		self.overlay.bumpFrame();
	});
};

// --- Public API for the controls bar -------------------------------
PlanetaryDiskGPU.prototype.setEccGate         = function (v) { this.sim.eccGate = v; };
PlanetaryDiskGPU.prototype.setPrScale         = function (v) { this.sim.prScale = v; };
PlanetaryDiskGPU.prototype.reset              = function ()  { this.sim.resetDisk(); };
PlanetaryDiskGPU.prototype.toggleSolarSystem  = function ()  { this.overlay.showSolarSystem = !this.overlay.showSolarSystem; };
PlanetaryDiskGPU.prototype.cycleCoRotate      = function ()  { this.overlay.cycleCoRotate(); };
PlanetaryDiskGPU.prototype.toggleContSource   = function ()  { this.overlay.contSource = !this.overlay.contSource; };
PlanetaryDiskGPU.prototype.setCenter          = function (i) { this.overlay.setCenter(i); };
PlanetaryDiskGPU.prototype.toggleResonance    = function (i) { this.overlay.toggleResonance(i); };
PlanetaryDiskGPU.prototype.setStepsPerFrame   = function (n) { this.overlay.stepsPerFrame = Math.max(1, n | 0); };
PlanetaryDiskGPU.prototype.bumpStepsPerFrame  = function (d) { this.overlay.stepsPerFrame = Math.max(1, this.overlay.stepsPerFrame + d); };
PlanetaryDiskGPU.prototype.zoom               = function (f) { this.overlay.zoom(f); };

window.PlanetaryDiskGPU = PlanetaryDiskGPU;
})();

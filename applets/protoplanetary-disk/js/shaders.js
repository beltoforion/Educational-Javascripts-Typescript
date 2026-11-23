// GLSL-Quelltexte. Sie stehen als Zeichenketten hier, damit die Seite ohne Webserver per Doppelklick läuft.
(function (Disk) {
'use strict';

const VS_TRI = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

// Zeitintegration: Leapfrog in Kick-Drift-Kick-Form.
//   Kick   v(n+1/2) = v(n)     + a(n)   · dt/2
//   Drift  x(n+1)   = x(n)     + v(n+1/2) · dt
//   Kick   v(n+1)   = v(n+1/2) + a(n+1) · dt/2
// a(n+1) wird gespeichert und im nächsten Schritt als a(n) wiederverwendet. Pro Schritt fällt also
// nur eine Kraftberechnung an. Der erste Durchgang macht den halben Kick und die Drift, der zweite
// berechnet die Kräfte an den neuen Orten und schließt den Kick ab.

// Durchgang 1: halber Kick und Drift. Kostet nur einen Texturzugriff je Teilchen.
const FS_DRIFT = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uPos;   // xyz Ort, w = Körperradius in Teilchenradien, Masse = w³ (negativ: vom Stern verschluckt, 0: in einem anderen Körper aufgegangen)
uniform sampler2D uVel;   // xyz Geschwindigkeit v(n), w = Nachbardichte
uniform sampler2D uAcc;   // xyz Beschleunigung a(n) durch Gravitation
uniform float uDt, uRacc2;
layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVelHalf;
void main(){
  ivec2 me = ivec2(gl_FragCoord.xy);
  vec4 p = texelFetch(uPos, me, 0);
  vec4 v = texelFetch(uVel, me, 0);
  if (p.w <= 0.0) { oPos = p; oVelHalf = v; return; }
  vec3 vh = v.xyz + texelFetch(uAcc, me, 0).xyz * (0.5 * uDt);
  vec3 pn = p.xyz + vh * uDt;
  oPos = vec4(pn, dot(pn, pn) < uRacc2 ? -p.w : p.w);
  oVelHalf = vec4(vh, v.w);
}`;

// Durchgang 2: Kräfte an den neuen Orten, zweiter halber Kick. Jedes Fragment ist ein Teilchen und summiert über alle anderen.
const FS_KICK = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uPos;   // Orte x(n+1)
uniform sampler2D uVel;   // Geschwindigkeiten v(n+1/2), w = Nachbardichte des letzten Schritts
uniform int uTS;
uniform float uHalf;      // dt/2, oder 0 beim Start, wenn nur a(0) gebraucht wird
uniform float uCdt;       // Stoßstärke · dt
uniform float uC2;        // 2 · Stoßstärke · dt, für den Stabilitätsbegrenzer
uniform float uGMc, uGm, uInvH2;
uniform float uSoft;      // Glättungslänge der Gravitation je Teilchenradius
uniform float uRm;        // Körperradius eines einzelnen Teilchens, 0 schaltet das Verschmelzen ab
uniform float uStick;     // 2 · Haftung
uniform float uHill;      // 3 · Sternmasse / (Teilchenmasse · Anteil³), für die Gezeitengrenze
layout(location = 0) out vec4 oVel;
layout(location = 1) out vec4 oAcc;
layout(location = 2) out vec4 oAux;   // x = Nummer des Partners, mit dem dieses Teilchen verschmelzen will, sonst -1
void main(){
  ivec2 me = ivec2(gl_FragCoord.xy);
  vec4 p = texelFetch(uPos, me, 0);
  vec4 v = texelFetch(uVel, me, 0);
  oAux = vec4(-1.0);
  if (p.w <= 0.0) { oVel = v; oAcc = vec4(0.0); return; }

  vec3 g = vec3(0.0);     // Gravitationsfeld der anderen Teilchen
  vec3 dv = vec3(0.0);    // Geschwindigkeitsänderung durch Stöße
  float S = 0.0;          // Nachbardichte
  float wi = p.w, mi = wi * wi * wi;     // Körper gleicher Dichte: Radius ~ Masse^(1/3)
  float nearest = 1e30, partner = -1.0;
  float orbit3 = pow(dot(p.xyz, p.xyz), 1.5);   // Abstand zum Stern hoch drei

  for (int y = 0; y < uTS; y++) {
    for (int x = 0; x < uTS; x++) {
      vec4 q = texelFetch(uPos, ivec2(x, y), 0);
      vec4 u = texelFetch(uVel, ivec2(x, y), 0);
      vec3 d = q.xyz - p.xyz;
      float r2 = dot(d, d);

      float wj = max(q.w, 0.0), mj = wj * wj * wj;
      vec3 rel = u.xyz - v.xyz;

      // Newton: a = G m d / |d|^3. Die Plummer-Glättung gegen die Singularität wächst mit der Größe der beiden Körper.
      float soft = uSoft * (wi + wj);
      float inv = inversesqrt(r2 + soft * soft);
      g += d * (mj * inv * inv * inv);

      // Inelastischer Stoß: nur die Annäherung entlang der Verbindungslinie wird gedämpft.
      // Der Impuls ist zentral und paarweise entgegengesetzt gleich, erhält also Impuls und Drehimpuls.
      // Bei ungleichen Massen bekommt der leichtere Partner die größere Geschwindigkeitsänderung.
      float w = max(0.0, 1.0 - r2 * uInvH2) * (2.0 * mj / (mi + mj));
      float vr = min(dot(rel, d), 0.0);
      dv += d * (vr * w / ((r2 + 1e-12) * (1.0 + uC2 * max(v.w, u.w))));
      S += w;

      // Verschmelzen, wenn drei Dinge zutreffen:
      //   1. Die Körper berühren sich.
      //   2. Sie sind langsamer als ihre gegenseitige Fluchtgeschwindigkeit am Berührpunkt.
      //   3. Der Berührabstand liegt innerhalb ihrer gemeinsamen Hill-Sphäre. Näher am Stern reißt
      //      dessen Gezeitenkraft das Paar wieder auseinander (Roche-Grenze).
      // Gemerkt wird der nächste solche Partner.
      float reach = uRm * (wi + wj);
      if (r2 < reach * reach && r2 > 0.0 && mj > 0.0 && r2 < nearest
          && dot(rel, rel) * reach < uStick * uGm * (mi + mj)
          && reach * reach * reach * uHill < orbit3 * (mi + mj)) {
        nearest = r2; partner = float(y * uTS + x);
      }
    }
  }
  oAux = vec4(partner, 0.0, 0.0, 0.0);
  S = max(S - 1.0, 0.0);  // das Teilchen selbst abziehen

  float ic = inversesqrt(dot(p.xyz, p.xyz) + 1e-6);
  vec3 a = g * uGm - p.xyz * (uGMc * ic * ic * ic);

  // Zweiter halber Kick. Die Stöße sind keine Gravitation und werden einmal pro Schritt als Impuls
  // aus den Geschwindigkeiten der Schrittmitte angewendet.
  oVel = vec4(v.xyz + a * uHalf + dv * uCdt, S);
  oAcc = vec4(a, 0.0);
}`;

// Durchgang 3: Verschmelzen. Zwei Körper werden nur dann eins, wenn sie sich gegenseitig als nächsten
// Partner gewählt haben. Der schwerere bleibt und übernimmt Masse, Schwerpunkt und Impuls beider.
const FS_MERGE = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uPos, uVel, uAcc, uAux;
uniform int uTS;
layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVel;
layout(location = 2) out vec4 oAcc;
void main(){
  ivec2 me = ivec2(gl_FragCoord.xy);
  vec4 p = texelFetch(uPos, me, 0);
  vec4 v = texelFetch(uVel, me, 0);
  vec4 a = texelFetch(uAcc, me, 0);
  oPos = p; oVel = v; oAcc = a;
  float wish = texelFetch(uAux, me, 0).x;
  if (p.w <= 0.0 || wish < 0.0) return;
  int j = int(wish + 0.5), i = me.y * uTS + me.x;
  ivec2 other = ivec2(j % uTS, j / uTS);
  if (int(texelFetch(uAux, other, 0).x + 0.5) != i) return;   // Wunsch nicht erwidert
  vec4 q = texelFetch(uPos, other, 0);
  if (q.w <= 0.0) return;
  if (p.w < q.w || (p.w == q.w && i > j)) { oPos = vec4(p.xyz, 0.0); oVel = vec4(0.0); oAcc = vec4(0.0); return; }   // geht im Partner auf
  vec4 u = texelFetch(uVel, other, 0);
  vec4 b = texelFetch(uAcc, other, 0);
  float mp = p.w * p.w * p.w, mq = q.w * q.w * q.w, m = mp + mq;
  oPos = vec4((p.xyz * mp + q.xyz * mq) / m, pow(m, 1.0 / 3.0));
  oVel = vec4((v.xyz * mp + u.xyz * mq) / m, v.w);
  oAcc = vec4((a.xyz * mp + b.xyz * mq) / m, 0.0);   // die gegenseitige Anziehung hebt sich im Mittel genau auf
}`;

const VS_PART = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uPos, uVel;
uniform int uTS, uMode;
uniform mat4 uVP;
uniform vec3 uL;
uniform float uGMc, uSize, uGain;
out vec3 vCol;
vec3 ramp(float t){
  const vec3 c0 = vec3(1.00, 0.78, 0.42), c1 = vec3(1.00, 0.42, 0.30), c2 = vec3(0.92, 0.25, 0.62),
             c3 = vec3(0.50, 0.36, 1.00), c4 = vec3(0.20, 0.80, 1.00);
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.45) return mix(c1, c2, (t - 0.25) / 0.20);
  if (t < 0.66) return mix(c2, c3, (t - 0.45) / 0.21);
  return mix(c3, c4, (t - 0.66) / 0.34);
}
void main(){
  ivec2 ij = ivec2(gl_VertexID % uTS, gl_VertexID / uTS);
  vec4 p = texelFetch(uPos, ij, 0);
  vec4 v = texelFetch(uVel, ij, 0);
  if (p.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; vCol = vec3(0.0); return; }
  vec3 l = cross(p.xyz, v.xyz);
  float t;
  if (uMode == 0) {            // Neigung der Bahnebene gegen die Scheibenebene
    float ci = clamp(dot(l, uL) / max(length(l), 1e-9), -1.0, 1.0);
    t = pow(acos(ci) / 3.14159265, 0.6);
  } else if (uMode == 1) {     // Exzentrizität der Keplerbahn um den Stern
    vec3 e = cross(v.xyz, l) / uGMc - normalize(p.xyz);
    t = clamp(length(e), 0.0, 1.0);
  } else {                     // Nachbardichte
    t = 1.0 - sqrt(clamp(v.w / 12.0, 0.0, 1.0));
  }
  gl_Position = uVP * vec4(p.xyz, 1.0);
  float heavy = clamp(log2(p.w) / 3.0, 0.0, 1.0);          // 0 für ein einzelnes Teilchen, 1 ab 512 Teilchenmassen
  float ps = uSize * sqrt(p.w) / gl_Position.w;            // gewachsene Körper werden größer gezeichnet
  float shown = clamp(ps, 5.0, 72.0);
  gl_PointSize = shown;
  vCol = mix(ramp(t), vec3(1.0, 0.96, 0.88), 0.75 * heavy) * uGain * (1.0 + 3.0 * heavy) * min(1.0, (ps * ps) / (shown * shown));
}`;

const FS_PART = `#version 300 es
precision highp float;
in vec3 vCol; out vec4 o;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float f = (exp(-r2 * 26.0) + 0.16 * exp(-r2 * 4.5)) * max(0.0, 1.0 - r2);   // heller Kern, schwacher Hof
  o = vec4(vCol * f, 1.0);
}`;

const VS_STAR = `#version 300 es
uniform mat4 uVP; uniform float uSize;
void main(){ gl_Position = uVP * vec4(0.0, 0.0, 0.0, 1.0); gl_PointSize = clamp(uSize / gl_Position.w, 4.0, 240.0); }`;

const FS_STAR = `#version 300 es
precision highp float;
uniform float uGain; out vec4 o;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float f = (1.0 / (1.0 + r2 * 90.0)) * max(0.0, 1.0 - r2);
  o = vec4(vec3(1.0, 0.9, 0.74) * f * uGain, 1.0);
}`;

const VS_LINE = `#version 300 es
layout(location = 0) in vec3 aPos; uniform mat4 uVP;
void main(){ gl_Position = uVP * vec4(aPos, 1.0); }`;

const FS_FLAT = `#version 300 es
precision highp float; uniform vec4 uColor; out vec4 o;
void main(){ o = uColor; }`;

// Belichtung, Sternhintergrund und Ausgabe
const FS_TONE = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uHdr;
uniform vec2 uRes;
uniform vec3 uR, uU, uF;
uniform float uExposure;
out vec4 o;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec3 hdr = texelFetch(uHdr, ivec2(gl_FragCoord.xy), 0).rgb;
  vec2 ndc = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  vec3 dir = normalize(uF + ndc.x * uR + ndc.y * uU);
  vec3 a = abs(dir); vec2 st; float face;
  if (a.x >= a.y && a.x >= a.z) { st = dir.yz / a.x; face = dir.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z)          { st = dir.xz / a.y; face = dir.y > 0.0 ? 2.0 : 3.0; }
  else                          { st = dir.xy / a.z; face = dir.z > 0.0 ? 4.0 : 5.0; }
  vec2 gcell = st * 64.0; vec2 id = floor(gcell) + face * 131.0; vec2 f = fract(gcell);
  vec2 sp = vec2(hash(id + 3.1), hash(id + 7.7)) * 0.6 + 0.2;
  float star = step(0.93, hash(id)) * smoothstep(0.075, 0.0, length(f - sp)) * (0.2 + 0.8 * hash(id + 1.3));
  vec3 bg = vec3(0.010, 0.014, 0.028) + vec3(0.012, 0.016, 0.034) * (1.0 - 0.7 * length(ndc));
  bg += vec3(0.75, 0.82, 1.0) * star * 0.32;
  // Helligkeit weich stauchen und dabei den Farbton halten, damit dichte Gebiete Struktur behalten
  vec3 c = hdr * uExposure;
  float peak = max(c.r, max(c.g, c.b));
  c /= 1.0 + peak;
  c = mix(c, vec3(1.0), 0.5 * smoothstep(6.0, 60.0, peak));
  c += bg * (1.0 - max(c.r, max(c.g, c.b)));
  o = vec4(pow(c, vec3(0.92)), 1.0);
}`;

Disk.shaders = {
  triangle: VS_TRI,            // bildschirmfüllendes Dreieck für alle Rechen- und Nachbearbeitungsdurchgänge
  drift: FS_DRIFT,
  kick: FS_KICK,
  merge: FS_MERGE,
  particleVertex: VS_PART,
  particleFragment: FS_PART,
  starVertex: VS_STAR,
  starFragment: FS_STAR,
  lineVertex: VS_LINE,
  flat: FS_FLAT,
  tone: FS_TONE,
};
})(globalThis.Disk = globalThis.Disk || {});

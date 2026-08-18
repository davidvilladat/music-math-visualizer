precision highp float;

attribute float aIndex;
// Lorenz Rosette only: one step of the CPU-integrated trajectory. See
// lorenzFormula for why this cannot be computed in the shader.
attribute vec3  aLorenz;
// Mira Plume only: one step of the CPU-walked Gumowski-Mira orbit, for the same
// reason aLorenz exists.
attribute vec2  aMira;

uniform float uTime;
uniform float uVariant;
uniform float uZoom;
uniform float uWaveAmp;
uniform float uBrightness;
uniform float uBass;
uniform float uMid;
uniform float uBrilliance;
uniform float uFlux;
uniform float uBeatPulse;
uniform float uRms;
uniform float uTempoRate;
uniform float uBandWarp;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uPhrasePhase;
uniform float uBarPulse;
uniform float uSectionEnergy;
uniform float uReactivity;
// 0 on the steady preset, 1 on every other: switches beat-driven motion off
// outright rather than scaling it down, so steady never twitches on a hit.
uniform float uBeatGate;
// Scales the beat transient. Beats no longer touch the clock rate, so this is
// the only channel by which a hit reaches the picture.
uniform float uBeatKick;
// Tempo-estimate confidence, 0..1. Gates anything that locks to the musical
// phase, so a weak estimate falls back to free-running motion.
uniform float uTempoLock;
uniform vec4  uProfile; // bass, mid, high, beat
uniform vec2  uResolution;

varying vec3  vColor;
varying float vAlpha;
varying float vTip;
varying float vCore;
varying float vMask;

const float BASE_COUNT = 10000.0;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

vec2 rotate2(vec2 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float signedInv(float v, float minAbs) {
  return sign(v) / max(abs(v), minAbs);
}

float safeTan(float v) {
  return clamp(tan(v), -8.0, 8.0);
}

float attractorF(float x) {
  float u = -0.8;
  return u * x + 2.0 * (1.0 - u) * x * x / (1.0 + x * x);
}

vec2 originalFormula(float i, float layer, out float tip, out float core) {
  float x = i + layer * 0.31;
  float y = x / 235.0;

  float k = 4.0 * cos(x / 21.0);
  float e = y / 8.0 - 20.0;
  float d = length(vec2(k, e));
  float safeInvK = sign(k) / max(abs(k), 0.1);

  float waveInner = 9.0 + uMid * 6.0 * uWaveAmp * uBandWarp;
  float q = 3.0 * sin(k * 2.0)
          + 0.3 * safeInvK
          + sin(y / 19.0) * k * (waveInner + 2.0 * uWaveAmp * sin(e * 14.0 - d * 3.0 + uTime * 2.0));

  float c = d - uTime;
  float armR = 50.0 + uBass * 40.0 * uBandWarp;
  float px = q + armR * cos(c) + 200.0;
  float py = q * sin(c) + d * 39.0 - 475.0;

  float kNorm = abs(k) / 4.0;
  float redCluster = smoothstep(0.78, 0.96, kNorm);
  float bead = smoothstep(0.70, 0.98, sin(x * 0.052 + layer * 1.7) * 0.5 + 0.5);
  tip = clamp(redCluster * (0.72 + bead * 0.55), 0.0, 1.0);
  core = smoothstep(0.15, 0.70, 1.0 - kNorm);

  return vec2(px - 200.0, -(py - 210.0));
}

vec2 featherFormula(float i, float layer, out float tip, out float core) {
  // Based on the provided p5 one-liner:
  // q=y*k/5*(2+sin(d*2+y-t*4)); x=q+90*cos(d/3-t/2+i%2)+200;
  // y=q*sin(c)+d*29-170. The surrounding helper values are chosen to keep
  // the same feather-like motion and density in a normalized WebGL scene.
  float x = i / 790.0 + layer * 0.002;
  float y = i / 235.0 + layer * 0.08;

  float k = 4.0 * cos(i / 21.0 + layer * 0.11);
  float e = y / 8.0 - 20.0;
  float d = length(vec2(k, e));
  float parity = mod(i, 2.0);

  float q = y * k / 5.0 * (2.0 + sin(d * 2.0 + y - uTime * 4.0));
  q *= 1.0 + uMid * 0.18 * uWaveAmp * uBandWarp;

  float c = d / 3.0 - uTime / 2.0 + parity;
  float px = q + 90.0 * cos(c) + 200.0;
  float py = q * sin(c) + d * 29.0 - 170.0;

  vec2 p = vec2(px - 200.0, -(py - 200.0));
  p = rotate2(p, -0.52);
  p.x *= 0.92;
  p.y *= 1.05;

  float strandEdge = smoothstep(0.62, 0.96, abs(sin(c)));
  float outer = smoothstep(0.58, 0.95, abs(k) / 4.0);
  float bead = smoothstep(0.60, 0.96, sin(i * 0.041 + layer * 2.2) * 0.5 + 0.5);
  tip = clamp(strandEdge * outer * (0.65 + bead * 0.65), 0.0, 1.0);
  core = smoothstep(2.5, 10.0, d) * (1.0 - smoothstep(17.0, 24.0, d));

  return p;
}

vec2 pulseFormula(float i, float layer, out float tip, out float core) {
  // Based on the provided p5 one-liner:
  // k=(4+sin(y*2-t)*3)*cos(x/29); e=y/8-13;
  // q=3*sin(k*2)+.3/k+sin(y/25)*k*(9+4*sin(e*9-d*3+t*2));
  // x=q+30*cos(d-t)+200; y=q*sin(c)+d*39-220.
  float x = i + layer * 0.37;
  float y = i / 235.0 + layer * 0.09;

  float k = (4.0 + sin(y * 2.0 - uTime) * 3.0) * cos(x / 29.0);
  float e = y / 8.0 - 13.0;
  float d = length(vec2(k, e));
  float safeInvK = sign(k) / max(abs(k), 0.1);

  float q = 3.0 * sin(k * 2.0)
          + 0.3 * safeInvK
          + sin(y / 25.0) * k * (
              9.0 + 4.0 * uWaveAmp * sin(e * 9.0 - d * 3.0 + uTime * 2.0)
            );
  q *= 1.0 + uMid * 0.14 * uBandWarp;

  float c = d - uTime;
  float px = q + 30.0 * cos(c) + 200.0;
  float py = q * sin(c) + d * 39.0 - 220.0;

  vec2 p = vec2(px - 200.0, -(py - 210.0));
  p = rotate2(p, 0.18);
  p.x *= 1.08;
  p.y *= 0.98;

  float kNorm = clamp(abs(k) / 7.0, 0.0, 1.0);
  float outer = smoothstep(0.62, 0.95, kNorm);
  float crest = smoothstep(0.62, 0.98, sin(d * 1.2 + y * 0.05 + layer) * 0.5 + 0.5);
  tip = clamp(outer * crest, 0.0, 1.0);
  core = smoothstep(2.0, 8.5, d) * (1.0 - smoothstep(14.0, 22.0, d));

  return p;
}

vec2 gridFormula(float raw, out float tip, out float core) {
  float sample = mod(raw, 8200.0);
  float detail = floor(raw / 8200.0);
  float row = floor(sample / 200.0);
  float col = mod(sample, 200.0);
  float x = 100.0 + col;
  float y = 99.0 + row * 5.0 + detail * 0.55;

  float k = x / 8.0 - 25.0;
  float e = y / 8.0 - 25.0;
  float d = dot(vec2(k, e), vec2(k, e)) / 99.0;
  float cy = cos(y * 5.0);
  float safeCos = sign(cy) / max(abs(cy), 0.08);
  float q = x / 3.0 + k * 0.5 * safeCos * sin(d * d - uTime);
  float c = d / 2.0 - uTime / 8.0;
  float px = q * sin(c) + e * sin(d + k - uTime) + 200.0;
  float py = (q + y / 8.0 + d * 9.0) * cos(c) + 200.0;

  float edge = smoothstep(15.0, 33.0, length(vec2(k, e)));
  float crest = smoothstep(0.62, 0.98, sin(d * 2.2 + detail) * 0.5 + 0.5);
  tip = edge * crest;
  core = smoothstep(0.12, 0.84, 1.0 - edge + crest * 0.2);
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 orbitFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 10000.0);
  float layer = floor(raw / 10000.0);
  float x = mod(i, 200.0);
  float y = i / 55.0 + layer * 0.09;

  float k = 9.0 * cos(x / 8.0);
  float e = y / 8.0 - 12.5;
  float d = dot(vec2(k, e), vec2(k, e)) / 99.0 + sin(uTime) / 6.0 + 0.5;
  float q = 99.0 - e * sin(atan(k, e) * 7.0) / max(d, 0.08)
          + k * (3.0 + cos(d * d - uTime) * 2.0);
  float c = d / 2.0 + e / 69.0 - uTime / 16.0;
  float px = q * sin(c) + 200.0;
  float py = (q + 19.0 * d) * cos(c) + 200.0;

  float ring = smoothstep(0.35, 0.96, abs(sin(c * 2.0)));
  tip = ring * smoothstep(5.0, 9.0, abs(k));
  core = smoothstep(1.0, 7.0, d) * (1.0 - smoothstep(15.0, 25.0, d));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 wingFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 10000.0);
  float layer = floor(raw / 10000.0);
  float y = i / 790.0 + layer * 0.04;
  float lowY = 6.0 + sin(floor(y) + 1.0) * 6.0;
  float k = (y < 5.0 ? lowY : 4.0 + cos(y)) * cos(i + uTime / 4.0);
  float e = y / 3.0 - 13.0;
  float d = length(vec2(k, e)) + sin(e / 4.0 - uTime) / 3.0;
  float q = y * k / 5.0 * (2.0 + sin(d * 2.0 + y - uTime * 4.0));
  float c = d / 3.0 - uTime / 2.0 + mod(i, 2.0);
  float px = q + 90.0 * cos(c) + 200.0;
  float py = q * sin(c) + d * 29.0 - 170.0;

  vec2 p = vec2(px - 200.0, -(py - 200.0));
  p = rotate2(p, -0.48);
  float outer = smoothstep(3.0, 9.0, abs(k));
  float bead = smoothstep(0.56, 0.96, sin(i * 0.04 + layer * 2.0) * 0.5 + 0.5);
  tip = outer * bead * smoothstep(0.45, 0.92, abs(sin(c)));
  core = smoothstep(2.0, 10.0, d) * (1.0 - smoothstep(16.0, 24.0, d));
  return p;
}

vec2 bloomFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 20000.0);
  float layer = floor(raw / 20000.0);
  float x = mod(i, 100.0);
  float y = i / 350.0 + layer * 0.08;
  float k = x / 4.0 - 12.5;
  float e = y / 9.0;
  float o = length(vec2(k, e)) / 9.0;
  float safeInvK = 1.0 / max(abs(k), 0.12) * sign(k);
  float q = x / 3.0 + 99.0 + 3.0 * safeInvK * sin(y)
          + k * (1.0 + cos(y) / 3.0 + sin(e + o * 4.0 - uTime * 2.0));
  float c = o / 5.0 + e / 4.0 - uTime / 8.0;
  float px = q * cos(c) + 200.0;
  float py = (q + 49.0) * sin(c) * cos(c) - q / 3.0 + 30.0 * o + 220.0;

  float petal = smoothstep(0.55, 0.98, abs(sin(c * 2.0)));
  tip = petal * smoothstep(0.8, 2.6, o);
  core = smoothstep(0.2, 1.2, o) * (1.0 - smoothstep(3.0, 5.0, o));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 ribbonFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 30000.0);
  float layer = floor(raw / 30000.0);
  float x = mod(i, 100.0);
  float y = i / 150.0 + layer * 0.06;
  float k = x / 4.0 - 12.5;
  float e = y / 9.0;
  float o = length(vec2(k, e)) / 9.0;
  float safeInvK = 1.0 / max(abs(k), 0.12) * sign(k);
  float q = x + 99.0 + cos(9.0 * safeInvK)
          + o * k * (cos(e * 9.0) / 3.0 + cos(y / 9.0) / 0.7) * sin(o * 4.0 - uTime);
  float c = o * e / 30.0 - uTime / 8.0;
  float px = q * 0.7 * sin(c) + 200.0;
  float py = 200.0 + y / 9.0 * cos(c * 4.0 - uTime / 2.0) - q / 2.0 * cos(c);

  float fold = smoothstep(0.55, 0.98, abs(cos(c * 3.0)));
  tip = fold * smoothstep(1.1, 3.2, o);
  core = smoothstep(0.3, 2.0, o) * (1.0 - smoothstep(4.0, 7.0, o));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 helixFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 10000.0);
  float layer = floor(raw / 10000.0);
  float x = mod(i, 200.0);
  float y = i / 43.0 + layer * 0.08;
  float k = 5.0 * cos(x / 14.0) * cos(y / 30.0);
  float e = y / 8.0 - 13.0;
  float d = dot(vec2(k, e), vec2(k, e)) / 59.0 + 4.0;
  float q = 60.0 - 3.0 * sin(atan(k, e) * e)
          + k * (3.0 + 4.0 / max(d, 0.08) * sin(d * d - uTime * 2.0));
  float c = d / 2.0 + e / 99.0 - uTime / 18.0;
  float px = q * sin(c) + 200.0;
  float py = (q + d * 9.0) * cos(c) + 200.0;

  tip = smoothstep(0.62, 0.98, abs(sin(c * 2.5))) * smoothstep(2.8, 5.0, abs(k));
  core = smoothstep(3.0, 8.0, d) * (1.0 - smoothstep(15.0, 26.0, d));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 fieldFormula(float raw, out float tip, out float core) {
  float y = 100.0 + floor(raw / 200.0);
  float x = 100.0 + mod(raw, 200.0);
  float k = x / 8.0 - 25.0;
  float e = y / 8.0 - 25.0;
  float d = 5.0 * cos(length(vec2(k, e)) / 3.0);
  float px = (x + d * k * sin(d * 2.5 - uTime) + k / 2.0 * sin(y / 3.0 + uTime)) / 2.0 + 100.0;
  float py = d * 19.0 + (d - 2.0) * 5.0 * abs(cos(d / 2.0 - uTime / 2.0)) + d * e + 215.0;

  tip = smoothstep(3.0, 5.0, abs(d)) * smoothstep(0.50, 0.96, abs(sin(d * 1.7 - uTime)));
  core = smoothstep(0.5, 4.0, abs(d));
  return vec2(px - 160.0, -(py - 225.0));
}

vec2 echoFormula(float raw, out float tip, out float core) {
  float i = raw;
  float x = mod(i, 200.0);
  float y = i / 200.0;
  float k = x / 8.0 - 12.5;
  float e = cos(k) + sin(y / 24.0) + cos(k / 2.0);
  float d = abs(e);
  float q = x / 4.0 + 90.0 + d * k * (1.0 + cos(d * 4.0 - uTime * 2.0 + y / 72.0));
  float c = y * e / 594.0 - uTime / 8.0 + d / 6.0;
  float px = q * cos(c) + 200.0;
  float py = (q / 2.0 + 99.0 * cos(c / 2.0)) * sin(c) + e * 6.0 + 200.0;

  tip = smoothstep(0.8, 2.8, d) * smoothstep(0.58, 0.98, abs(cos(c * 2.0)));
  core = smoothstep(0.2, 1.6, d);
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 flareFormula(float raw, out float tip, out float core) {
  float i = raw;
  float x = mod(i, 200.0);
  float y = i / 200.0;
  float k = x / 8.0 - 12.5;
  float e = y / 8.0 - 12.5;
  float o = length(vec2(k, e)) / 12.0 * cos(sin(k / 2.0) * cos(e / 2.0));
  float d = 5.0 * cos(o);
  float px = (x + d * k * (sin(d * 2.0 + uTime) + sin(y * o * o) / 9.0)) / 1.5 + 133.0;
  float py = (y / 3.0 - d * 40.0 + 19.0 * cos(d + uTime)) * 1.5 + 300.0;

  tip = smoothstep(3.2, 5.0, abs(d)) * smoothstep(0.55, 0.98, abs(sin(o * 3.0)));
  core = smoothstep(0.4, 4.2, abs(d));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 surgeFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 10000.0) + 1.0;
  float layer = floor(raw / 10000.0);
  float x = i + layer * 0.33;
  float y = i / 235.0 + layer * 0.08;
  float k = (4.0 + sin(x / 11.0 + uTime * 8.0)) * cos(x / 14.0);
  float e = y / 8.0 - 19.0;
  float d = length(vec2(k, e)) + sin(y / 9.0 + uTime * 2.0);
  float q = 2.0 * sin(k * 2.0) + sin(y / 17.0) * k * (9.0 + 2.0 * sin(y - d * 3.0));
  float c = d * d / 49.0 - uTime;
  float px = q + 50.0 * cos(c) + 200.0;
  float py = q * sin(c) + d * 39.0 - 440.0;

  float crest = smoothstep(0.55, 0.98, abs(sin(c)));
  tip = crest * smoothstep(2.8, 5.0, abs(k));
  core = smoothstep(3.0, 9.0, d) * (1.0 - smoothstep(14.0, 23.0, d));
  return vec2(px - 200.0, -(py - 210.0));
}

vec2 lyraFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 10000.0) + 1.0;
  float layer = floor(raw / 10000.0);
  float x = i + layer * 0.21;
  float y = i / 235.0 + layer * 0.06;
  float k = (4.0 + cos(y)) * cos(x / 4.0);
  float e = y / 8.0 - 20.0;
  float d = length(vec2(k, e));
  float q = sin(k * 3.0) + sin(y / 19.0 + 9.0) * k * (6.0 + sin(e * 14.0 - d));
  float c = d - uTime;
  float px = q * cos(d / 8.0 + uTime / 4.0) + 50.0 * cos(c) + 200.0;
  float py = q * sin(c) + d * 7.0 * sin(c / 4.0) + 200.0;

  tip = smoothstep(0.50, 0.96, abs(sin(c))) * smoothstep(3.0, 5.0, abs(k));
  core = smoothstep(1.0, 7.0, d) * (1.0 - smoothstep(14.0, 24.0, d));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 veilFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 20000.0);
  float layer = floor(raw / 20000.0);
  float x = mod(i, 100.0);
  float y = i / 250.0 + layer * 0.08;
  float k = x / 4.0 - 12.5;
  float e = y / 9.0 + 9.0;
  float o = length(vec2(k, e)) / 9.0;
  float invK = signedInv(k, 0.14);
  float q = x + 99.0 + safeTan(invK)
          + o * k * (cos(e * 9.0) / 2.0 + cos(y / 9.0) / 0.7) * sin(o * 4.0 - uTime * 2.0);
  float c = o * e / 30.0 - uTime / 8.0;
  float px = q * 0.7 * sin(c) + 200.0;
  float py = 200.0 + y * cos(c * 4.0 - o) - q / 2.0 * cos(c);

  tip = smoothstep(0.65, 0.98, abs(cos(c * 2.0))) * smoothstep(1.0, 3.2, o);
  core = smoothstep(0.4, 1.8, o) * (1.0 - smoothstep(4.0, 7.0, o));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 emberFormula(float raw, out float tip, out float core) {
  float i = raw;
  float x = mod(i, 200.0);
  float y = i / 200.0;
  float k = x / 8.0 - 12.0;
  float e = y / 8.0 - 12.0;
  float o = 2.0 - length(vec2(k, e)) / 3.0;
  float d = -5.0 * abs(sin(k / 2.0) * cos(e * 0.8));
  float px = (x - d * k * 4.0 + d * k * sin(d + uTime)) * 0.7 + k * o * 2.0 + 130.0;
  float py = (y - d * y / 5.0 + d * e * cos(d + uTime + o) * sin(uTime + d)) * 0.7 + e * o + 70.0;

  tip = smoothstep(2.5, 5.0, abs(d)) * smoothstep(0.48, 0.96, abs(sin(uTime + d)));
  core = smoothstep(-3.0, 1.5, o);
  return vec2(px - 200.0, -(py - 190.0));
}

vec2 glintFormula(float raw, out float tip, out float core) {
  float i = raw;
  float x = mod(i, 200.0);
  float y = i / 200.0;
  float k = x / 8.0 - 12.5;
  float e = y / 8.0 - 12.5;
  float o = dot(vec2(k, e), vec2(k, e)) / 169.0;
  float d = 0.5 + 5.0 * cos(o);
  float spark = pow(abs(d * sin(k) * sin(uTime * 4.0 + e)), 2.0);
  float px = x + d * k * sin(d * 2.0 + o + uTime) + e * cos(e + uTime) + 100.0;
  float py = o * 135.0 - y / 4.0 - d * 6.0 * cos(d * 3.0 + o * 9.0 + uTime) + 125.0;

  tip = clamp(spark * 0.05, 0.0, 1.0);
  core = smoothstep(0.1, 2.0, abs(d));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 waveFormula(float raw, out float tip, out float core) {
  float sample = mod(raw, 20200.0);
  float detail = floor(raw / 20200.0);
  float row = floor(sample / 200.0);
  float col = mod(sample, 200.0);
  float x = 100.0 + col;
  float y = 99.0 + row * 2.0 + detail * 0.35;
  float k = x / 8.0 - 25.0;
  float e = y / 8.0 - 25.0;
  float d = cos(length(vec2(k, e)) / 3.0) * e / 5.0;
  float q = x / 4.0 + k * signedInv(cos(y / 9.0), 0.08) * sin(d * 9.0 - uTime) + 25.0;
  float c = d - uTime / 8.0;
  float px = q * sin(c) + 200.0;
  float py = (q * 2.0 + x + y / 2.0 + d * 90.0) / 4.0 * cos(c) + 200.0;

  tip = smoothstep(0.60, 0.98, abs(sin(d * 2.0 - uTime))) * smoothstep(4.0, 8.5, abs(d));
  core = smoothstep(0.5, 5.0, abs(d));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 cycloneFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 10000.0) + 1.0;
  float layer = floor(raw / 10000.0);
  float x = i + layer * 0.23;
  float y = i / 41.0 + layer * 0.08;
  float k = 5.0 * cos(x / 19.0) * cos(y / 30.0);
  float e = y / 8.0 - 12.0;
  float d = dot(vec2(k, e), vec2(k, e)) / 59.0 + 2.0;
  float q = 4.0 * sin(atan(k, e) * 9.0) + 9.0 * sin(d - uTime)
          - k / max(d, 0.08) * (9.0 + sin(d * 9.0 - uTime * 16.0) * 3.0);
  float c = d * d / 7.0 - uTime;
  float px = q + 50.0 * cos(c) + 200.0;
  float py = q * sin(c) + d * 45.0 - 9.0;

  tip = smoothstep(0.55, 0.98, abs(sin(c))) * smoothstep(3.0, 5.0, abs(k));
  core = smoothstep(2.0, 8.0, d) * (1.0 - smoothstep(15.0, 28.0, d));
  return vec2(px - 200.0, -(py - 210.0));
}

vec2 latticeFormula(float raw, out float tip, out float core) {
  float sample = mod(raw, 13400.0);
  float detail = floor(raw / 13400.0);
  float row = floor(sample / 200.0);
  float col = mod(sample, 200.0);
  float x = 100.0 + col;
  float y = 99.0 + row * 3.0 + detail * 0.45;
  float k = x / 8.0 - 25.0;
  float e = y / 8.0 - 25.0;
  float o = length(vec2(k, e)) / 4.0;
  float c = o * e / 50.0 - uTime / 8.0;
  float q = x + y / 3.0 + k * signedInv(cos(y / 8.0), 0.08) + signedInv(k, 0.12)
          + o * k * cos(y / 8.0 - uTime) * sin(o * 4.0 - uTime);
  float px = q / 3.0 * atan(2.0 * sin(c)) + 200.0;
  float py = (y * safeTan(c) + q) / 3.0 * cos(c) + 200.0;

  tip = smoothstep(0.62, 0.98, abs(cos(c * 2.0))) * smoothstep(3.0, 8.0, o);
  core = smoothstep(2.0, 6.0, o) * (1.0 - smoothstep(8.0, 13.0, o));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 petalFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 30000.0);
  float layer = floor(raw / 30000.0);
  float x = mod(i, 100.0);
  float y = i / 350.0 + layer * 0.08;
  float k = x / 4.0 - 12.5;
  float e = y / 9.0;
  float o = length(vec2(k, e)) / 9.0;
  float q = 99.0 + 3.0 * (safeTan(y / 2.0) / 2.0 + cos(y)) * signedInv(k, 0.14)
          + k * (3.0 + cos(y) / 3.0 + sin(e + o * 4.0 - uTime * 2.0));
  float c = o / 4.0 + e / 4.0 - uTime / 8.0;
  float px = q * cos(c) * cos(c / 2.0 - e / 3.0 + uTime / 8.0) + 200.0;
  float py = q * sin(c) + 200.0;

  tip = smoothstep(0.55, 0.98, abs(sin(c * 2.0))) * smoothstep(1.0, 3.2, o);
  core = smoothstep(0.3, 1.6, o) * (1.0 - smoothstep(3.5, 6.0, o));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 cometFormula(float raw, out float tip, out float core) {
  float i = mod(raw, 30000.0) + 1.0;
  float y = i / 799.0;
  float k = 5.0 * cos(i / 48.0);
  float e = 5.0 * cos(y / 9.0);
  float d = pow(length(vec2(k, e)) / (6.0 + mod(i, 4.0)), 4.0) + 4.0;
  float parityTerm = mix(-1.0, -2.0, step(0.5, mod(floor(i), 2.0)));
  float q = k * (3.0 + e / 2.0 * sin(d * 8.0 + k / 9.0 - uTime))
          - 3.0 * sin(k * d / 3.0)
          - parityTerm * 80.0;
  float c = d - uTime / 9.0 + mod(i, 5.0);
  float px = q * sin(c) + 200.0;
  float py = q * cos(c - mod(i, 2.0) + mod(i, 5.0) * 3.0 + 7.0) + 200.0;

  tip = smoothstep(0.55, 0.98, abs(sin(c))) * smoothstep(4.0, 7.0, d);
  core = smoothstep(3.5, 5.5, d) * (1.0 - smoothstep(8.0, 12.0, d));
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 chromaFormula(float raw, out float tip, out float core) {
  float x = 100.0 + mod(raw, 200.0);
  float y = 100.0 + floor(raw / 200.0);
  float k = x / 8.0 - 25.0;
  float e = y / 8.0 - 25.0;
  float o = length(vec2(k, e)) / 3.0;
  float d = 5.0 * cos(o);
  float denom = atan(9.0 * cos(e));
  float q = x / 2.0 + k * signedInv(denom, 0.12) * sin(d * 4.0 - uTime);
  float c = d / 3.0 - uTime / 8.0;
  float px = q * sin(c) + 200.0;
  float py = (y / 3.0 + d + q) / 2.0 * cos(c) + 200.0;

  tip = smoothstep(0.55, 0.98, abs(sin(d * 1.4 + uTime))) * smoothstep(2.0, 5.0, abs(d));
  core = smoothstep(1.0, 7.0, o) * (1.0 - smoothstep(8.0, 13.0, o));
  return vec2(px - 200.0, -(py - 200.0));
}

// Chroma is drawn as a facing pair. The point set is split in half and each half
// walks an interleaved sample of the same field, so both copies carry the whole
// shape at half density. The second copy is point-reflected through the midline,
// so the two look at each other across the gap, and one shared spin turns the
// pair as a single rigid body.
// Where Chroma's dense bulb sits in the raw field, measured off a single copy.
// It holds still while the field churns, so one constant anchors every pairing
// that places the head rather than the field origin.
const vec2 CHROMA_HEAD = vec2(-105.0, 33.0);

// One half of a Chroma pair: an interleaved sample of the field so each copy
// carries the whole shape at half density, re-anchored on its own head. side
// picks which half of the point budget feeds this copy.
vec2 chromaHalf(float raw, float side, out float tip, out float core) {
  float local = mod(raw, 20000.0);
  float sampleRaw = local * 2.0 + step(0.0, -side);
  return chromaFormula(sampleRaw, tip, core) - CHROMA_HEAD;
}

vec2 chromaPairFormula(float raw, out float tip, out float core) {
  float side = raw < 20000.0 ? 1.0 : -1.0;
  float local = mod(raw, 20000.0);
  float sampleRaw = local * 2.0 + step(0.0, -side);

  vec2 p = chromaFormula(sampleRaw, tip, core);

  // The gap breathes on the low end so the two seem to lean in and back off.
  float gap = 72.0
            + uBass * 5.0 * uBandWarp * uReactivity
            + uBarPulse * 3.0 * uReactivity * uBeatGate;

  p *= 0.5;
  p *= side;                 // the far copy is turned to face back
  p.y += side * gap;

  float spin = uTime * 0.24 + uSectionEnergy * 0.35 * uReactivity;
  p = rotate2(p, spin);

  // Charge the facing edges so the confrontation reads across the midline.
  float facing = 1.0 - smoothstep(8.0, 62.0, length(p));
  tip = clamp(tip + facing * 0.24, 0.0, 1.0);
  return p;
}

// The other way to stand the Chroma pair up. chromaPairFormula anchors each copy
// at the field origin, which throws the dense heads outward and leaves the tails
// meeting in the middle. Here each copy is re-anchored on its own head and then
// turned so that head points back across the midline: the two bulbs come nose to
// nose with the tails streaming outward, and the shared spin turns the stare as
// one body.
vec2 chromaGazeFormula(float raw, out float tip, out float core) {
  float side = raw < 20000.0 ? 1.0 : -1.0;
  float local = mod(raw, 20000.0);
  float sampleRaw = local * 2.0 + step(0.0, -side);

  vec2 p = chromaFormula(sampleRaw, tip, core) - CHROMA_HEAD;

  // Measured nose to nose, so the low end opens the stare rather than driving
  // the two bulbs through one another.
  float reach = 34.0
              + uBass * 5.0 * uBandWarp * uReactivity
              + uBarPulse * 3.0 * uReactivity * uBeatGate;

  p *= 0.40;
  p *= side;                 // the far copy is turned to face back
  p.x += side * reach;       // ...set down head inward, tail streaming out

  float spin = uTime * 0.24 + uSectionEnergy * 0.35 * uReactivity;
  p = rotate2(p, spin);

  // The held stare is the subject, so the meeting point carries the accent.
  float meeting = 1.0 - smoothstep(4.0, 40.0, length(p));
  tip = clamp(tip + meeting * 0.30, 0.0, 1.0);
  return p;
}

// Chroma in single file. Both copies hold the same heading and sit half a body
// apart, so the follower's head rides in the leader's tail. The shared spin
// sweeps the whole file around the frame, like a pursuit that never closes.
vec2 chromaWakeFormula(float raw, out float tip, out float core) {
  float side = raw < 20000.0 ? 1.0 : -1.0;
  vec2 p = chromaHalf(raw, side, tip, core);

  float lead = 54.0
             + uBass * 7.0 * uBandWarp * uReactivity
             + uBarPulse * 4.0 * uReactivity * uBeatGate;

  p *= 0.40;
  p.x += side * lead;        // same heading, one set down behind the other
  p -= vec2(52.0, -28.0);    // the file runs off its own centre, not the head's

  float spin = uTime * 0.24 + uSectionEnergy * 0.35 * uReactivity;
  p = rotate2(p, spin);

  // The gap the follower is trying to close is the subject.
  float draft = 1.0 - smoothstep(10.0, 66.0, length(p));
  tip = clamp(tip + draft * 0.26, 0.0, 1.0);
  return p;
}

// Chroma reflected rather than turned. The second copy is a mirror image across
// the shared heading, so both heads point the same way and the tails open out
// symmetrically -- a pair of wings rather than two separate bodies.
vec2 chromaMirrorFormula(float raw, out float tip, out float core) {
  float side = raw < 20000.0 ? 1.0 : -1.0;
  vec2 p = chromaHalf(raw, side, tip, core);

  float spread = 52.0
               + uBass * 6.0 * uBandWarp * uReactivity
               + uBarPulse * 4.0 * uReactivity * uBeatGate;

  p *= 0.38;
  p.y = side * (p.y + spread);   // reflected across the axis, never rotated
  p.x -= 49.0;

  float spin = uTime * 0.24 + uSectionEnergy * 0.35 * uReactivity;
  p = rotate2(p, spin);

  // The seam where the two reflections meet carries the accent.
  float seam = 1.0 - smoothstep(4.0, 46.0, abs(p.y * cos(spin) - p.x * sin(spin)));
  tip = clamp(tip + seam * 0.22, 0.0, 1.0);
  return p;
}

// Chroma set on a circle. Each copy is swung until its heading lies along the
// tangent and parked at opposite ends of a diameter, so the two chase each
// other around the ring while the spin carries the ring itself.
vec2 chromaWaltzFormula(float raw, out float tip, out float core) {
  float side = raw < 20000.0 ? 1.0 : -1.0;
  vec2 p = chromaHalf(raw, side, tip, core);

  float radius = 46.0
               + uBass * 6.0 * uBandWarp * uReactivity
               + uBarPulse * 4.0 * uReactivity * uBeatGate;

  p *= 0.36;
  p = rotate2(p, -1.5707963);   // heading swung off the body axis onto the tangent
  p.x += radius;
  p *= side;                    // the far copy takes the other end of the diameter

  float spin = uTime * 0.30 + uSectionEnergy * 0.40 * uReactivity;
  p = rotate2(p, spin);

  // Light the hub the two are turning about.
  float hub = 1.0 - smoothstep(8.0, 52.0, length(p));
  tip = clamp(tip + hub * 0.24, 0.0, 1.0);
  return p;
}

// Chroma's mirror pairing pushed until it reads as a wing pair. Mirror reflects
// across the horizontal, which stacks the two copies; wings want the vertical,
// so the pair spreads left and right off a shared spine. Each copy is pivoted on
// the far end of its body rather than on its head, which puts the dense bulb out
// at the wingtip -- the same placement that made Mirror read -- and leaves the
// thin filament end at the root. The dihedral then beats about that root, so the
// wings stroke instead of merely turning.
vec2 chromaSeraphFormula(float raw, out float tip, out float core) {
  float side = raw < 20000.0 ? 1.0 : -1.0;
  vec2 p = chromaHalf(raw, side, tip, core);

  // The stroke is the whole illusion. Held still it is two commas; let the
  // dihedral beat and the same two copies read as wings.
  float stroke = max(uBeatPulse, exp(-uBeatPhase * 6.5) * 0.5) * uBeatGate;
  // A phase ramp is self-correcting: it lands on the beat grid every cycle and
  // cannot drift the way a rate modulation does, because it is read rather than
  // integrated. When the tempo estimate is weak, fall back to the free sine so
  // the wings keep stroking instead of stalling.
  float wingPhase = mix(sin(uTime * 0.9), sin(uBarPhase * 6.2831853), uTempoLock);
  float sweep = 0.92
              + wingPhase * 0.12
              + stroke * 0.18 * uReactivity
              + uBass * 0.08 * uBandWarp * uReactivity;

  p *= 0.34;
  p -= vec2(62.0, -20.0);           // pivot inboard on the body, not on the bulb
  p = rotate2(p, 3.14159265 + sweep);
  p.x *= side;                      // reflected across the spine, not turned about it
  p.x += side * 6.0;                // roots set just apart so the joint stays legible
  p.y -= 43.0;                      // the pair rides high on the spine; drop it onto the spin centre

  // Slower than the other pairings: here the stroke carries the motion, and a
  // fast turn on top of it just muddies the beat.
  float spin = uTime * 0.14 + uSectionEnergy * 0.22 * uReactivity;
  p = rotate2(p, spin);

  // The spine the two wings hang off is the one place they meet.
  float joint = 1.0 - smoothstep(4.0, 40.0, length(p));
  tip = clamp(tip + joint * 0.20, 0.0, 1.0);
  return p;
}

// Mandelbrot Twins: two complete 30k-point samples of the same set. The left
// copy keeps the canonical right-facing cusp while the right copy is reflected,
// so their cusps face across a shared hub. Escape time controls density and
// colour emphasis; a shared rotation turns the pair as one body.
// Principal square root of a complex number, written without atan so the branch
// stays stable as the imaginary part crosses zero.
vec2 csqrt(vec2 w) {
  float r = length(w);
  float a = sqrt(max(0.5 * (r + w.x), 0.0));
  float b = sqrt(max(0.5 * (r - w.x), 0.0));
  return vec2(a, w.y < 0.0 ? -b : b);
}

vec2 mandelbrotTwinsFormula(float raw, out float tip, out float core, out float mask) {
  // Drawn by inverse iteration rather than by escape time. Running z -> z*z + c
  // forwards and plotting the orbit gives nothing usable here: the map is
  // chaotic, so consecutive iterates land far apart and the result is stipple.
  // Run backwards, z -> +/-sqrt(z - c), and every step contracts onto the Julia
  // set instead, so the points land along its filaments -- which is both the
  // house style and, taken level by level, the fractal's own construction.
  //
  // Each level doubles the number of preimages, so sweeping a depth frontier
  // through the tree is literally watching the fractal increase: 2 points, then
  // 4, then 8, the dendrite thickening and reaching further with every level.
  const float MAX_DEPTH = 14.0;

  float side = raw < 30000.0 ? -1.0 : 1.0;
  float local = mod(raw, 30000.0);

  // Index -> (depth, path). Level d holds 2^d points and starts at 2^d - 2, so
  // one log recovers the level and the remainder is the branch word.
  float depth = min(floor(log2(local + 2.0)), MAX_DEPTH);
  float path = local + 2.0 - exp2(depth);

  // c rides the main cardioid, just inside it. The margin is what decides the
  // whole character: leave the cardioid and the Julia set breaks into dust that
  // renders as scattered specks, while sitting well inside it (0.96) gives a
  // smooth loop whose deeper levels only add density. Hugging the boundary keeps
  // the set connected while its dimension climbs toward 2, so it is one
  // continuous curve wrinkled at every scale -- and each new level of the tree
  // resolves finer wrinkles, which is the growth this visual is about.
  float theta = uTime * 0.045 + uPhrasePhase * 0.35 * uTempoLock;
  vec2 e1 = vec2(cos(theta), sin(theta));
  vec2 e2 = vec2(cos(2.0 * theta), sin(2.0 * theta));
  vec2 c = (0.5 * e1 - 0.25 * e2) * 0.998;

  // Start at the repelling fixed point, which the backward map pushes away from
  // and onto the set.
  vec2 z = 0.5 * (vec2(1.0, 0.0) + csqrt(vec2(1.0, 0.0) - 4.0 * c));

  for (int k = 0; k < 14; k++) {
    if (float(k) < depth) {
      vec2 root = csqrt(z - c);
      // Bit k of the path picks the branch, so each point is one exact leaf of
      // the preimage tree rather than a random walk that only lands near it.
      float bit = mod(floor(path / exp2(float(k))), 2.0);
      z = bit < 0.5 ? -root : root;
    }
  }

  // The frontier sweeps through the levels, swelling and retracting so the cycle
  // has no reset to pop through.
  float growCycle = mix(fract(uTime * 0.05), uPhrasePhase, uTempoLock);
  float grow = 0.5 - 0.5 * cos(6.2831853 * growCycle);
  float reveal = 3.0 + grow * MAX_DEPTH;
  float ahead = depth - reveal;
  float behind = 1.0 - smoothstep(0.0, 1.6, ahead);

  vec2 m = z * 62.0;
  m.x *= -side;              // the cusp points inward on both copies

  float partnerRock = sin(uBarPhase * 6.2831853) * 0.055 * uTempoLock;
  m = rotate2(m, side * partnerRock);

  float radius = 40.0
               + uBass * 8.0 * uBandWarp * uReactivity
               + uBarPulse * 5.0 * uReactivity * uBeatGate;
  vec2 p = m + vec2(side * radius, 0.0);

  float spin = uTime * 0.16 + uSectionEnergy * 0.28 * uReactivity;
  p = rotate2(p, spin);

  // Every level stays present, faintly, rather than being cut away ahead of the
  // frontier. The tree is exponential -- level d holds 2^d points -- so a hard
  // cutoff leaves 2^reveal points on screen, which is a near-empty frame for
  // most of the cycle and the whole fractal only at the peak. Holding a floor
  // keeps the figure legible throughout while the sweep still lights each level
  // as it is reached; since the deepest levels carry almost all the points, what
  // reads is the fine detail blooming in.
  mask = 0.22 + 0.78 * behind;

  // The level currently being added carries the accent.
  float frontier = exp(-ahead * ahead * 0.75);
  core = 1.0 - smoothstep(0.30, 1.60, length(z));
  tip = clamp(frontier * 0.75 + core * 0.20, 0.0, 1.0);

  float hub = 1.0 - smoothstep(8.0, 44.0, length(p));
  tip = clamp(tip + hub * 0.20, 0.0, 1.0);
  return p;
}

// Nautilus: unlike the grid-sampled fields above, this one sweeps a single
// parameter, so the point set is one continuous curve rather than a surface --
// wound into a scroll by the fast cos in k running against the slow ramp in e.
// The parity term shifts every other index three radians along that curve,
// which is what splits the scroll into two lobes instead of leaving one.
//
// sin(e/2) passes through zero twice across the sweep, and the division by it
// throws two near-vertical sprays off the body. Those are the figure, not an
// artefact of it, so the guard only catches the exact-zero case and the rest is
// left to run off-frame -- clipped by the viewport exactly as the original was
// clipped by its canvas.
// rate scales the clock: 3.0 is the source's own tempo (it steps t by PI/80 a
// frame where this clock runs at PI/240), and Nacre runs the same figure slower.
// sweep comes back as the point's position along the body, tail 0 to head 1 --
// the sweep parameter itself, before it is wound into the scroll, which is the
// one coordinate that stays fixed to the shell while the figure turns.
vec2 nautilusFormula(float raw, float rate, out float tip, out float core, out float sweep) {
  float t = uTime * rate;

  float layer = floor(raw / BASE_COUNT);
  float idx = mod(raw, BASE_COUNT);
  // Four offset copies of the same 10k sweep. The offset stays well under one
  // index step so it thickens each strand rather than drawing four figures.
  float i = idx + layer * 0.25;

  float y = i / 253.0;
  sweep = y / 39.53;            // i/253 over the full 10k sweep, normalised
  float k = 5.0 * cos(i / 44.0);
  float e = y / 2.0 - 15.0;
  float d = length(vec2(k, e)) / 3.0;

  // Parity is read off the whole index, so all four copies of a point land in
  // the same lobe instead of the offset smearing them across both.
  float c = d / 2.0 - t / 3.0 + mod(idx, 2.0) * 3.0;

  float spray = y * k * e * signedInv(77.0 * sin(e / 2.0), 0.6);

  float px = (79.0 + d * d + k * k) * sin(c) + 200.0
           + d * d * d / 4.0 * cos(t * 3.0 - d * d / 4.0);
  float py = 99.0 * cos(c / 2.0) + 4.0 * sin(k * 2.0) + spray + 200.0;

  // The sprays carry the accent; the scroll itself is graded by how far out in
  // the sweep the point sits.
  tip = clamp(smoothstep(55.0, 240.0, abs(spray)) * 0.88
            + smoothstep(0.62, 0.99, abs(sin(c))) * 0.22, 0.0, 1.0);
  core = smoothstep(1.5, 3.4, d) * (1.0 - smoothstep(4.4, 5.4, d));
  return vec2(px - 200.0, -(py - 200.0));
}

// Frond: the source writes the amplitude switch as sin(y^9), and ^ in JS is a
// bitwise XOR on the truncated value rather than a power -- so that term is a
// step function of floor(y), constant across each unit band. That is what gives
// the figure its stacked segments instead of a smooth taper, so it is worth
// reproducing exactly rather than smoothing: 9 is 1001b, and over the 0..6 range
// the branch admits, XOR by it just flips bit 0 and sets bit 3.
vec2 frondFormula(float raw, out float tip, out float core) {
  // The source steps t by PI/90 a frame where this clock runs at PI/240.
  float t = uTime * (240.0 / 90.0);

  float layer = floor(raw / BASE_COUNT);
  float idx = mod(raw, BASE_COUNT);
  // Four offset copies of the same 10k sweep, the offset kept well under one
  // index step so it thickens each strand rather than drawing four figures.
  float i = idx + layer * 0.25;

  float y = i / 790.0;
  float band = floor(y);
  float bandXorNine = 8.0 + (mod(band, 2.0) < 0.5 ? band + 1.0 : band - 1.0);
  float amp = y < 7.0 ? 8.0 + sin(bandXorNine) * 6.0 : 4.0 + cos(y);

  float k = amp * cos(i + t / 2.0);
  float e = y / 2.0 - 13.0;
  float d = length(vec2(k, e));

  float q = y * k / 5.0 * (2.0 + sin(d * 2.0 + y - t * 4.0)) + 80.0;
  // Parity is read off the whole index, so all four copies of a point land on
  // the same frond instead of the offset smearing them across both.
  float c = d / 4.0 - t / 2.0 + mod(idx, 2.0) * 3.0;

  float px = q * cos(c) * cos(c / 2.0 + e / 8.0) + 200.0;
  float py = q * d / 8.0 * sin(c) + 200.0;

  vec2 p = vec2(px - 200.0, -(py - 200.0));
  tip = clamp(smoothstep(105.0, 195.0, length(p)) * 0.80
            + smoothstep(0.72, 0.995, abs(sin(c))) * 0.20, 0.0, 1.0);
  core = smoothstep(6.5, 13.0, d) * (1.0 - smoothstep(17.0, 20.0, d));
  return p;
}

// Lorenz Rosette: the source integrates the Lorenz system inside the same loop
// that draws it, so each sample depends on the one before it and there is
// nothing for a vertex shader to parallelise -- every point would have to replay
// the whole run. The trajectory is identical every frame though, since only the
// projection reads the clock, so it is integrated once on the CPU and arrives
// here as an attribute and the shader is left with just the projection.
//
// mod(i, 9) is what makes it a rosette: it fans that one trajectory into nine
// copies set eight radians apart, each breathing on its own phase.
vec2 lorenzFormula(float raw, out float tip, out float core) {
  // The source counts frames, and this clock advances PI/240 a frame, so a
  // frame count is uTime * 240/PI and both phase rates fall out of it.
  float sweep = uTime * 12.0;   // frames * PI/20
  float turn  = uTime * 0.5;    // frames * PI/480

  // The source counts i down from 30000, so the arm a sample belongs to is read
  // off the descending index rather than the ascending one.
  float arm = mod(29999.0 - raw, 9.0);

  float e = sin(sweep - aLorenz.x * aLorenz.x / 99.0 + arm) + 1.0;
  float q = aLorenz.x * e + 89.0;
  float k = aLorenz.z / 59.0 - e / 29.0 + turn + arm * 8.0;

  float px = q * cos(k) + 200.0;
  float py = 200.0 - (q + 60.0 * cos(k / 2.0)) * sin(k);

  vec2 p = vec2(px - 200.0, -(py - 200.0));
  // Height on the attractor grades the wing, so the two lobes of each butterfly
  // read apart instead of merging into one blob.
  core = smoothstep(4.0, 30.0, aLorenz.z) * (1.0 - smoothstep(40.0, 50.0, aLorenz.z));
  tip = clamp(smoothstep(1.35, 1.98, e) * 0.55
            + smoothstep(115.0, 170.0, length(p)) * 0.45, 0.0, 1.0);
  return p;
}

// Mira Plume: the Gumowski-Mira map. attractorFormula above already uses this
// map's f(), but samples it as short independent orbits from scattered starts;
// here it is the single 40k orbit the source draws, walked from (1, 1), so what
// shows is the attractor's own woven shell rather than a cloud around it.
//
// Like Lorenz Rosette this is a serial recurrence with nothing for the shader to
// parallelise, and again the orbit itself never reads the clock -- only the
// projection wrapped around it does. So it is walked once on the CPU and arrives
// as an attribute, and this function is just that projection.
vec2 miraFormula(out float tip, out float core) {
  // The source steps t by PI/45 a frame where this clock runs at PI/240.
  float t = uTime * (240.0 / 45.0);

  float radius = length(aMira);
  float c = t - radius / 4.0;

  float px = aMira.y * (5.0 * sin(c) + 11.0) + 205.0;
  float py = aMira.x * (2.0 * cos(c) + 7.0) + 9.0 * sin(aMira.y / 4.0 + t) + 185.0;

  vec2 p = vec2(px - 200.0, -(py - 200.0));
  // c is the clock minus the orbit's own radius, so sin(c) bands the figure
  // along that radius -- the rings read as structure in the attractor rather
  // than as a pattern laid over the screen.
  tip = clamp(smoothstep(112.0, 186.0, length(p)) * 0.70
            + smoothstep(0.62, 0.99, abs(sin(c))) * 0.26, 0.0, 1.0);
  core = smoothstep(2.0, 13.0, radius) * (1.0 - smoothstep(22.0, 27.5, radius));
  return p;
}

// Tandem: one sweep read at two phases rather than two figures placed apart.
// m is 0 or 3 by index parity and enters both the radius q and the angle c, so
// the offset sets the halves on opposite sides of the hub and keeps them facing
// across it as the whole thing circles. Nothing here positions them relative to
// each other -- that reading falls out of the single phase offset.
vec2 tandemFormula(float raw, out float tip, out float core) {
  // The source steps t by PI/45 a frame where this clock runs at PI/240.
  float t = uTime * (240.0 / 45.0);

  float layer = floor(raw / 20000.0);
  float local = mod(raw, 20000.0);
  // Two offset copies of the same 20k sweep, the offset kept under one index
  // step so it thickens the strands rather than drawing the pair twice.
  float i = local + layer * 0.5;

  // Read off the whole index, so both copies of a point stay in the same half.
  float m = mod(local, 2.0) * 3.0;

  float k = 9.0 * cos(i / 61.0);
  float e = i / 652.0 - 13.0;
  // Squared magnitude, and the +1 floor means k/d below never blows up.
  float d = (k * k + e * e) / 89.0 + 1.0;

  float q = 79.0 - e / 2.0 * sin(k)
          + k / d * (6.0 + 5.0 * sin(sin(d * d + e / 9.0 - t + m)));
  float c = d / 1.9 + cos(t - d * 3.0 + m) / 11.0 - t / 16.0 + m;

  float px = q * sin(c) + 200.0;
  float py = (q + 40.0) * cos(c) + 200.0;

  vec2 p = vec2(px - 200.0, -(py - 200.0));

  core = smoothstep(1.2, 3.0, d) * (1.0 - smoothstep(4.6, 5.6, d));
  // Charge the gap the two hold across, the way the other facing pairs do --
  // it is the one place the relationship between them is visible.
  float between = 1.0 - smoothstep(12.0, 74.0, length(p));
  tip = clamp(smoothstep(118.0, 172.0, length(p)) * 0.55
            + smoothstep(0.62, 0.99, abs(sin(c * 2.0))) * 0.24
            + between * 0.22, 0.0, 1.0);
  return p;
}

vec2 attractorFormula(float raw, out float tip, out float core) {
  float x = 1.0 + (hash(raw * 1.7) - 0.5) * 0.05;
  float y = 1.0 + (hash(raw * 2.3 + 11.0) - 0.5) * 0.05;
  float target = 6.0 + mod(raw, 36.0);
  for (int j = 0; j < 42; j++) {
    float active = step(float(j), target);
    float n = y + (1.0 - 0.06 * y * y) * 0.003 * y + attractorF(x);
    float nextX = n;
    float nextY = attractorF(n) - x;
    x = mix(x, nextX, active);
    y = mix(y, nextY, active);
  }
  float c = uTime - length(vec2(x, y)) / 4.0;
  float px = y * (5.0 * sin(c) + 11.0) + 205.0;
  float py = x * (2.0 * cos(c) + 7.0) + 9.0 * sin(y / 4.0 + uTime) + 185.0;

  float r = length(vec2(x, y));
  tip = smoothstep(0.3, 1.4, r) * smoothstep(0.55, 0.98, abs(sin(c)));
  core = smoothstep(0.1, 1.1, r);
  return vec2(px - 200.0, -(py - 200.0));
}

vec2 prismFormula(float raw, out float tip, out float core) {
  float i = raw + 7.0;
  float sector = mod(floor(raw), 3.0);
  float k = mod(i, 25.0) - 12.0;
  float e = i / 800.0;
  float d = 7.0 * cos(length(vec2(k, e)) / 3.0 + uTime / 2.0);
  float px = k * 4.0 + d * k * sin(d + e / 9.0 + uTime) + 200.0;
  float py = e * 2.0 - d * 9.0 - d * 9.0 * cos(d + uTime) + 200.0;
  vec2 p = vec2(px - 200.0, -(py - 200.0));
  p = rotate2(p, sector * 2.0943951);

  tip = smoothstep(4.0, 7.0, abs(d)) * smoothstep(0.55, 0.98, abs(sin(e + uTime)));
  core = smoothstep(0.5, 5.0, abs(d));
  return p;
}

vec2 contactFormula(float raw, out float tip, out float core) {
  // Two mirrored descendants of Orbit's polar k/e/d/q/c formulation.
  // 38k points form the entities; 2k form sparse incomplete contact tendrils.
  float slowCycle = 0.5 - 0.5 * cos(uTime * 0.09);
  float approach = smoothstep(0.10, 0.92, slowCycle)
                 * (0.64 + uSectionEnergy * 0.36);
  float separation = 36.0 - approach * 12.0
                   - uBass * 4.0 * uBandWarp * uReactivity;

  if (raw < 38000.0) {
    float side = raw < 19000.0 ? -1.0 : 1.0;
    float local = mod(raw, 19000.0);
    float orbitTip = 0.0;
    float orbitCore = 0.0;
    vec2 entity = orbitFormula(local, orbitTip, orbitCore);

    // At first their internal pulses disagree. As the slow build advances,
    // their orbital precession and pulse phases converge.
    float syncPhase = side * (1.0 - approach) * 1.45;
    float heartbeat = 1.0
                    + sin(uTime * 2.25 + syncPhase) * 0.025
                    + uBeatPulse * 0.025 * uReactivity * uBeatGate;
    float precession = side * (0.12 + approach * 0.075)
                     + sin(uTime * 0.32 + syncPhase) * (1.0 - approach) * 0.055;
    entity *= vec2(0.42, 0.40) * heartbeat;
    entity = rotate2(entity, precession);

    vec2 p = vec2(
      side * separation + side * entity.x,
      entity.y + 24.0
    );

    float inward = 1.0 - smoothstep(3.0, 28.0, abs(p.x));
    tip = clamp(orbitTip * 0.42 + inward * approach * 0.68, 0.0, 1.0);
    core = clamp(orbitCore * 0.82 + (1.0 - inward) * 0.12, 0.0, 1.0);
    return p;
  }

  // Four filaments per entity grow inward but preserve a small charged gap.
  float bridgeRaw = raw - 38000.0;
  float side = bridgeRaw < 1000.0 ? -1.0 : 1.0;
  float local = mod(bridgeRaw, 1000.0);
  float strand = mod(floor(local), 4.0);
  float s = floor(local / 4.0) / 249.0;
  float endGap = 3.0 + (1.0 - approach) * 7.0;
  float startX = side * (24.0 - approach * 8.0);
  float endX = side * endGap;
  float envelope = sin(s * 3.14159265);
  float orbitalPhase = s * 6.2831853 * (1.0 + strand * 0.25)
                     + uTime * (0.34 + strand * 0.045);

  vec2 p = vec2(
    mix(startX, endX, s),
    (strand - 1.5) * 3.2 * envelope
    + sin(orbitalPhase) * envelope * (3.0 + uFlux * 5.0 * uReactivity)
  );
  p.y += sin(s * 3.14159265 + uTime * 0.22) * side * 2.2 * (1.0 - s);
  p.y -= 18.0;

  tip = clamp(smoothstep(0.36, 0.94, s) * (0.78 + approach * 0.22), 0.0, 1.0);
  core = 0.72 + envelope * 0.28;
  return p;
}

// ---------------------------------------------------------------------------
// Birdwing (variant 26) is the abstract wing: a gesture, not an anatomy. Plumes
// launch off a crescent leading edge, curl outward as they run, and are
// mirrored into a pair over a burning core. Three depth bands sit behind one
// another at different scale, rotation and brightness. Nothing flaps -- the
// whole fan furls and unfurls on the beat, which reads as flight without
// pretending to be a bird.
//   phi(s) = P0 + (P1 - P0)·s^0.88                   launch angle across the fan
//   L(s)   = Lb·(0.34 + 0.66·sin(π·s^0.72)^0.55)     longest plume mid-fan
//   R(s)   = R0 + R1·sin(π·s)                        crescent the plumes leave from
//   θ(s,u) = phi + bend·(0.30 + 0.70·s)·u^1.35       outward curl along the plume
//   r(s,u) = R(s) + L(s)·u
//   vane(u) = sin(π·u^0.80)^0.50                     pinched at quill and tip
// ---------------------------------------------------------------------------

vec2 plumeStroke(float s, float u, float lat, float band, float bend,
                 out float tip, out float core) {
  float NS = 15.0 + band * 5.0;
  float si = floor(s * NS);
  float sc = (si + 0.5) / NS;

  // Leading edge: one quadratic sweep from the core out to the tip. Every
  // plume hangs off it, so the silhouette is the curve and nothing else.
  vec2 E0 = vec2(3.0, 1.0);
  vec2 E1 = vec2(44.0, 70.0);
  vec2 E2 = vec2(128.0, 42.0);
  float sr = sc + (s - sc) * 0.92;
  float mt = 1.0 - sr;
  vec2 e  = mt * mt * E0 + 2.0 * mt * sr * E1 + sr * sr * E2;
  vec2 et = normalize(2.0 * mt * (E1 - E0) + 2.0 * sr * (E2 - E1));
  vec2 en = normalize(mix(vec2(et.y, -et.x), vec2(-0.30, -0.95), 0.45));

  float len = (40.0 + band * 12.0) * (0.32 + 0.68 * pow(sc, 0.70));
  len *= 1.0 + (hash(si * 4.1 + band * 19.0) - 0.5) * 0.20;
  len *= 1.0 + 0.34 * step(0.90, hash(si * 2.7 + band * 7.0 + 3.0));
  len *= 1.0 + (uRms * 0.10 + uSectionEnergy * 0.08) * uReactivity;

  vec2 dir = rotate2(en, bend * (0.35 + 0.65 * sc) * pow(u, 1.30)
                       + 0.045 * sin(u * 8.0 + si * 2.3 + uTime * 0.7));
  float vane = 0.34 + 0.66 * pow(max(sin(3.14159265 * pow(u, 0.80)), 0.0), 0.50);
  vec2 p = e + en * 3.4 + dir * len * u
         + vec2(-dir.y, dir.x) * lat * (1.0 + band * 0.35) * vane;

  float rachis = 1.0 - smoothstep(0.05, 0.40, abs(lat));
  core = (0.12 + rachis * 0.66)
       * (0.40 + 0.60 * smoothstep(0.0, 0.30, u))
       * (1.0 - 0.62 * smoothstep(0.50, 1.0, u));
  tip = smoothstep(0.46, 1.0, u) * (0.30 + 0.38 * sc)
      + uBrilliance * 0.10 * uBandWarp * uReactivity * smoothstep(0.6, 1.0, u);
  return p;
}

vec2 birdwingFormula(float raw, out float tip, out float core) {
  tip = 0.0;
  core = 0.0;

  // One slow furl cycle, pushed open by bass and each beat. Nothing flaps --
  // the whole fan opens and closes, which reads as flight without miming it.
  float bend = -0.34 - 0.22 * sin(uTime * 0.31)
             - (uBass * 0.20 + uBeatPulse * 0.16 * uBeatGate) * uBandWarp * uReactivity;

  vec2 p;
  if (raw < 38000.0) {
    float band;
    float i;
    if (raw < 7600.0)       { band = 0.0; i = raw; }
    else if (raw < 19000.0) { band = 1.0; i = raw - 7600.0; }
    else                    { band = 2.0; i = raw - 19000.0; }

    float s   = fract(i * 0.6180339887 + band * 0.37);
    float u   = pow(hash(i * 1.31 + band * 53.0), 1.38);
    float lat = hash(i * 2.17 + band * 11.0) * 2.0 - 1.0;

    p = plumeStroke(s, u, lat, band, bend + band * 0.13, tip, core);

    // depth: 1 = furthest back. The bands nest rather than fan apart, so the
    // stack reads as one wing seen through itself.
    float depth = 1.0 - band * 0.5;
    p *= 1.0 - depth * 0.13;
    p = rotate2(p, depth * 0.17 + 0.07 * sin(uTime * 0.27 + band * 1.3));
    core *= 1.0 - depth * 0.46;
    tip *= 1.0 - depth * 0.38;
  } else if (raw < 39400.0) {
    // A drawn quill along the leading edge: one crisp line to hold the soft
    // mass together.
    float i = raw - 38000.0;
    float t = fract(i * 0.6180339887);
    float xi = hash(i * 3.1 + 13.0) * 2.0 - 1.0;
    float mt = 1.0 - t;
    vec2 e  = mt * mt * vec2(3.0, 1.0) + 2.0 * mt * t * vec2(44.0, 70.0)
            + t * t * vec2(128.0, 42.0);
    vec2 et = normalize(2.0 * mt * (vec2(44.0, 70.0) - vec2(3.0, 1.0))
                      + 2.0 * t * (vec2(128.0, 42.0) - vec2(44.0, 70.0)));
    p = e + vec2(-et.y, et.x) * xi * (1.5 - 1.1 * t);
    core = (1.0 - smoothstep(0.2, 1.0, abs(xi))) * (1.0 - 0.45 * t);
    tip = 0.20 * t;
  } else {
    // The ember the wing grows out of.
    float i = raw - 39400.0;
    float aa = hash(i * 1.7 + 5.0) * 6.2831853;
    float rr = pow(hash(i * 2.9 + 7.0), 1.7);
    float glow = 9.0 * (1.0 + uBeatPulse * 0.30 * uReactivity * uBeatGate);
    p = vec2(3.0, 1.0) + vec2(cos(aa), sin(aa) * 0.75) * rr * glow;
    core = 1.0 - rr * 0.5;
    tip = 0.28 + 0.42 * rr;
  }

  // Stand the wing up on a diagonal and centre it in frame.
  p = rotate2(p, 0.16 + 0.035 * sin(uTime * 0.19));
  return p - vec2(52.0, 18.0);
}

// One point on a crane wing modeled as a fan of NF discrete feathers
// radiating from the shoulder. f ∈ [0,1] across the fan (0 = inner
// secondaries, 1 = outer primaries), u ∈ [0,1] along the feather.
//   feather j of N: α_j = αin + (αout − αin)·(j + ½)/N
//   P(f, u) = S + u·L(f)·(cos α, sin α),  L(f) = Λ·(0.42 + 0.58·sstep(0.30, 0.95, f))
//   mobility: α += Φ·sin(ωt)·(0.55 + 0.45f) + 0.55·Φ·sin(ωt − 1)·u²
// (outer feathers swing farther; tips flex with a phase delay). Each feather
// also carries a static curl κ·f·u for the drooped primary silhouette.
// row selects the layer: 0 = flight feathers, 1 = median coverts (~38% L),
// 2 = lesser coverts (~21% L) — the scalloped rows of the papercraft look.
vec2 craneWingPoint(float f, float u, float row, vec2 shoulder, float size,
                    float angIn, float angOut, float flapPhase,
                    out float tip, out float core) {
  float covert = min(row, 1.0);
  float NF = row < 0.5 ? 23.0 : row < 1.5 ? 27.0 : 31.0;
  float fi = floor(f * NF);
  float fc = (fi + 0.5) / NF;
  float lat = fract(f * NF) - 0.5;

  float flapAmp = 0.22 + uWaveAmp * 0.08
                + (uBass * 0.17 + uBeatPulse * 0.10 * uBeatGate) * uBandWarp * uReactivity;
  flapAmp *= 0.58 + 0.42 * (0.5 + 0.5 * sin(uTime * 0.13 + flapPhase)) + uSectionEnergy * 0.20;
  float flap = flapAmp * sin(uTime * 1.25 + flapPhase);
  float flex = flapAmp * 0.55 * sin(uTime * 1.25 + flapPhase - 1.0);

  // Quills attach along the wing bone, not all at one hub: secondaries root
  // near the body, primaries out at the hand. Spreading the origins is what
  // opens the inner wing into separate layered feathers.
  // Secondaries root progressively out along the forearm; past the wrist
  // (fc > 0.62) every primary shares one origin and fans from it, which is
  // what gives the splayed fingers at the tip.
  float boneAng = angIn + (angOut - angIn) * 0.88;
  vec2 root = shoulder + size * 0.30 * smoothstep(0.04, 0.62, fc)
            * vec2(cos(boneAng), sin(boneAng));

  float len = size * (0.34 + 0.40 * smoothstep(0.28, 1.0, fc));
  len *= 1.0 + 0.26 * smoothstep(0.70, 1.0, fc) * (1.0 - covert);
  len *= 1.0 + (hash(fi * 7.7 + row * 31.0) - 0.5) * 0.06;
  len *= row < 0.5 ? 1.0
       : row < 1.5 ? 0.44 + 0.06 * hash(fi * 3.3 + 17.0)
       : 0.26 + 0.04 * hash(fi * 5.1 + 29.0);

  float spanAng = (angOut - angIn)
                * (1.0 + (uBeatPulse * 0.10 * uBeatGate + uBass * 0.06) * uBandWarp * uReactivity);
  // Each feather is a vane, not a spoke: the lateral spread follows a leaf
  // profile that pinches shut at the quill and again at the tip, so the fan
  // reads as separate overlapping feathers instead of a swept gradient.
  float vane = row < 0.5
             ? pow(max(sin(3.14159265 * pow(u, 0.82)), 0.0), 0.55)
             : pow(max(sin(3.14159265 * u), 0.0), 0.42);
  float fill = mix(0.84, 0.98, covert) * vane;
  float curl = (hash(fi * 9.1 + row * 13.0) - 0.5) * 0.08 + 0.14 * fc * (1.0 - covert);
  float barb = 0.006 * sin(u * 52.0 + fi * 9.0) * (1.0 - covert);
  float splay = (angOut - angIn) * 0.20 * smoothstep(0.68, 1.0, fc) * (1.0 - covert);
  float a = angIn + spanAng * (fc + lat * fill / NF) + splay
          + curl * u
          + barb
          + flap * (0.55 + 0.45 * fc)
          + flex * u * u * (0.35 + 0.30 * fc);
  vec2 p = root + u * len * vec2(cos(a), sin(a));

  float rachis = 1.0 - smoothstep(0.06, 0.42, abs(lat));
  core = row < 0.5
       ? (0.16 + rachis * 0.62) * (0.52 + 0.48 * u)
         * (1.0 - 0.34 * smoothstep(0.76, 1.0, u))
       : row < 1.5 ? 0.36 : 0.43;
  tip = (1.0 - covert) * smoothstep(0.88, 1.0, u) * smoothstep(0.60, 0.95, fc) * 0.45;
  return p;
}

// A complete crane seen from above, flying up-screen. local in [0, count);
// every budget split is a fraction of `count`, so the same bird renders at
// any point budget. `phase` offsets the wingbeat, bob, and soar cycle so
// multiple cranes fly out of step.
//   wings: mirrored craneWingPoint fans about each shoulder — secondaries
//     trail aft, primaries reach spanwise; the vertical stroke appears as
//     spanwise foreshortening cos θ, tips flexing back by (1 − cos θ) and
//     riding a slight camera tilt by sin θ
//   body: slim teardrop on the spine (0, -19) -> (0, 14), kept faint so the
//     wings carry the silhouette
//   neck: cubic S-Bezier (0, 14)->(0, 25)->(3, 33)->(11, 41) curving inward
//     so the head turns toward the partner; head, beak, red crown at its end
//   legs: two trailing Beziers ending in splayed toes; tail: aft feather fan
vec2 craneBird(float local, float count, float phase, out float tip, out float core) {
  vec2 p;
  tip = 0.0;
  core = 0.0;

  if (local < count * 0.82) {
    float wingC = count * 0.41;
    float rightW = local < wingC ? 1.0 : 0.0;
    float wLocal = rightW > 0.5 ? local : local - wingC;
    float mainCount = wingC * 0.80;
    float row;
    float i;
    if (wLocal < mainCount) {
      row = 0.0;
      i = wLocal;
    } else {
      float cLocal = wLocal - mainCount;
      float cSplit = (wingC - mainCount) * 0.60;
      row = cLocal < cSplit ? 1.0 : 2.0;
      i = cLocal < cSplit ? cLocal : cLocal - cSplit;
    }
    float f = fract(i * 0.6180339887 + row * 0.31);
    float u = pow(hash(i * 1.31 + row * 47.0 + rightW * 9.0), 0.55);
    if (row < 0.5) u = 0.20 + 0.80 * u;

    vec2 w = craneWingPoint(f, u, row, vec2(0.0, 0.0), 126.0, -1.34, 0.14, phase, tip, core);
    float flapAmp = 0.26 + uWaveAmp * 0.09
                  + (uBass * 0.19 + uBeatPulse * 0.11 * uBeatGate) * uBandWarp * uReactivity;
    flapAmp *= 0.58 + 0.42 * (0.5 + 0.5 * sin(uTime * 0.13 + phase)) + uSectionEnergy * 0.20;
    float theta = flapAmp * sin(uTime * 1.25 + phase);
    w.y += w.x * (sin(theta) * 0.20 - (1.0 - cos(theta)) * 0.35);
    w.x *= 0.62 + 0.38 * cos(theta);
    float side = rightW > 0.5 ? 1.0 : -1.0;
    p = vec2(side * (3.6 + w.x), 8.0 + w.y);
  } else if (local < count * 0.848) {
    float i = local - count * 0.82;
    float t = fract(i * 0.6180339887);
    float xi = hash(i * 1.7 + 3.0) * 2.0 - 1.0;
    float halfW = 7.2 * pow(sin(3.14159265 * t), 0.75) * (1.0 - 0.18 * t)
                * (1.0 + uRms * 0.10 * uReactivity);
    p = vec2(xi * halfW, -19.0 + 33.0 * t);
    core = (1.0 - smoothstep(0.25, 0.95, abs(xi))) * 0.68;
  } else if (local < count * 0.888) {
    float i = local - count * 0.848;
    float t = fract(i * 0.6180339887);
    float xi = hash(i * 2.1 + 5.0) * 2.0 - 1.0;
    vec2 P0 = vec2(0.0, 14.0);
    vec2 P1 = vec2(0.0, 25.0);
    vec2 P2 = vec2(3.0, 33.0);
    vec2 P3 = vec2(11.0, 41.0);
    float mt = 1.0 - t;
    vec2 b = mt * mt * mt * P0 + 3.0 * mt * mt * t * P1
           + 3.0 * mt * t * t * P2 + t * t * t * P3;
    vec2 tangent = normalize(3.0 * mt * mt * (P1 - P0) + 6.0 * mt * t * (P2 - P1)
                           + 3.0 * t * t * (P3 - P2));
    vec2 n = vec2(-tangent.y, tangent.x);
    b += n * sin(uTime * 1.25 + phase + 0.9) * 1.0 * t * (1.0 - t);
    float th = 3.5 * (1.0 - 0.30 * smoothstep(0.0, 0.62, t))
             + 1.1 * (1.0 - smoothstep(0.0, 0.25, t))
             + 1.5 * smoothstep(0.72, 1.0, t);
    p = b + n * xi * th;
    core = (1.0 - smoothstep(0.3, 0.95, abs(xi))) * 0.75;
  } else if (local < count * 0.906) {
    // Rounded skull straddling the neck joint: longer than it is deep, fullest
    // just behind the eye, so the head reads as a mass the beak grows out of
    // rather than a thicker last bead of the neck.
    float i = local - count * 0.888;
    float t = fract(i * 0.6180339887);
    float xi = hash(i * 2.7 + 9.0) * 2.0 - 1.0;
    vec2 d = normalize(vec2(0.72, 0.70));
    float prof = pow(max(sin(3.14159265 * pow(t, 0.86)), 0.0), 0.42);
    p = vec2(11.0, 41.0) + d * (t - 0.34) * 10.5
      + vec2(-d.y, d.x) * xi * 4.1 * prof;
    core = 0.92 * (1.0 - smoothstep(0.55, 1.0, abs(xi)));
  } else if (local < count * 0.917) {
    float i = local - count * 0.906;
    float t = fract(i * 0.6180339887);
    float xi = hash(i * 3.3 + 11.0) * 2.0 - 1.0;
    vec2 d = normalize(vec2(0.72, 0.70));
    p = vec2(11.0, 41.0) + d * (5.6 + t * 17.5)
      + vec2(-d.y, d.x) * xi * 1.7 * pow(1.0 - t, 0.8);
    core = 0.52;
    tip = 0.20 * t;
  } else if (local < count * 0.925) {
    float i = local - count * 0.917;
    float aa = hash(i * 1.9 + 21.0) * 6.2831853;
    float rr = sqrt(hash(i * 2.9 + 23.0));
    vec2 d = normalize(vec2(0.72, 0.70));
    vec2 n = vec2(-d.y, d.x);
    p = vec2(11.0, 41.0) + d * 1.4 + n * 2.2
      + (d * cos(aa) * 2.5 + n * sin(aa) * 1.35) * rr;
    tip = 1.0;
    core = 0.5;
  } else if (local < count * 0.955) {
    float i = local - count * 0.925;
    float lCount = count * 0.015;
    float leg = i < lCount ? 0.0 : 1.0;
    float li = i - leg * lCount;
    float t = fract(li * 0.6180339887);
    float xi = hash(li * 1.3 + 27.0 + leg * 8.0) * 2.0 - 1.0;
    float lx = leg > 0.5 ? 2.8 : -2.8;
    vec2 P0 = vec2(lx, -14.0);
    vec2 P1 = vec2(lx * 1.2, -30.0);
    vec2 P2 = vec2(lx * 1.3, -44.0);
    float mt = 1.0 - t;
    vec2 b = mt * mt * P0 + 2.0 * mt * t * P1 + t * t * P2;
    vec2 tangent = normalize(2.0 * mt * (P1 - P0) + 2.0 * t * (P2 - P1));
    vec2 n = vec2(-tangent.y, tangent.x);
    if (t < 0.88) {
      p = b + n * xi * 0.8;
    } else {
      float toeId = floor(hash(li * 3.7 + 31.0) * 2.9999) - 1.0;
      vec2 foot = 0.0144 * P0 + 0.2112 * P1 + 0.7744 * P2;
      vec2 ftan = normalize(0.24 * (P1 - P0) + 1.76 * (P2 - P1));
      p = foot + rotate2(ftan, toeId * 0.5) * (t - 0.88) / 0.12 * 4.0 + n * xi * 0.4;
    }
    p.x += sin(uTime * 1.25 + phase + 0.5) * 1.2 * t;
    core = 0.06;
  } else {
    float i = local - count * 0.955;
    float f = fract(i * 0.6180339887);
    float u = pow(hash(i * 1.31 + 33.0), 0.6);
    p = craneWingPoint(f, u, 0.0, vec2(0.0, -16.0), 27.0, -1.95, -1.19, phase + 0.6, tip, core);
    tip *= 0.3;
    core *= 0.45;
  }

  p.y += 2.0 * sin(uTime * 1.25 + phase + 1.3) * (0.6 + uWaveAmp * 0.4);
  p = rotate2(p, 0.03 * sin(uTime * 0.21 + phase));
  return p;
}

vec2 birdFormula(float raw, out float tip, out float core) {
  // A crane couple seen from above, climbing up-screen wingtip to wingtip.
  // The second bird mirrors the first, a beat-fraction out of step, and both
  // tilt and curve their necks inward so they look toward each other.
  vec2 p;
  if (raw < 20000.0) {
    p = craneBird(raw, 20000.0, 0.0, tip, core);
    p = rotate2(p * 0.60, -0.13) + vec2(-62.0, -24.0);
  } else {
    p = craneBird(raw - 20000.0, 20000.0, 0.7, tip, core);
    p.x = -p.x;
    p = rotate2(p * 0.60, 0.11) + vec2(62.0, 20.0);
  }
  return p;
}

void main() {
  float raw = aIndex - 1.0;
  float layer = floor(raw / BASE_COUNT);
  float i = mod(raw, BASE_COUNT) + 1.0;

  float tip = 0.0;
  float core = 0.0;
  float visibility = 1.0;
  float sweep = 0.0;
  vec2 p;
  if (uVariant < 0.5) {
    p = originalFormula(i, layer, tip, core);
  } else if (uVariant < 1.5) {
    p = featherFormula(i, layer, tip, core);
  } else if (uVariant < 2.5) {
    p = pulseFormula(i, layer, tip, core);
  } else if (uVariant < 3.5) {
    p = gridFormula(raw, tip, core);
  } else if (uVariant < 4.5) {
    p = orbitFormula(raw, tip, core);
  } else if (uVariant < 5.5) {
    p = wingFormula(raw, tip, core);
  } else if (uVariant < 6.5) {
    p = bloomFormula(raw, tip, core);
  } else if (uVariant < 7.5) {
    p = ribbonFormula(raw, tip, core);
  } else if (uVariant < 8.5) {
    p = helixFormula(raw, tip, core);
  } else if (uVariant < 9.5) {
    p = fieldFormula(raw, tip, core);
  } else if (uVariant < 10.5) {
    p = echoFormula(raw, tip, core);
  } else if (uVariant < 11.5) {
    p = flareFormula(raw, tip, core);
  } else if (uVariant < 12.5) {
    p = surgeFormula(raw, tip, core);
  } else if (uVariant < 13.5) {
    p = lyraFormula(raw, tip, core);
  } else if (uVariant < 14.5) {
    p = veilFormula(raw, tip, core);
  } else if (uVariant < 15.5) {
    p = emberFormula(raw, tip, core);
  } else if (uVariant < 16.5) {
    p = glintFormula(raw, tip, core);
  } else if (uVariant < 17.5) {
    p = waveFormula(raw, tip, core);
  } else if (uVariant < 18.5) {
    p = cycloneFormula(raw, tip, core);
  } else if (uVariant < 19.5) {
    p = latticeFormula(raw, tip, core);
  } else if (uVariant < 20.5) {
    p = petalFormula(raw, tip, core);
  } else if (uVariant < 21.5) {
    p = cometFormula(raw, tip, core);
  } else if (uVariant < 22.5) {
    p = chromaPairFormula(raw, tip, core);
  } else if (uVariant < 23.5) {
    p = attractorFormula(raw, tip, core);
  } else if (uVariant < 24.5) {
    p = prismFormula(raw, tip, core);
  } else if (uVariant < 25.5) {
    p = contactFormula(raw, tip, core);
  } else if (uVariant < 26.5) {
    p = birdwingFormula(raw, tip, core);
  } else if (uVariant < 27.5) {
    p = birdFormula(raw, tip, core);
  } else if (uVariant < 28.5) {
    p = chromaGazeFormula(raw, tip, core);
  } else if (uVariant < 29.5) {
    p = chromaWakeFormula(raw, tip, core);
  } else if (uVariant < 30.5) {
    p = chromaMirrorFormula(raw, tip, core);
  } else if (uVariant < 31.5) {
    p = chromaWaltzFormula(raw, tip, core);
  } else if (uVariant < 32.5) {
    p = chromaSeraphFormula(raw, tip, core);
  } else if (uVariant < 33.5) {
    p = mandelbrotTwinsFormula(raw, tip, core, visibility);
  } else if (uVariant < 34.5) {
    p = nautilusFormula(raw, 3.0, tip, core, sweep);
  } else if (uVariant < 35.5) {
    p = frondFormula(raw, tip, core);
  } else if (uVariant < 36.5) {
    p = lorenzFormula(raw, tip, core);
  } else if (uVariant < 37.5) {
    p = miraFormula(tip, core);
  } else if (uVariant < 38.5) {
    // A third of Nautilus' clock. Every term in that figure is driven by t, so
    // one scale on it slows the whole thing coherently rather than damping the
    // parts unevenly.
    p = nautilusFormula(raw, 0.75, tip, core, sweep);
  } else {
    p = tandemFormula(raw, tip, core);
  }

  float beatEnvelope = exp(-uBeatPhase * 6.5);
  float phraseSwing = sin(uPhrasePhase * 6.2831853);
  float barBreath = sin(uBarPhase * 6.2831853);
  float bassDrive = uBass * uProfile.x * uReactivity;
  float midDrive = uMid * uProfile.y * uReactivity;
  float highDrive = uBrilliance * uProfile.z * uReactivity;
  float beatDrive = max(uBeatPulse, beatEnvelope * 0.36 + uBarPulse * 0.24) * uProfile.w * uReactivity * uBeatGate * uBeatKick;

  tip = clamp(tip + beatDrive * 0.12 + uBarPulse * 0.10 * uProfile.w * uBeatGate, 0.0, 1.0);
  core = clamp(core + uSectionEnergy * 0.12, 0.0, 1.0);

  p = rotate2(p, phraseSwing * uSectionEnergy * 0.055 * uReactivity);
  p *= 1.0 + (uBarPulse * 0.045 * uBeatGate + uSectionEnergy * 0.055 + bassDrive * 0.025);

  float audioWarp = uBandWarp * (bassDrive * 0.95 + midDrive * 0.42 + uFlux * 0.55 * uReactivity);
  vec2 flowWarp = vec2(
    sin(p.y * 0.032 + uTime * (1.35 + uTempoRate * 0.35)),
    cos(p.x * 0.028 - uTime * (1.10 + uTempoRate * 0.45))
  );
  p *= 1.0 + audioWarp * 0.045;
  p += flowWarp * audioWarp * (2.6 + beatDrive * 4.2 + abs(barBreath) * 1.1);

  // Reuse the same jitter and grain sample in each 30k half of Mandelbrot so
  // small rendering imperfections do not break the twin symmetry.
  float scatterRaw = (uVariant > 32.5 && uVariant < 33.5) ? mod(raw, 30000.0) : raw;
  float scatterLayer = floor(scatterRaw / BASE_COUNT);
  float scatterIndex = mod(scatterRaw, BASE_COUNT) + 1.0;
  float jitterSeed = scatterIndex + scatterLayer * 127.13;
  vec2 jitter = vec2(hash(jitterSeed), hash(jitterSeed + 71.7)) - 0.5;
  float jitterAmp = mix(0.12, 0.42, min(scatterLayer, 3.0) / 3.0) * (uVariant < 0.5 ? 1.0 : uVariant < 1.5 ? 0.72 : 0.86);
  p += jitter * jitterAmp;

  float baseScale = 140.0;
  if (uVariant < 0.5) baseScale = 170.0;
  else if (uVariant < 1.5) baseScale = 118.0;
  else if (uVariant < 2.5) baseScale = 132.0;
  else if (uVariant < 3.5) baseScale = 150.0;
  else if (uVariant < 4.5) baseScale = 145.0;
  else if (uVariant < 5.5) baseScale = 118.0;
  else if (uVariant < 6.5) baseScale = 130.0;
  else if (uVariant < 7.5) baseScale = 132.0;
  else if (uVariant < 8.5) baseScale = 136.0;
  else if (uVariant < 9.5) baseScale = 112.0;
  else if (uVariant < 10.5) baseScale = 132.0;
  else if (uVariant < 11.5) baseScale = 145.0;
  else if (uVariant < 12.5) baseScale = 168.0;
  else if (uVariant < 13.5) baseScale = 118.0;
  else if (uVariant < 14.5) baseScale = 132.0;
  else if (uVariant < 15.5) baseScale = 126.0;
  else if (uVariant < 16.5) baseScale = 142.0;
  else if (uVariant < 17.5) baseScale = 150.0;
  else if (uVariant < 18.5) baseScale = 165.0;
  else if (uVariant < 19.5) baseScale = 134.0;
  else if (uVariant < 20.5) baseScale = 128.0;
  else if (uVariant < 21.5) baseScale = 190.0;
  else if (uVariant < 22.5) baseScale = 145.0;
  else if (uVariant < 23.5) baseScale = 42.0;
  else if (uVariant < 24.5) baseScale = 126.0;
  else if (uVariant < 25.5) baseScale = 112.0;
  else if (uVariant < 26.5) baseScale = 97.0;
  else if (uVariant < 27.5) baseScale = 132.0;
  else if (uVariant < 28.5) baseScale = 170.0;
  else if (uVariant < 29.5) baseScale = 150.0;
  else if (uVariant < 30.5) baseScale = 128.0;
  else if (uVariant < 31.5) baseScale = 135.0;
  else if (uVariant < 32.5) baseScale = 130.0;
  else if (uVariant < 33.5) baseScale = 120.0;
  else if (uVariant < 34.5) baseScale = 178.0;
  else if (uVariant < 35.5) baseScale = 200.0;
  else if (uVariant < 36.5) baseScale = 186.0;
  // 200 is the source's own half-canvas, so the plume frames exactly as it did
  // there -- including clipping the widest tips at full spread, which the
  // original did too.
  else if (uVariant < 37.5) baseScale = 200.0;
  else if (uVariant < 38.5) baseScale = 178.0;
  else baseScale = 195.0;
  float scale = baseScale / max(uZoom, 0.01);
  vec2 ndc = p / scale;
  if ((uVariant > 25.5 && uVariant < 27.5) || uVariant > 32.5) ndc.x /= max(uResolution.x, 1.0) / max(uResolution.y, 1.0);
  gl_Position = vec4(ndc, 0.0, 1.0);

  float grain = hash(scatterIndex * 3.17 + scatterLayer * 23.0);
  float thickness = uVariant < 0.5 ? 2.24 : uVariant < 1.5 ? 2.36 : uVariant < 2.5 ? 1.58 : uVariant > 38.5 ? 1.52 : uVariant > 37.5 ? 1.74 : uVariant > 36.5 ? 1.34 : uVariant > 35.5 ? 1.50 : uVariant > 34.5 ? 1.38 : uVariant > 33.5 ? 1.66 : uVariant > 32.5 ? 1.62 : uVariant > 27.5 ? 1.44 : uVariant > 25.5 ? 1.92 : uVariant > 24.5 ? 1.70 : 1.44;
  float baseSize = (mix(1.18, 2.05, tip) + uRms * 0.95 + bassDrive * 0.42 * uBandWarp + beatDrive * 0.18 + grain * 0.26) * thickness;
  gl_PointSize = baseSize * max(uZoom, 0.55);

  vec3 white = vec3(1.18, 1.18, 1.12);
  vec3 red = vec3(1.0, 0.02, 0.0);
  vec3 faint = vec3(0.12, 0.13, 0.12);

  float strand = smoothstep(0.18, 0.82, core + grain * 0.58 + uFlux * 0.10 * uBandWarp * uReactivity);
  float ink = 0.50 + strand * 0.62 + highDrive * 0.24 * uBandWarp + core * 0.18;
  vec3 col = mix(faint, white, ink);
  col = mix(col, red, smoothstep(0.42, 0.92, tip));
  col = mix(col, vec3(1.0), uBeatPulse * 0.12 * uBeatGate);
  if (uVariant > 15.5 && uVariant < 16.5) {
    vec3 ember = vec3(1.0, 0.34, 0.04);
    col = mix(col, ember, smoothstep(0.25, 0.95, tip) * 0.45);
  }
  if ((uVariant > 21.5 && uVariant < 22.5) || (uVariant > 27.5 && uVariant < 33.5)) {
    vec3 chroma = 0.58 + 0.42 * cos(vec3(0.0, 2.1, 4.2) + p.x * 0.018 + p.y * 0.014 + uTime);
    // The wings lean harder on the iridescence: it is what separates a wing
    // from a bright smear, and it grades along the span on its own.
    col = mix(col, chroma, uVariant > 31.5 ? 0.68 : 0.48);
  }
  if (uVariant > 32.5 && uVariant < 33.5) {
    vec3 fractal = 0.54 + 0.46 * cos(vec3(0.2, 2.3, 4.4) + p.x * 0.026 - p.y * 0.019 + uTime * 0.42);
    col = mix(col, fractal, 0.74);
    col = mix(col, vec3(1.0, 0.30, 0.72), smoothstep(0.42, 0.94, tip) * 0.34);
  }
  if (uVariant > 33.5 && uVariant < 34.5) {
    // Graded along the sweep instead of cycled through hue: the scroll only
    // reads as one shell if the colour follows its own coordinate, where a
    // rotating hue would cut it into bands that fight the winding.
    vec3 shell = mix(vec3(0.20, 0.40, 0.74), vec3(1.0, 0.70, 0.26), core);
    col = mix(col, shell, 0.62);
    col = mix(col, vec3(1.0, 0.93, 0.70), smoothstep(0.35, 0.95, tip) * 0.70);
  }
  if (uVariant > 34.5 && uVariant < 35.5) {
    // Cool at the root, warming out to the tips, so the stacked segments read as
    // one growth rather than a stack of unrelated arcs.
    vec3 frond = mix(vec3(0.16, 0.52, 0.44), vec3(0.72, 1.0, 0.38), core);
    col = mix(col, frond, 0.60);
    col = mix(col, vec3(1.0, 0.98, 0.80), smoothstep(0.40, 0.96, tip) * 0.55);
  }
  if (uVariant > 35.5 && uVariant < 36.5) {
    // Each arm gets its own hue off the angle it sits at, so the nine copies
    // separate where they overlap near the hub instead of washing to white.
    float arm = atan(p.y, p.x);
    vec3 petals = 0.52 + 0.48 * cos(vec3(0.0, 2.2, 4.3) + arm * 1.6 + core * 2.2);
    col = mix(col, petals, 0.66);
    col = mix(col, vec3(1.0, 0.88, 0.94), smoothstep(0.45, 0.96, tip) * 0.40);
  }
  if (uVariant > 36.5) {
    // Banded off the orbit's own radius rather than off screen position, so the
    // barbs keep their grading as the projection swings the whole plume about.
    vec3 plume = 0.55 + 0.45 * cos(vec3(0.4, 2.4, 4.6) + length(aMira) * 0.26 + uTime * 0.3);
    col = mix(col, plume, 0.60);
    col = mix(col, vec3(1.0, 0.86, 0.60), smoothstep(0.42, 0.95, tip) * 0.45);
  }
  if (uVariant > 37.5 && uVariant < 38.5) {
    // Graded along the sweep -- the body axis -- rather than by screen position.
    // The chroma pairings hue off p.x and p.y, which slides the colour across
    // the figure as it moves; here the banding is pinned to the shell, so it
    // turns with the body the way an iridescent surface does.
    vec3 nacre = 0.52 + 0.48 * cos(6.2831853 * (sweep * 0.85 + uTime * 0.02)
                                   + vec3(0.0, 2.1, 4.2));
    col = mix(col, nacre, 0.74);
    // The sprays take a cool cast instead of the body's, so they stay readable
    // as separate from it where they cross.
    col = mix(col, vec3(0.60, 0.85, 1.0), smoothstep(0.45, 0.95, tip) * 0.48);
  }
  if (uVariant > 38.5) {
    // Hue off the angle the point sits at. The two halves are three radians
    // apart in exactly that angle, so they come out in near-opposite hues and
    // read as a pair holding a gap rather than as one blob split in two.
    float around = atan(p.y, p.x);
    vec3 duet = 0.54 + 0.46 * cos(vec3(0.0, 2.1, 4.2) + around * 1.1 + uTime * 0.25);
    col = mix(col, duet, 0.66);
    col = mix(col, vec3(1.0, 0.94, 0.86), smoothstep(0.45, 0.95, tip) * 0.38);
  }
  if (uVariant > 26.5 && uVariant < 27.5) {
    vec3 cream = vec3(1.02, 0.90, 0.72);
    col = mix(col, cream, core * 0.38 * (1.0 - smoothstep(0.42, 0.92, tip)));
  }

  vColor = col;
  vTip = tip;
  vCore = core;
  vMask = visibility;
  vAlpha = max(uBrightness, 0.42)
         + tip * 0.36
         + strand * 0.16
         + core * 0.08
         + highDrive * 0.06 * uBandWarp
         + uFlux * 0.06 * uBandWarp * uReactivity
         + beatDrive * 0.10
         + uBarPulse * 0.04 * uProfile.w * uBeatGate;
}

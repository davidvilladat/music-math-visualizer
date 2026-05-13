precision highp float;

attribute float aIndex;

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
uniform vec4  uProfile; // bass, mid, high, beat
uniform vec2  uResolution;

varying vec3  vColor;
varying float vAlpha;
varying float vTip;
varying float vCore;

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

void main() {
  float raw = aIndex - 1.0;
  float layer = floor(raw / BASE_COUNT);
  float i = mod(raw, BASE_COUNT) + 1.0;

  float tip = 0.0;
  float core = 0.0;
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
    p = chromaFormula(raw, tip, core);
  } else if (uVariant < 23.5) {
    p = attractorFormula(raw, tip, core);
  } else {
    p = prismFormula(raw, tip, core);
  }

  float beatEnvelope = exp(-uBeatPhase * 6.5);
  float phraseSwing = sin(uPhrasePhase * 6.2831853);
  float barBreath = sin(uBarPhase * 6.2831853);
  float bassDrive = uBass * uProfile.x * uReactivity;
  float midDrive = uMid * uProfile.y * uReactivity;
  float highDrive = uBrilliance * uProfile.z * uReactivity;
  float beatDrive = max(uBeatPulse, beatEnvelope * 0.36 + uBarPulse * 0.24) * uProfile.w * uReactivity;

  tip = clamp(tip + beatDrive * 0.12 + uBarPulse * 0.10 * uProfile.w, 0.0, 1.0);
  core = clamp(core + uSectionEnergy * 0.12, 0.0, 1.0);

  p = rotate2(p, phraseSwing * uSectionEnergy * 0.055 * uReactivity);
  p *= 1.0 + (uBarPulse * 0.045 + uSectionEnergy * 0.055 + bassDrive * 0.025);

  float audioWarp = uBandWarp * (bassDrive * 0.95 + midDrive * 0.42 + uFlux * 0.55 * uReactivity);
  vec2 flowWarp = vec2(
    sin(p.y * 0.032 + uTime * (1.35 + uTempoRate * 0.35)),
    cos(p.x * 0.028 - uTime * (1.10 + uTempoRate * 0.45))
  );
  p *= 1.0 + audioWarp * 0.045;
  p += flowWarp * audioWarp * (2.6 + beatDrive * 3.2 + abs(barBreath) * 1.1);

  float jitterSeed = i + layer * 127.13;
  vec2 jitter = vec2(hash(jitterSeed), hash(jitterSeed + 71.7)) - 0.5;
  float jitterAmp = mix(0.12, 0.42, layer / 3.0) * (uVariant < 0.5 ? 1.0 : uVariant < 1.5 ? 0.72 : 0.86);
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
  else baseScale = 126.0;
  float scale = baseScale / max(uZoom, 0.01);
  gl_Position = vec4(p / scale, 0.0, 1.0);

  float grain = hash(i * 3.17 + layer * 23.0);
  float thickness = uVariant < 0.5 ? 2.24 : uVariant < 1.5 ? 2.36 : uVariant < 2.5 ? 1.58 : 1.44;
  float baseSize = (mix(1.18, 2.05, tip) + uRms * 0.95 + bassDrive * 0.42 * uBandWarp + beatDrive * 0.18 + grain * 0.26) * thickness;
  gl_PointSize = baseSize * max(uZoom, 0.55);

  vec3 white = vec3(1.18, 1.18, 1.12);
  vec3 red = vec3(1.0, 0.02, 0.0);
  vec3 faint = vec3(0.12, 0.13, 0.12);

  float strand = smoothstep(0.18, 0.82, core + grain * 0.58 + uFlux * 0.10 * uBandWarp * uReactivity);
  float ink = 0.50 + strand * 0.62 + highDrive * 0.24 * uBandWarp + core * 0.18;
  vec3 col = mix(faint, white, ink);
  col = mix(col, red, smoothstep(0.42, 0.92, tip));
  col = mix(col, vec3(1.0), uBeatPulse * 0.12);
  if (uVariant > 15.5 && uVariant < 16.5) {
    vec3 ember = vec3(1.0, 0.34, 0.04);
    col = mix(col, ember, smoothstep(0.25, 0.95, tip) * 0.45);
  }
  if (uVariant > 21.5 && uVariant < 22.5) {
    vec3 chroma = 0.58 + 0.42 * cos(vec3(0.0, 2.1, 4.2) + p.x * 0.018 + p.y * 0.014 + uTime);
    col = mix(col, chroma, 0.48);
  }

  vColor = col;
  vTip = tip;
  vCore = core;
  vAlpha = max(uBrightness, 0.42)
         + tip * 0.36
         + strand * 0.16
         + core * 0.08
         + highDrive * 0.06 * uBandWarp
         + uFlux * 0.06 * uBandWarp * uReactivity
         + beatDrive * 0.10
         + uBarPulse * 0.04 * uProfile.w;
}

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
uniform float uBeatPulse;
uniform float uRms;
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

vec2 originalFormula(float i, float layer, out float tip, out float core) {
  float x = i + layer * 0.31;
  float y = x / 235.0;

  float k = 4.0 * cos(x / 21.0);
  float e = y / 8.0 - 20.0;
  float d = length(vec2(k, e));
  float safeInvK = sign(k) / max(abs(k), 0.1);

  float waveInner = 9.0 + uMid * 6.0 * uWaveAmp;
  float q = 3.0 * sin(k * 2.0)
          + 0.3 * safeInvK
          + sin(y / 19.0) * k * (waveInner + 2.0 * uWaveAmp * sin(e * 14.0 - d * 3.0 + uTime * 2.0));

  float c = d - uTime;
  float armR = 50.0 + uBass * 40.0;
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
  q *= 1.0 + uMid * 0.18 * uWaveAmp;

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

void main() {
  float raw = aIndex - 1.0;
  float layer = floor(raw / BASE_COUNT);
  float i = mod(raw, BASE_COUNT) + 1.0;

  float tip = 0.0;
  float core = 0.0;
  vec2 p = uVariant < 0.5
    ? originalFormula(i, layer, tip, core)
    : featherFormula(i, layer, tip, core);

  float jitterSeed = i + layer * 127.13;
  vec2 jitter = vec2(hash(jitterSeed), hash(jitterSeed + 71.7)) - 0.5;
  float jitterAmp = mix(0.12, 0.42, layer / 3.0) * (uVariant < 0.5 ? 1.0 : 0.72);
  p += jitter * jitterAmp;

  float scale = (uVariant < 0.5 ? 170.0 : 118.0) / max(uZoom, 0.01);
  gl_Position = vec4(p / scale, 0.0, 1.0);

  float grain = hash(i * 3.17 + layer * 23.0);
  float baseSize = mix(1.0, 1.65, tip) + uRms * 0.85 + grain * 0.22;
  gl_PointSize = baseSize * max(uZoom, 0.55);

  vec3 white = vec3(1.18, 1.18, 1.12);
  vec3 red = vec3(1.0, 0.02, 0.0);
  vec3 faint = vec3(0.12, 0.13, 0.12);

  float strand = smoothstep(0.18, 0.82, core + grain * 0.58);
  float ink = 0.50 + strand * 0.62 + uBrilliance * 0.22 + core * 0.18;
  vec3 col = mix(faint, white, ink);
  col = mix(col, red, smoothstep(0.42, 0.92, tip));
  col = mix(col, vec3(1.0), uBeatPulse * 0.12);

  vColor = col;
  vTip = tip;
  vCore = core;
  vAlpha = max(uBrightness, 0.42)
         + tip * 0.36
         + strand * 0.16
         + core * 0.08
         + uBrilliance * 0.05
         + uBeatPulse * 0.10;
}

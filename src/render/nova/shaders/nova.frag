precision highp float;

varying vec2 vUv;

uniform sampler2D uSpectrum;
uniform float     uBass;
uniform float     uMid;
uniform float     uBrilliance;
uniform float     uBeatPulse;
uniform float     uTime;
uniform float     uCoreIntensity;
uniform vec2      uResolution;
// Up to 3 expanding shockwave rings: xy = radius, age
uniform vec2      uRing0;
uniform vec2      uRing1;
uniform vec2      uRing2;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// IQ palette: supernova orange-to-violet
vec3 novaColor(float t) {
  vec3 a = vec3(0.60, 0.40, 0.20);
  vec3 b = vec3(0.55, 0.35, 0.30);
  vec3 c = vec3(0.90, 0.70, 0.50);
  vec3 d = vec3(0.10, 0.30, 0.65);
  return a + b * cos(6.28318 * (c * t + d));
}

// ACES filmic tone-map
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// Draw a single shockwave ring
vec3 drawRing(vec2 p, vec2 ring) {
  float radius = ring.x;
  float age    = ring.y;
  if (age >= 1.0) return vec3(0.0);
  float r       = length(p);
  float dist    = abs(r - radius);
  float width   = mix(0.012, 0.040, age);
  float glow    = exp(-dist * dist / (width * width)) * (1.0 - age) * 3.0;
  vec3  ringCol = mix(vec3(1.0, 0.75, 0.2), vec3(0.15, 0.35, 1.0), age);
  return ringCol * glow;
}

void main() {
  vec2  uv     = vUv;
  float aspect = uResolution.x / uResolution.y;
  // Centered, aspect-corrected coordinate space
  vec2  p      = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float r      = length(p);
  float theta  = atan(p.y, p.x);  // -π to π

  vec3 col = vec3(0.0);

  // ── Star field (40 deterministic stars) ──────────────────────────────────
  for (int i = 0; i < 40; i++) {
    float fi   = float(i);
    vec2  sp   = vec2(hash(vec2(fi, 1.0)), hash(vec2(fi, 2.0))) * 2.0 - 1.0;
    sp.x      *= aspect;
    float dist = length(p - sp);
    float br   = hash(vec2(fi, 3.0)) * 0.55 + 0.20;
    float flk  = 0.82 + sin(uTime * (1.2 + hash(vec2(fi, 4.0)) * 3.5) + fi) * 0.18;
    float sz   = 800.0 + hash(vec2(fi, 5.0)) * 2200.0;
    col       += vec3(br * flk) * exp(-dist * dist * sz);
  }

  // ── Radial spokes / corona jets ──────────────────────────────────────────
  const int SPOKES = 12;
  for (int i = 0; i < SPOKES; i++) {
    float angle    = float(i) / float(SPOKES) * 6.28318;
    float angleDiff= abs(mod(theta - angle + 3.14159, 6.28318) - 3.14159);
    float spread   = exp(-angleDiff * angleDiff * (12.0 + r * 35.0));
    float radFade  = exp(-r * 1.8) / (r * 0.4 + 0.01);
    col += vec3(1.0, 0.72, 0.25) * spread * radFade * 0.14 * (0.5 + uBass * 0.9);
  }

  // ── Stellar core ─────────────────────────────────────────────────────────
  float coreGlow  = exp(-r * r * 32.0) * 18.0 * uCoreIntensity * (0.7 + uBass * 0.8);
  float innerGlow = exp(-r * r * 3.5)  * 5.5  * uCoreIntensity;
  float outerGlow = exp(-r * r * 0.45) * 1.8;

  // Color: white-hot → orange → red → blue-violet by radius
  vec3  coreColor = novaColor(clamp(r * 1.3, 0.0, 1.0));
  // Override near-center to white-hot
  coreColor = mix(vec3(1.2, 1.1, 0.9), coreColor, smoothstep(0.0, 0.18, r));

  col += (coreGlow + innerGlow) * coreColor + outerGlow * vec3(1.0, 0.42, 0.12);

  // ── Spectrum polar arc (spectrum energy → radial perturbation) ───────────
  float binX     = mod(theta + 3.14159, 6.28318) / 6.28318;
  float specE    = texture2D(uSpectrum, vec2(binX * 0.75, 0.5)).r;
  float arcR     = 0.28 + specE * 0.14 * (0.5 + uMid);
  float arcDist  = abs(r - arcR) * uResolution.y;
  float arcGlow  = exp(-arcDist * arcDist * 0.07) * (0.5 + uMid * 0.8);
  col           += vec3(1.0, 0.55, 0.05) * arcGlow * 0.45;

  // ── Shockwave rings ───────────────────────────────────────────────────────
  col += drawRing(p, uRing0);
  col += drawRing(p, uRing1);
  col += drawRing(p, uRing2);

  // ── Beat flash ────────────────────────────────────────────────────────────
  col += uBeatPulse * 0.12 * novaColor(r * 0.8);

  // ── ACES tonemap ─────────────────────────────────────────────────────────
  col = aces(col);

  gl_FragColor = vec4(col, 1.0);
}

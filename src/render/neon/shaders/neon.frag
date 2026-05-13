precision highp float;

varying vec2 vUv;

uniform sampler2D uSpectrum;
uniform float     uBass;
uniform float     uMid;
uniform float     uBrilliance;
uniform float     uBeatPulse;
uniform vec2      uResolution;

// Neon tube glow — dpx is distance in pixels
float neonGlow(float dpx) {
  float core  = exp(-dpx * dpx * 0.28)  * 10.0;  // 1.9px tight core
  float inner = exp(-dpx * dpx / 20.0)  * 3.5;   // ~6px inner halo
  float outer = exp(-dpx * dpx / 220.0) * 0.9;   // ~21px soft diffuse
  return core + inner + outer;
}

float specAt(float x) {
  return texture2D(uSpectrum, vec2(clamp(x, 0.005, 0.995), 0.5)).r;
}

void main() {
  vec2  uv  = vUv;
  float pH  = uResolution.y;
  vec3  col = vec3(0.0);

  // ── Background: near-black with subtle indigo tint ───────────────────────
  col += vec3(0.0, 0.002, 0.006) + vec3(0.003, 0.0, 0.005) * (1.0 - uv.y);

  // ── BASS trace — magenta, y=0.25 baseline ────────────────────────────────
  {
    float binX = uv.x * 0.07;
    float s    = specAt(binX);
    float trY  = 0.25 + (s - 0.22) * 0.26 * max(uBass, 0.12);
    float dpx  = abs(uv.y - trY) * pH;
    col += neonGlow(dpx) * vec3(1.0, 0.04, 0.88) * (1.1 + uBass * 1.6);
    // phosphor floor glow
    float below = max(0.0, trY - uv.y);
    col += vec3(0.55, 0.0, 0.48) * exp(-below * 16.0) * 0.20 * uBass;
  }

  // ── MID trace — cyan, y=0.50 baseline ────────────────────────────────────
  {
    float binX = 0.07 + uv.x * 0.26;
    float s    = specAt(binX);
    float trY  = 0.50 + (s - 0.22) * 0.22 * max(uMid, 0.12);
    float dpx  = abs(uv.y - trY) * pH;
    col += neonGlow(dpx) * vec3(0.0, 1.0, 1.0) * (1.1 + uMid * 1.6);
    float below = max(0.0, trY - uv.y);
    col += vec3(0.0, 0.48, 0.55) * exp(-below * 16.0) * 0.20 * uMid;
  }

  // ── TREBLE trace — lime, y=0.75 baseline ─────────────────────────────────
  {
    float binX = 0.33 + uv.x * 0.47;
    float s    = specAt(binX);
    float trY  = 0.75 + (s - 0.22) * 0.17 * max(uBrilliance, 0.12);
    float dpx  = abs(uv.y - trY) * pH;
    col += neonGlow(dpx) * vec3(0.55, 1.0, 0.0) * (1.1 + uBrilliance * 1.6);
    float below = max(0.0, trY - uv.y);
    col += vec3(0.26, 0.52, 0.0) * exp(-below * 16.0) * 0.20 * uBrilliance;
  }

  // ── CRT scanlines (4% dimming on every other row) ────────────────────────
  col *= 1.0 - 0.04 * mod(floor(uv.y * pH), 2.0);

  // ── Beat white flash ──────────────────────────────────────────────────────
  col += uBeatPulse * 0.14;

  gl_FragColor = vec4(col, 1.0);
}

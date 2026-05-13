precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uBass;
uniform float uBrilliance;
uniform float uSpeed;
uniform float uIntensity;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i),             hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// 5-octave FBM with rotating basis
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 R = mat2(0.80, 0.60, -0.60, 0.80); // 37° rotation avoids axis alignment
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p  = R * p * 2.1 + vec2(3.17, 7.53);
    a *= 0.5;
  }
  return s;
}

void main() {
  float t  = uTime * uSpeed;
  vec2  p  = (vUv - 0.5) * 3.5;

  // Two-level domain warp — creates organic electric-field streaks
  vec2 q = vec2(
    fbm(p                  + t * 0.10),
    fbm(p + vec2(4.2, 1.3) + t * 0.12)
  );
  float f = fbm(p + 2.0 * q + t * 0.06);

  // Audio lift: bass brightens overall, brilliance adds hot sparks
  f = f * (0.45 + uBass * 0.65) + uBrilliance * 0.18;
  f = clamp(f, 0.0, 1.0);

  // Palette: near-black void → electric blue → cyan → white-hot
  vec3 c = vec3(0.01, 0.00, 0.06);
  c = mix(c, vec3(0.00, 0.12, 0.90), smoothstep(0.22, 0.52, f));
  c = mix(c, vec3(0.00, 0.62, 1.00), smoothstep(0.48, 0.72, f));
  c = mix(c, vec3(0.55, 0.92, 1.00), smoothstep(0.68, 0.86, f));
  c = mix(c, vec3(1.00, 1.00, 1.00), smoothstep(0.83, 0.97, f));

  gl_FragColor = vec4(c * uIntensity, 1.0);
}

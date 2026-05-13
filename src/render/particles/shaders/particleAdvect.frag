precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uPositions;  // (x, y, seed, _)
uniform sampler2D uVelocity;
uniform sampler2D uPsi;
uniform vec2 simTexelSize;
uniform float dt;
uniform float speed;
uniform float uTime;
uniform float respawnRate;
uniform float magneticBlend;   // 0 = pure velocity, 1 = pure B-field direction

float rand(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

void main() {
  vec4 data = texture2D(uPositions, vUv);
  vec2 pos  = data.xy;
  float seed = data.z;

  // ── Velocity advection ────────────────────────────────────────────────────
  vec2 vel = texture2D(uVelocity, pos).xy;
  vec2 velStep = vel * simTexelSize * speed;

  // ── Magnetic field direction from ψ ──────────────────────────────────────
  float psiL = texture2D(uPsi, pos - vec2(simTexelSize.x, 0.0)).x;
  float psiR = texture2D(uPsi, pos + vec2(simTexelSize.x, 0.0)).x;
  float psiB = texture2D(uPsi, pos - vec2(0.0, simTexelSize.y)).x;
  float psiT = texture2D(uPsi, pos + vec2(0.0, simTexelSize.y)).x;
  float Bx = (psiT - psiB) * 0.5;
  float By = -(psiR - psiL) * 0.5;
  float Bmag = length(vec2(Bx, By));
  // Normalised B direction, fallback to zero if no field present
  vec2 Bdir = Bmag > 0.0001 ? vec2(Bx, By) / Bmag : vec2(0.0);

  // Blend velocity advection with B-field direction tracing
  vec2 step = mix(velStep, Bdir * speed * 0.0015, magneticBlend);
  vec2 newPos = pos + step * dt;

  // ── Respawn logic ─────────────────────────────────────────────────────────
  bool oob     = newPos.x < 0.0 || newPos.x > 1.0 || newPos.y < 0.0 || newPos.y > 1.0;
  float tRand  = rand(seed + floor(uTime * 30.0) * 0.0013);
  bool respawn = oob || (tRand < respawnRate);

  if (respawn) {
    float ns = rand(seed + uTime * 0.01);
    newPos = vec2(rand(ns), rand(ns + 0.37));
    seed   = rand(ns + 0.73);
  }

  gl_FragColor = vec4(newPos, seed, 1.0);
}

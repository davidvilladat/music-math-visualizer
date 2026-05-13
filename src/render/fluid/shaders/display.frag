precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uDye;
uniform sampler2D uPsi;
uniform vec2 texelSize;
uniform float fieldLineBrightness;  // 0 = off
uniform float lineCount;            // how many isoline bands to draw

// Filmic tone-map (ACES approximation)
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  // ── Dye layer ───────────────────────────────────────────────────────────────
  vec3 dye = texture2D(uDye, vUv).rgb;
  dye = aces(dye * 2.2);

  // ── Magnetic field lines ─────────────────────────────────────────────────────
  vec3 field = vec3(0.0);

  if (fieldLineBrightness > 0.001) {
    float psiC = texture2D(uPsi, vUv).x;
    float psiL = texture2D(uPsi, vUv - vec2(texelSize.x, 0.0)).x;
    float psiR = texture2D(uPsi, vUv + vec2(texelSize.x, 0.0)).x;
    float psiB = texture2D(uPsi, vUv - vec2(0.0, texelSize.y)).x;
    float psiT = texture2D(uPsi, vUv + vec2(0.0, texelSize.y)).x;

    // Reconstruct B from ψ
    float Bx = (psiT - psiB) * 0.5;     // ∂ψ/∂y
    float By = -(psiR - psiL) * 0.5;    // −∂ψ/∂x
    float mag = length(vec2(Bx, By));

    // ψ isolines = field lines (B is tangent to ψ=const surfaces)
    float phi = psiC * lineCount;
    float isoline = 1.0 - smoothstep(0.0, 0.12, abs(fract(phi + 0.5) - 0.5));
    // Lines glow brighter where |B| is large
    float glow = isoline * (0.4 + mag * 4.0);

    // Color encodes field direction angle (cyan → blue → magenta palette)
    float angle = (atan(By, Bx) / 3.14159265 + 1.0) * 0.5;
    vec3 c1 = vec3(0.0, 0.9, 1.0);   // cyan  (field going "right")
    vec3 c2 = vec3(0.5, 0.2, 1.0);   // violet
    vec3 c3 = vec3(1.0, 0.1, 0.6);   // magenta (field going "left")
    vec3 fieldColor = angle < 0.5
      ? mix(c1, c2, angle * 2.0)
      : mix(c2, c3, (angle - 0.5) * 2.0);

    field = fieldColor * glow * fieldLineBrightness;
  }

  gl_FragColor = vec4(dye + field, 1.0);
}

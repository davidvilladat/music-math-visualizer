precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform sampler2D uPsi;
uniform vec2 texelSize;
uniform float Rm;   // magnetic Reynolds number (centroid-driven)
uniform float dt;

void main() {
  float psiC = texture2D(uPsi, vUv).x;
  float psiL = texture2D(uPsi, vUv - vec2(texelSize.x, 0.0)).x;
  float psiR = texture2D(uPsi, vUv + vec2(texelSize.x, 0.0)).x;
  float psiB = texture2D(uPsi, vUv - vec2(0.0, texelSize.y)).x;
  float psiT = texture2D(uPsi, vUv + vec2(0.0, texelSize.y)).x;

  // Current density (z-component): J = ∇²ψ
  float J = psiL + psiR + psiB + psiT - 4.0 * psiC;

  // B = (∂ψ/∂y, −∂ψ/∂x)
  float dPsiDx = (psiR - psiL) * 0.5;
  float dPsiDy = (psiT - psiB) * 0.5;

  // Lorentz force: F = J × B = J · (−By, Bx) = J · (∂ψ/∂x, ∂ψ/∂y)
  vec2 F = J * vec2(dPsiDx, dPsiDy);
  F = clamp(F, -200.0, 200.0);

  vec2 vel = texture2D(uVelocity, vUv).xy;
  vel += Rm * F * dt;
  vel = clamp(vel, -1000.0, 1000.0);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}

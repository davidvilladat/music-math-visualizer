precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uPsi;
uniform vec2 point;
uniform vec2 orientation; // dipole axis (normalized)
uniform float strength;
uniform float radius;
uniform float aspectRatio;

void main() {
  vec2 p = vUv - point;
  p.x *= aspectRatio;
  float r2 = dot(p, p);

  // Derivative-of-Gaussian along the perpendicular of orientation.
  // This creates a classic magnetic dipole field pattern:
  //   positive ψ on one side → negative on the other → field lines loop between.
  vec2 ortPerp = vec2(-orientation.y, orientation.x);
  float psiDelta = strength * dot(p, ortPerp) * exp(-r2 / (radius * radius));

  float current = texture2D(uPsi, vUv).x;
  gl_FragColor = vec4(current + psiDelta, 0.0, 0.0, 1.0);
}

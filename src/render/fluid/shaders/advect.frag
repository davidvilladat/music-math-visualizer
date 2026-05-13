precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;

void main() {
  vec2 vel = texture2D(uVelocity, vUv).xy;
  // trace back along velocity (velocity is in sim-pixels/s, texelSize converts to UV/s)
  vec2 coord = vUv - dt * vel * texelSize;
  gl_FragColor = dissipation * texture2D(uSource, coord);
}

precision highp float;

varying vec2 vUv;

uniform sampler2D uTrail;
uniform float uDecay;

void main() {
  gl_FragColor = texture2D(uTrail, vUv) * uDecay;
}

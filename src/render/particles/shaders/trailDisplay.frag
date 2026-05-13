precision highp float;

varying vec2 vUv;

uniform sampler2D uTrail;
uniform float uBrightness;

void main() {
  vec4 c = texture2D(uTrail, vUv);
  gl_FragColor = vec4(c.rgb * uBrightness, c.a);
}

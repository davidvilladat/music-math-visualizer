precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uSource;
// blurDir = (texelW, 0) for horizontal, (0, texelH) for vertical
// multiply by step size > 1 to widen the spread
uniform vec2 blurDir;

void main() {
  // 9-tap Gaussian (sigma ≈ 1.7)
  vec3 c = vec3(0.0);
  c += texture2D(uSource, vUv - blurDir * 4.0).rgb * 0.0162;
  c += texture2D(uSource, vUv - blurDir * 3.0).rgb * 0.0540;
  c += texture2D(uSource, vUv - blurDir * 2.0).rgb * 0.1216;
  c += texture2D(uSource, vUv - blurDir * 1.0).rgb * 0.1945;
  c += texture2D(uSource, vUv               ).rgb * 0.2270;
  c += texture2D(uSource, vUv + blurDir * 1.0).rgb * 0.1945;
  c += texture2D(uSource, vUv + blurDir * 2.0).rgb * 0.1216;
  c += texture2D(uSource, vUv + blurDir * 3.0).rgb * 0.0540;
  c += texture2D(uSource, vUv + blurDir * 4.0).rgb * 0.0162;
  gl_FragColor = vec4(c, 1.0);
}

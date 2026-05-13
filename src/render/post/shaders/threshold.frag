precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uScene;
uniform float threshold;
uniform float knee;

void main() {
  vec3 color = texture2D(uScene, vUv).rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));

  // Soft-knee threshold: smooth transition around the threshold point
  float rq = clamp(lum - threshold + knee, 0.0, 2.0 * knee);
  rq = rq * rq / (4.0 * knee + 0.0001);
  float weight = max(rq, lum - threshold) / max(lum, 0.0001);

  gl_FragColor = vec4(color * weight, 1.0);
}

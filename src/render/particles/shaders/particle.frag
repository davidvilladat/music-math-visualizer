precision highp float;

varying float vSpeed;

uniform float uBrightness;

void main() {
  // Soft circular point sprite
  vec2 pc = gl_PointCoord - 0.5;
  float d = dot(pc, pc) * 4.0; // 0 at centre, 1 at edge
  if (d > 1.0) discard;
  float alpha = (1.0 - d) * uBrightness;

  // Color: cyan (slow) → white → magenta (fast)
  float t = clamp(vSpeed * 8.0, 0.0, 1.0);
  vec3 slow  = vec3(0.2, 0.8, 1.0);  // cyan
  vec3 fast  = vec3(1.0, 0.3, 0.9);  // magenta
  vec3 color = mix(slow, fast, t);

  gl_FragColor = vec4(color * alpha, alpha);
}

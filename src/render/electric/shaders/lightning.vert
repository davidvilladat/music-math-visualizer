precision highp float;

attribute vec3 position; // already in NDC [-1,1]

void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}

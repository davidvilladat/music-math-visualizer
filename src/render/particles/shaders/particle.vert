precision highp float;
precision highp sampler2D;

attribute vec2 aUv;           // texel coord into position texture

uniform sampler2D uPositions; // (x, y, seed, _)
uniform sampler2D uVelocity;
uniform float uPointSize;

varying float vSpeed;
varying float vLife;          // 1 = fresh spawn, decays in trail

void main() {
  vec4 data = texture2D(uPositions, aUv);
  vec2 pos  = data.xy;
  vLife     = data.w;

  vec2 vel  = texture2D(uVelocity, pos).xy;
  vSpeed    = length(vel);

  // NDC: pos in [0,1] → [-1,1]
  vec2 ndc = pos * 2.0 - 1.0;
  gl_Position  = vec4(ndc, 0.0, 1.0);
  gl_PointSize = uPointSize;
}

precision highp float;

varying vec3 vColor;
varying float vAlpha;
varying float vGlow;

void main() {
  vec2 coord = gl_PointCoord - 0.5;
  float dist = length(coord);
  if (dist > 0.5) discard;

  float dotCore = smoothstep(0.48, 0.08, dist);
  float pin = smoothstep(0.28, 0.06, dist);
  float alpha = mix(dotCore, pin, 0.38 + vGlow * 0.32) * vAlpha;

  gl_FragColor = vec4(vColor, clamp(alpha, 0.0, 1.0));
}

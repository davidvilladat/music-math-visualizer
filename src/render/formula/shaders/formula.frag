precision highp float;

varying vec3  vColor;
varying float vAlpha;
varying float vTip;
varying float vCore;

void main() {
  vec2 coord = gl_PointCoord - 0.5;
  float dist = length(coord);
  if (dist > 0.5) discard;

  float softDot = smoothstep(0.5, 0.08, dist);
  float hardGrain = smoothstep(0.38, 0.12, dist);
  float tipBody = smoothstep(0.5, 0.18, dist);
  float alpha = mix(softDot, hardGrain, 0.55) * vAlpha;
  alpha = mix(alpha, tipBody * min(1.0, vAlpha + 0.28), smoothstep(0.35, 0.85, vTip));
  alpha *= 0.82 + vCore * 0.18;

  gl_FragColor = vec4(vColor, clamp(alpha, 0.0, 1.0));
}

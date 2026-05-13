precision highp float;

uniform float uAge; // 0 = fresh, 1 = dead

void main() {
  float life  = 1.0 - uAge;
  float alpha = pow(life, 1.4) * 3.0;

  // Hot white at birth, cools to electric cyan as it fades
  vec3 col = mix(vec3(0.35, 0.80, 1.0), vec3(1.0, 1.0, 1.0), pow(life, 3.0));

  gl_FragColor = vec4(col * alpha, 1.0);
}

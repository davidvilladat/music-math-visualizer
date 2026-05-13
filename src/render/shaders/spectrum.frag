precision highp float;

varying float vEnergy;
varying float vBarIndex;

void main() {
  // hue shifts from bass (blue) to brilliance (magenta) across bars
  float hue = vBarIndex / 127.0;
  float brightness = 0.4 + vEnergy * 0.6;

  // simple HSV → RGB for a cyan-to-magenta palette
  float h6 = hue * 6.0;
  float x = 1.0 - abs(mod(h6, 2.0) - 1.0);
  vec3 rgb;
  if      (h6 < 1.0) rgb = vec3(1.0, x,   0.0);
  else if (h6 < 2.0) rgb = vec3(x,   1.0, 0.0);
  else if (h6 < 3.0) rgb = vec3(0.0, 1.0, x  );
  else if (h6 < 4.0) rgb = vec3(0.0, x,   1.0);
  else if (h6 < 5.0) rgb = vec3(x,   0.0, 1.0);
  else               rgb = vec3(1.0, 0.0, x  );

  gl_FragColor = vec4(rgb * brightness, 1.0);
}

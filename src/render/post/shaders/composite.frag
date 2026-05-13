precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float bloomStrength;
uniform float aberration;     // 0 = off, ~0.005 = subtle, ~0.02 = heavy
uniform float vignetteStrength;

void main() {
  vec2 toCenter = 0.5 - vUv;
  float dist = length(toCenter);

  // Chromatic aberration: R/B offset radially from center, G untouched
  float abr = aberration * dist;
  float r = texture2D(uScene, vUv + toCenter * abr * 2.0).r;
  float g = texture2D(uScene, vUv + toCenter * abr       ).g;
  float b = texture2D(uScene, vUv                        ).b;
  vec3 color = vec3(r, g, b);

  // Bloom (half-res, bilinear upscale is free via LINEAR filter)
  vec3 bloom = texture2D(uBloom, vUv).rgb;
  color += bloom * bloomStrength;

  // Subtle contrast S-curve: lifts shadows, punches mids
  color = color * (2.51 * color + 0.03) / (color * (2.43 * color + 0.59) + 0.14);
  color = clamp(color, 0.0, 1.0);

  // Vignette
  float vig = 1.0 - smoothstep(0.45, 1.35, dist * vignetteStrength);
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}

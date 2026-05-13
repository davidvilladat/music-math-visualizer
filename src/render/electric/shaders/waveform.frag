precision highp float;
varying vec2 vUv;

uniform sampler2D uSpectrum;   // 1024×1 RGBA, R = normalized amplitude [0,1]
uniform float     uBass;
uniform float     uAmplitude;  // max half-height in UV (typ 0.35)
uniform float     uIntensity;
uniform vec2      uResolution; // pixels, for resolution-independent glow

// Cosine-palette: bass=orange → mid=cyan → treble=violet
vec3 freqColor(float x) {
  // Inigo Quilez palette: a + b*cos(2π*(c*t+d))
  vec3 a = vec3(0.60, 0.50, 0.50);
  vec3 b = vec3(0.50, 0.50, 0.50);
  vec3 c = vec3(0.80, 0.80, 0.80);
  vec3 d = vec3(0.00, 0.18, 0.52); // shifts: orange→cyan→violet
  return clamp(a + b * cos(6.28318 * (c * x + d)), 0.0, 1.0);
}

// Glow layers in pixel-space distance (resolution-independent)
float glow(float dPx) {
  float core  = exp(-dPx * dPx * 0.065) * 3.5;  // ~4 px sigma
  float inner = exp(-dPx * dPx * 0.004) * 1.3;  // ~11 px sigma
  float outer = exp(-dPx * dPx * 0.00025) * 0.4;// ~45 px sigma
  return core + inner + outer;
}

void main() {
  vec2 uv = vUv;

  // Log-scale x: gives bass ~60 % of screen width, compresses treble
  float logX = pow(uv.x, 0.42);

  // Sample R channel; gamma-lift so quiet bins stay visible
  float raw = texture2D(uSpectrum, vec2(logX * 0.55, 0.5)).r;
  float amp  = pow(raw, 0.55);

  // Waveform height: symmetric about y=0.5
  float h    = amp * uAmplitude * (0.85 + uBass * 0.2);
  float wTop = 0.5 + h;
  float wBot = 0.5 - h;

  // Distance to nearer curve in pixels
  float dTop = abs(uv.y - wTop) * uResolution.y;
  float dBot = abs(uv.y - wBot) * uResolution.y;
  float d    = min(dTop, dBot);

  float g1 = glow(d);

  // Second echo at 72 % amplitude — cooler tint, softer glow
  float h2  = h * 0.72;
  float d2  = min(abs(uv.y - (0.5 + h2)), abs(uv.y - (0.5 - h2))) * uResolution.y;
  float g2  = (exp(-d2 * d2 * 0.003) * 0.55 + exp(-d2 * d2 * 0.0002) * 0.18);

  // Subtle fill between the two mirrored curves (spectral body)
  float inside  = step(wBot, uv.y) * step(uv.y, wTop);
  float fillGlow = inside * amp * 0.10;

  // Color
  vec3 mainCol = freqColor(uv.x);
  vec3 echoCol = mix(mainCol, vec3(0.20, 0.45, 1.00), 0.55);

  // White-hot core at the exact waveform boundary
  float hotCore = exp(-d * 0.45) * amp * 2.0;

  vec3 col = mainCol * (g1 + fillGlow) + echoCol * g2;
  col += vec3(1.0, 0.95, 0.90) * hotCore;
  col *= uIntensity;

  gl_FragColor = vec4(col, 1.0); // additive blend: black areas add nothing
}

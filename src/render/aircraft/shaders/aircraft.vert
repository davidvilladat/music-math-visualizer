precision highp float;

attribute float aIndex;

uniform float uTime;
uniform float uVariant;
uniform float uBass;
uniform float uMid;
uniform float uBrilliance;
uniform float uFlux;
uniform float uBeatPulse;
uniform float uRms;
uniform float uReactivity;
uniform vec2 uResolution;

varying vec3 vColor;
varying float vAlpha;
varying float vGlow;

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;
const float L = 300.0;
const float R = 150.0;
const float SPAN = L * 35.8 / 37.57 / 2.0;
const float FW = L * 3.95 / 37.57 / 2.0;

const float S_FUSELAGE = 12000.0;
const float S_OUTLINE = 1206.0;
const float S_NOSE = 600.0;
const float S_COCKPIT = 220.0;
const float S_WINDOWS = 10880.0;
const float S_DOORS = 1600.0;
const float S_WINGS = 18000.0;
const float S_WING_DETAIL = 3200.0;
const float S_SHARKLETS = 840.0;
const float S_ENGINES = 3000.0;
const float S_TAILPLANE = 6000.0;
const float S_TAIL_DETAIL = 600.0;
const float S_VERTICAL = 2600.0;
const float S_VERTICAL_DETAIL = 600.0;
const float S_AFT = 500.0;
const float S_PANELS = 1080.0;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float radiusAt(float x) {
  float body = max(0.0, 1.0 - pow(abs(x) / R, 2.75));
  return FW * pow(body, 0.42);
}

float safeInv(float v, float floorAbs) {
  return sign(v) / max(abs(v), floorAbs);
}

bool isA380Profile() {
  return uVariant > 1.5 && uVariant < 3.5;
}

bool isGeneralA380Profile() {
  return uVariant > 1.5 && uVariant < 2.5;
}

bool isStructuralProfile() {
  return uVariant > 2.5 && uVariant < 3.5;
}

bool isWingBoxProfile() {
  return uVariant > 3.5;
}

bool isA350Profile() {
  return uVariant > 0.5 && uVariant < 1.5;
}

bool isReferenceA380Profile() {
  return uVariant < 0.5;
}

float lengthScale() {
  if (isA350Profile()) return 1.10; // A350 XWB
  if (isA380Profile()) return 1.18; // A380
  return 1.0;
}

float spanScale() {
  if (isA350Profile()) return 1.18;
  if (isA380Profile()) return 1.48;
  return 1.0;
}

float radiusScale() {
  if (isA350Profile()) return 1.10;
  if (isA380Profile()) return 1.58;
  return 1.0;
}

float heightScale() {
  if (isA350Profile()) return 1.05;
  if (isA380Profile()) return 1.26;
  return 1.0;
}

vec3 applyProfile(vec3 p) {
  if (isWingBoxProfile()) return p;
  p.x *= lengthScale();
  p.y *= spanScale();
  p.z *= heightScale();
  return p;
}

vec2 projectAirframe(float x, float y, float z) {
  vec2 p = vec2(200.0 + y + x * 0.035, 226.0 - x * 0.85 - z * 0.55);
  return vec2(p.x - 200.0, -(p.y - 200.0));
}

vec2 rotate2(vec2 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec3 wingPoint(float side, float u, float v) {
  float longWing = isA350Profile() ? 1.0 : isA380Profile() ? 0.65 : 0.0;
  float le = mix(34.0, mix(-53.0, -48.0, longWing), u);
  float te = mix(-31.0, mix(-92.0, -86.0, longWing), u);
  float x = mix(le, te, v) + sin(u * 9.0 + uTime) * 0.45;
  float y = side * mix(radiusAt(0.0) + 1.0, SPAN, u);
  float z = -2.0 + sin(u * PI) * (isA350Profile() ? 5.5 : 4.2);
  if (isA350Profile() && u > 0.88) {
    z += pow((u - 0.88) / 0.12, 1.4) * 12.0;
    x += sin((u - 0.88) / 0.12 * PI) * 3.0;
  }
  return vec3(x, y, z);
}

vec3 tailplanePoint(float side, float u, float v) {
  float aft = isA380Profile() ? 1.12 : 1.0;
  float le = mix(-111.0, -132.0, u) * aft;
  float te = mix(-144.0, -159.0, u) * aft;
  float x = mix(le, te, v);
  float y = side * mix(radiusAt(-124.0), isA380Profile() ? 68.0 : 58.0, u);
  float z = 5.0 + sin(u * PI) * 2.0;
  return vec3(x, y, z);
}

vec3 ringPoint(float x, float y, float rx, float ry, float z, float raw, float count, out float alpha, out float glow) {
  float c = raw / max(count - 1.0, 1.0) * TAU;
  alpha = 0.62;
  glow = 0.55;
  return vec3(x + rx * cos(c), y + ry * sin(c), z + sin(c + uTime) * 1.5);
}

vec3 boxPoint(float raw, float x, float y, float sx, float sy, float z, out float alpha, out float glow) {
  float edge = floor(raw / 50.0);
  float q = mod(raw, 50.0) / 49.0;
  alpha = 0.76;
  glow = 0.62;
  if (edge < 0.5) return vec3(x + sx * (q - 0.5), y - sy / 2.0, z);
  if (edge < 1.5) return vec3(x + sx * (q - 0.5), y + sy / 2.0, z);
  if (edge < 2.5) return vec3(x - sx / 2.0, y + sy * (q - 0.5), z);
  return vec3(x + sx / 2.0, y + sy * (q - 0.5), z);
}

float ribU(float idx) {
  if (idx < 0.5) return 0.28;
  if (idx < 1.5) return 0.48;
  if (idx < 2.5) return 0.68;
  return 0.84;
}

float panelX(float idx) {
  if (idx < 0.5) return 132.0;
  if (idx < 1.5) return 96.0;
  if (idx < 2.5) return 62.0;
  if (idx < 3.5) return 28.0;
  if (idx < 4.5) return 0.0;
  if (idx < 5.5) return -28.0;
  if (idx < 6.5) return -64.0;
  if (idx < 7.5) return -98.0;
  return -128.0;
}

float refPanelX(float idx) {
  if (idx < 0.5) return 31.0;
  if (idx < 1.5) return 25.0;
  if (idx < 2.5) return 17.0;
  if (idx < 3.5) return 8.0;
  if (idx < 4.5) return 0.0;
  if (idx < 5.5) return -9.0;
  if (idx < 6.5) return -18.0;
  if (idx < 7.5) return -27.0;
  return -34.0;
}

vec3 fuselageSample(float raw, out float alpha, out float glow) {
  if (isStructuralProfile()) {
    float station = floor(raw / 180.0);
    float c = mod(raw, 180.0) / 179.0 * TAU;
    float x = -R + L * (station / 66.0);
    float r = radiusAt(x) * (0.92 + 0.08 * sin(station * 1.7));
    float y = r * sin(c);
    float z = 2.0 + 5.0 * cos(c);
    alpha = 0.55 + 0.34 * smoothstep(0.86, 1.0, abs(sin(c)));
    glow = 0.78;
    return vec3(x, y, z);
  }
  float x = -R + L * (mod(raw, 900.0) / 899.0);
  float r = radiusAt(x);
  float a = raw * 2.399 + uTime / 8.0;
  float y = r * sin(a) * (0.18 + 0.82 * abs(sin(raw * 0.017)));
  float z = 2.5 * cos(y / max(r, 1.0) * PI) + sin(x / 21.0 - uTime) * 0.8;
  float edge = abs(y / max(r, 1.0));
  alpha = (38.0 + 35.0 * edge) / 170.0;
  glow = edge * 0.35;
  return vec3(x, y, z);
}

vec3 outlineSample(float raw, out float alpha, out float glow) {
  float strip = mod(raw, 3.0);
  float j = floor(raw / 3.0);
  float x = -R + min(j, 401.0) * 0.75;
  alpha = strip < 2.5 ? 0.74 : 0.26;
  glow = strip < 2.5 ? 0.7 : 0.25;
  if (strip < 0.5) return vec3(x, radiusAt(x), 2.0);
  if (strip < 1.5) return vec3(x, -radiusAt(x), 2.0);
  return vec3(x, 0.0, 3.0 + sin(x / 13.0 + uTime) * 1.2);
}

vec3 noseSample(float raw, out float alpha, out float glow) {
  float u = raw / 599.0;
  float c = u * TAU * 3.0;
  float x = 129.0 + 19.0 * pow(u, 0.7);
  float y = sin(c) * radiusAt(x) * 0.75;
  float z = 4.0 + cos(c) * 3.0;
  alpha = 0.56;
  glow = 0.38;
  return vec3(x, y, z);
}

vec3 cockpitSample(float raw, out float alpha, out float glow) {
  float side = floor(raw / 110.0) < 0.5 ? -1.0 : 1.0;
  float q = mod(raw, 110.0) / 109.0;
  float x = 121.0 + q * 18.0;
  float y = side * (4.0 + 3.5 * sin(q * PI));
  float z = 8.0 + 2.0 * cos(q * PI);
  alpha = 0.95;
  glow = 0.9;
  return vec3(x, y, z);
}

vec3 windowSample(float raw, out float alpha, out float glow) {
  if (isA380Profile()) {
    float group = floor(raw / 80.0);
    float station = floor(group / 4.0);
    float row = mod(group, 2.0);
    float side = floor(mod(group, 4.0) / 2.0) < 0.5 ? -1.0 : 1.0;
    float j = mod(raw, 80.0);
    float x = 112.0 - station * 6.35;
    vec3 p = ringPoint(x, side * (radiusAt(x) * mix(0.62, 0.84, row)), 1.1, 0.42, 4.2 + row * 2.25, j, 80.0, alpha, glow);
    alpha *= 0.92;
    return p;
  }
  float groupSize = isA380Profile() ? 640.0 : 320.0;
  float n = floor(raw / groupSize);
  float row = isA380Profile() ? floor(mod(raw, groupSize) / 320.0) : 0.0;
  float side = floor(mod(raw, 320.0) / 160.0) < 0.5 ? -1.0 : 1.0;
  float j = mod(raw, 160.0);
  float x = 105.0 - n * 6.3;
  float rowBias = isA380Profile() ? mix(0.62, 0.82, row) : 0.78;
  vec3 p = ringPoint(x, side * (radiusAt(x) * rowBias), 1.25, 0.48, 4.5 + row * 2.2, j, 160.0, alpha, glow);
  alpha *= isA380Profile() ? 0.95 : 1.0;
  return p;
}

vec3 doorSample(float raw, out float alpha, out float glow) {
  float boxId = floor(raw / 200.0);
  float local = mod(raw, 200.0);
  float side = boxId < 4.0 ? -1.0 : 1.0;
  float kind = mod(boxId, 4.0);
  float x = 118.0;
  float sx = 5.0;
  float sy = 9.0;
  alpha = 0.82;
  glow = 0.72;
  if (kind > 0.5 && kind < 1.5) {
    x = -119.0;
  } else if (kind > 1.5 && kind < 2.5) {
    x = 8.0;
    sx = 4.0;
    sy = 7.0;
    alpha = 0.65;
  } else if (kind > 2.5) {
    x = -8.0;
    sx = 4.0;
    sy = 7.0;
    alpha = 0.65;
  }
  float y = side * radiusAt(x) * (abs(x) > 100.0 ? 0.96 : 0.98);
  return boxPoint(local, x, y, sx, sy, 5.0, alpha, glow);
}

vec3 wingSurfaceSample(float raw, out float alpha, out float glow) {
  float side = floor(raw / 9000.0) < 0.5 ? -1.0 : 1.0;
  float i = mod(raw, 9000.0);
  float u = mod(i, 240.0) / 239.0;
  float v = mod(floor(i / 240.0), 80.0) / 79.0;
  alpha = 0.33 + 0.25 * (1.0 - u);
  glow = 0.22 + 0.28 * u;
  return wingPoint(side, u, v);
}

vec3 wingDetailSample(float raw, out float alpha, out float glow) {
  float side = floor(raw / 1600.0) < 0.5 ? -1.0 : 1.0;
  float local = mod(raw, 1600.0);
  float u = 0.0;
  float v = 0.0;
  alpha = 0.72;
  glow = 0.62;
  if (local < 500.0) {
    float edge = floor(local / 250.0);
    u = mod(local, 250.0) / 249.0;
    v = edge;
  } else if (local < 900.0) {
    float rib = floor((local - 500.0) / 100.0);
    u = ribU(rib);
    v = mod(local - 500.0, 100.0) / 99.0;
  } else {
    float n = local - 900.0;
    float stripe = floor(n / 54.0);
    u = clamp(0.18 + stripe * 0.06, 0.18, 0.92);
    v = 0.58 + mod(n, 54.0) / 53.0 * 0.35;
    alpha = 0.48;
    glow = 0.42;
  }
  return wingPoint(side, u, v);
}

vec3 sharkletSample(float raw, out float alpha, out float glow) {
  float side = floor(raw / 420.0) < 0.5 ? -1.0 : 1.0;
  float u = mod(raw, 420.0) / 419.0;
  float x = -43.0 - 4.0 * sin(u * PI);
  float y = side * (SPAN + 2.0 + 7.0 * sin(u * PI / 2.0));
  float z = 3.0 + u * 34.0;
  alpha = 0.72;
  glow = 0.82;
  return vec3(x, y, z);
}

vec3 engineSample(float raw, out float alpha, out float glow) {
  float side = floor(raw / 1500.0) < 0.5 ? -1.0 : 1.0;
  float local = mod(raw, 1500.0);
  if (isA380Profile()) {
    float slot = floor(local / 750.0);
    local = mod(local, 750.0);
    float engineX = mix(5.0, -27.0, slot);
    float engineY = side * mix(40.0, 72.0, slot);
    if (local < 120.0) return ringPoint(engineX, engineY, 8.5, 14.0, -7.0, local, 120.0, alpha, glow);
    if (local < 240.0) {
      vec3 r = ringPoint(engineX, engineY, 4.2, 7.2, -6.0, local - 120.0, 120.0, alpha, glow);
      alpha = 0.58;
      glow = 0.8;
      return r;
    }
    if (local < 660.0) {
      float j = local - 240.0;
      float c = j * 0.32 + uTime * (1.2 + uBass * uReactivity * 2.4);
      float r = 2.8 + j / 420.0 * 7.5;
      alpha = 0.44 + uBass * 0.18 * uReactivity;
      glow = 0.95;
      return vec3(engineX + cos(c) * r * 0.38, engineY + sin(c) * r * side, -7.0 + cos(c * 3.0 - uTime) * 1.4);
    }
    float q = (local - 660.0) / 89.0;
    alpha = 0.42;
    glow = 0.34;
    return vec3(engineX - 15.0 + q * 24.0, side * (abs(engineY) - 5.0 + 2.0 * sin(q * PI)), -3.0);
  }
  if (local < 160.0) return ringPoint(-6.0, side * 54.0, 8.0, 15.0, -7.0, local, 160.0, alpha, glow);
  if (local < 320.0) {
    vec3 r = ringPoint(-6.0, side * 54.0, 4.0, 8.0, -6.0, local - 160.0, 160.0, alpha, glow);
    alpha = 0.54;
    glow = 0.75;
    return r;
  }
  if (local < 1220.0) {
    float j = local - 320.0;
    float c = j * 0.19 + uTime * (1.0 + uBass * uReactivity * 2.0);
    float r = 3.0 + j / 900.0 * 8.0;
    float x = -6.0 + cos(c) * r * 0.38;
    float y = side * (54.0 + sin(c) * r);
    float z = -7.0 + cos(c * 3.0 - uTime) * 1.5;
    alpha = 0.42 + uBass * 0.16 * uReactivity;
    glow = 0.9;
    return vec3(x, y, z);
  }
  float q = mod(local - 1220.0, 220.0) / 219.0;
  alpha = 0.48;
  glow = 0.36;
  return vec3(-22.0 + q * 32.0, side * (48.0 + 3.0 * sin(q * PI)), -3.0);
}

vec3 tailplaneSurfaceSample(float raw, out float alpha, out float glow) {
  float side = floor(raw / 3000.0) < 0.5 ? -1.0 : 1.0;
  float i = mod(raw, 3000.0);
  float u = mod(i, 140.0) / 139.0;
  float v = mod(floor(i / 140.0), 42.0) / 41.0;
  alpha = 0.48;
  glow = 0.4;
  return tailplanePoint(side, u, v);
}

vec3 tailplaneDetailSample(float raw, out float alpha, out float glow) {
  float side = floor(raw / 300.0) < 0.5 ? -1.0 : 1.0;
  float local = mod(raw, 300.0);
  float edge = floor(local / 150.0);
  float u = mod(local, 150.0) / 149.0;
  alpha = 0.72;
  glow = 0.62;
  return tailplanePoint(side, u, edge);
}

vec3 verticalSample(float raw, out float alpha, out float glow) {
  float u = mod(raw, 120.0) / 119.0;
  float v = mod(floor(raw / 120.0), 50.0) / 49.0;
  float x = mix(-104.0, -148.0, u);
  float h = 13.0 + 54.0 * sin(u * PI * 0.88);
  float y = sin(raw * 9.7 + uTime) * 0.65;
  float z = 8.0 + v * h;
  alpha = 0.58;
  glow = 0.62;
  return vec3(x, y, z);
}

vec3 verticalDetailSample(float raw, out float alpha, out float glow) {
  float edge = floor(raw / 300.0);
  float u = mod(raw, 300.0) / 299.0;
  float x = mix(-104.0, -148.0, u);
  float h = 13.0 + 54.0 * sin(u * PI * 0.88);
  alpha = edge < 0.5 ? 0.96 : 0.62;
  glow = edge < 0.5 ? 0.9 : 0.5;
  return vec3(x, 0.0, edge < 0.5 ? 8.0 + h : 8.0);
}

vec3 aftSample(float raw, out float alpha, out float glow) {
  float q = raw / 499.0;
  float c = q * TAU * 4.0;
  float x = -134.0 - q * 15.0;
  float y = sin(c) * radiusAt(x) * 0.8;
  float z = 2.0 + cos(c) * 2.0;
  alpha = 0.56;
  glow = 0.36;
  return vec3(x, y, z);
}

vec3 panelSample(float raw, out float alpha, out float glow) {
  float idx = floor(raw / 120.0);
  float c = mod(raw, 120.0) / 119.0 * TAU;
  float x = panelX(idx);
  alpha = 0.36;
  glow = 0.32;
  return vec3(x, radiusAt(x) * sin(c), 3.0 + cos(c) * 2.0);
}

vec3 wingBoxSample(float raw, out float alpha, out float glow) {
  float x = raw;
  if (x < 14000.0) {
    float side = floor(x / 7000.0) < 0.5 ? -1.0 : 1.0;
    float i = mod(x, 7000.0);
    float u = mod(i, 280.0) / 279.0;
    float v = mod(floor(i / 280.0), 25.0) / 24.0;
    float le = mix(26.0, -76.0, u);
    float te = mix(-24.0, -118.0, u);
    float lx = mix(le, te, v);
    float ly = side * mix(18.0, 166.0, u);
    float z = -1.5 + sin(u * PI) * 4.2 + (v - 0.5) * 2.8;
    alpha = 0.24 + 0.28 * (1.0 - u);
    glow = 0.30 + 0.24 * smoothstep(0.62, 1.0, u);
    return vec3(lx, ly, z);
  }
  x -= 14000.0;
  if (x < 14000.0) {
    float side = floor(x / 7000.0) < 0.5 ? -1.0 : 1.0;
    float local = mod(x, 7000.0);
    float band = floor(local / 500.0);
    float q = mod(local, 500.0) / 499.0;
    float u = band < 10.0 ? band / 9.0 : q;
    float v = band < 10.0 ? q : (band < 12.0 ? 0.16 : 0.82);
    float le = mix(26.0, -76.0, u);
    float te = mix(-24.0, -118.0, u);
    float lx = mix(le, te, v);
    float ly = side * mix(18.0, 166.0, u);
    alpha = band < 10.0 ? 0.58 : 0.76;
    glow = band < 10.0 ? 0.52 : 0.72;
    return vec3(lx, ly, 4.0);
  }
  x -= 14000.0;
  if (x < 12000.0) {
    float edge = floor(x / 3000.0);
    float q = mod(x, 3000.0) / 2999.0;
    float lx = edge < 2.0 ? mix(32.0, -48.0, q) : (edge < 2.5 ? 32.0 : -48.0);
    float ly = edge < 0.5 ? -24.0 : edge < 1.5 ? 24.0 : mix(-24.0, 24.0, q);
    float z = edge < 2.0 ? 6.0 : mix(-7.0, 7.0, fract(q * 8.0));
    alpha = 0.74;
    glow = 0.78;
    return vec3(lx, ly, z);
  }
  x -= 12000.0;
  if (x < 9000.0) {
    float slot = floor(x / 2250.0);
    float local = mod(x, 2250.0);
    float side = slot < 2.0 ? -1.0 : 1.0;
    float outboard = mod(slot, 2.0);
    float cx = mix(2.0, -30.0, outboard);
    float cy = side * mix(54.0, 95.0, outboard);
    if (local < 360.0) return ringPoint(cx, cy, 11.0, 8.0, -5.0, local, 360.0, alpha, glow);
    float q = (local - 360.0) / 1889.0;
    float spoke = floor(q * 16.0);
    float r = fract(q * 16.0) * 11.0;
    float c = spoke / 16.0 * TAU + uTime * (1.0 + uBass * uReactivity * 2.0);
    alpha = 0.52;
    glow = 0.92;
    return vec3(cx + cos(c) * r, cy + sin(c) * r, -5.0 + sin(q * TAU * 6.0) * 1.2);
  }
  x -= 9000.0;
  if (x < 8000.0) {
    float station = floor(x / 200.0);
    float c = mod(x, 200.0) / 199.0 * TAU;
    float lx = mix(32.0, -48.0, station / 39.0);
    float ry = 24.0 + sin(station * 0.7) * 2.0;
    alpha = 0.44;
    glow = 0.48;
    return vec3(lx, ry * sin(c), 6.0 * cos(c));
  }
  float q = fract(x / 220.0);
  float rail = floor(mod(x / 220.0, 6.0));
  float side = rail < 3.0 ? -1.0 : 1.0;
  float u = q;
  float y = side * mix(42.0, 158.0, u);
  float lx = mix(18.0, -103.0, u) + (mod(rail, 3.0) - 1.0) * 2.5;
  alpha = 0.38;
  glow = 0.34;
  return vec3(lx, y, -9.0);
}

float refF(float x) {
  float hl = 36.365;
  float f = smoothstep(-hl, -hl + 11.0, x) * (1.0 - smoothstep(hl - 9.0, hl, x));
  return pow(max(0.0, f), 0.34);
}

vec2 projectReferenceA380(float x, float y, float z) {
  float yaw = -0.53 + 0.045 * sin(uTime / 2.0);
  float xCam = x * cos(yaw) - y * sin(yaw);
  float depth = x * sin(yaw) + y * cos(yaw);
  float sc = 3.95 / (1.0 + depth / 260.0);
  vec2 p = vec2(200.0 + xCam * sc, 252.0 - z * sc + depth * sc * 0.21);
  return vec2(p.x - 200.0, -(p.y - 200.0));
}

vec2 projectAircraftIso(float x, float y, float z, float drawScale, float yCenter, float yaw, float depthDiv, float depthLift) {
  float xCam = x * cos(yaw) - y * sin(yaw);
  float depth = x * sin(yaw) + y * cos(yaw);
  float sc = drawScale / (1.0 + depth / depthDiv);
  vec2 p = vec2(200.0 + xCam * sc, yCenter - z * sc + depth * sc * depthLift);
  return vec2(p.x - 200.0, -(p.y - 200.0));
}

vec3 refRing(float x, float y, float z, float rx, float rz, float raw, float count, out float alpha, out float glow) {
  float c = raw / max(count - 1.0, 1.0) * TAU;
  alpha = 0.68;
  glow = 0.72;
  return vec3(x + rx * cos(c), y, z + rz * sin(c));
}

vec3 refDoor(float raw, float x, float y, float z, float sx, float sz, out float alpha, out float glow) {
  float edge = floor(raw / 34.0);
  float q = mod(raw, 34.0) / 33.0;
  alpha = 0.72;
  glow = 0.70;
  if (edge < 0.5) return vec3(x + sx * (q - 0.5), y, z - sz / 2.0);
  if (edge < 1.5) return vec3(x + sx * (q - 0.5), y, z + sz / 2.0);
  if (edge < 2.5) return vec3(x - sx / 2.0, y, z + sz * (q - 0.5));
  return vec3(x + sx / 2.0, y, z + sz * (q - 0.5));
}

vec3 refLine(float raw, float count, vec3 a, vec3 b, out float alpha, out float glow) {
  float q = raw / max(count - 1.0, 1.0);
  alpha = 0.58;
  glow = 0.52;
  return mix(a, b, q);
}

float refDoorX(float idx, float upper) {
  if (upper > 0.5) {
    if (idx < 0.5) return 22.0;
    if (idx < 1.5) return 8.0;
    if (idx < 2.5) return -7.0;
    return -20.0;
  }
  if (idx < 0.5) return 28.5;
  if (idx < 1.5) return 17.0;
  if (idx < 2.5) return 4.0;
  if (idx < 3.5) return -10.5;
  if (idx < 4.5) return -23.5;
  return -31.5;
}

vec3 refWing(float side, float u, float v, out float alpha, out float glow) {
  float root = 3.75 + 0.8;
  float xLE = mix(7.8, -14.8, u);
  float chord = mix(18.5, 5.3, u);
  float x = xLE - chord * v + 0.18 * sin(12.0 * u + uTime);
  float y = side * mix(root, 39.875, u);
  float z = 5.2 + 1.35 * pow(u, 1.3) + 0.42 * sin(u * PI) - 0.18 * v;
  alpha = 0.28 + 0.36 * (1.0 - u);
  glow = 0.30 + 0.24 * u;
  return vec3(x, y, z);
}

vec3 refEngine(float raw, float cx, float cy, float cz, out float alpha, out float glow) {
  if (raw < 1800.0) {
    float u = mod(raw, 75.0) / 74.0;
    float c = floor(raw / 75.0) / 24.0 * TAU;
    float x = cx + 6.4 * (u - 0.5);
    float r = 1.72 * (0.92 + 0.08 * sin(u * PI));
    alpha = 0.38;
    glow = 0.46;
    return vec3(x, cy + r * sin(c), cz + r * 0.78 * cos(c));
  }
  if (raw < 1896.0) {
    float c = (raw - 1800.0) / 95.0 * TAU;
    alpha = 0.86;
    glow = 0.95;
    return vec3(cx + 3.25, cy + 1.72 * sin(c), cz + 1.33 * cos(c));
  }
  if (raw < 2376.0) {
    float j = raw - 1896.0;
    float blade = floor(j / 20.0);
    float q = mod(j, 20.0) / 19.0;
    float c = blade / 24.0 * TAU + uTime * 4.0;
    alpha = 0.42 + uBass * 0.2 * uReactivity;
    glow = 0.90;
    return vec3(cx + 3.32, cy + 1.35 * cos(c) * q, cz + 1.05 * sin(c) * q);
  }
  float q = (raw - 2376.0) / 123.0;
  alpha = 0.46;
  glow = 0.42;
  return vec3(cx - 1.5 + 2.7 * q, cy * 0.985, cz + 1.2 + 2.5 * q);
}

vec3 refHTail(float side, float u, float v, out float alpha, out float glow) {
  float xLE = mix(-24.2, -32.8, u);
  float chord = mix(10.6, 3.2, u);
  float x = xLE - chord * v;
  float y = side * mix(3.75 * 0.75, 18.3, u);
  float z = 9.4 + 0.62 * u - 0.08 * v;
  alpha = 0.44 + 0.28 * (1.0 - u);
  glow = 0.50;
  return vec3(x, y, z);
}

vec3 refWheel(float raw, float x, float y, float z, float r, out float alpha, out float glow) {
  float c = raw / 41.0 * TAU;
  alpha = 0.68;
  glow = 0.66;
  return vec3(x + r * cos(c), y, z + r * sin(c));
}

vec3 referenceA380Sample(float raw, out float alpha, out float glow) {
  float x = raw;
  if (x < 19000.0) {
    float lx = -36.365 + 72.73 * (mod(x, 950.0) / 949.0);
    float f = refF(lx);
    float c = x * 2.399 + uTime * 0.38;
    float r = 0.45 + 0.55 * abs(sin(x * 0.011));
    alpha = (34.0 + 46.0 * abs(sin(c))) / 170.0;
    glow = 0.20 + 0.42 * abs(sin(c));
    return vec3(lx, 3.75 * f * sin(c) * r, 5.8 + 4.35 * f * cos(c) * r + 0.25 * sin(lx * 0.9 + uTime));
  }
  x -= 19000.0;
  if (x < 1200.0) {
    float strip = floor(x / 300.0);
    float lx = -36.365 + 72.73 * (mod(x, 300.0) / 299.0);
    float f = refF(lx);
    alpha = strip < 0.5 ? 0.76 : strip < 1.5 ? 0.58 : 0.42;
    glow = strip < 2.0 ? 0.72 : 0.36;
    if (strip < 0.5) return vec3(lx, 3.75 * f, 5.8);
    if (strip < 1.5) return vec3(lx, -3.75 * f, 5.8);
    if (strip < 2.5) return vec3(lx, 0.0, 5.8 + 4.35 * f);
    return vec3(lx, 0.0, 5.8 - 4.35 * f * 0.7);
  }
  x -= 1200.0;
  if (x < 1400.0) {
    float u = x / 1399.0;
    float c = u * TAU * 4.0 + uTime / 2.0;
    float lx = 36.365 - 9.0 + 9.0 * pow(u, 0.72);
    float f = refF(lx);
    alpha = 0.56;
    glow = 0.52;
    return vec3(lx, 3.75 * f * sin(c) * 0.9, 6.1 + 4.35 * f * cos(c) * 0.75);
  }
  x -= 1400.0;
  if (x < 200.0) {
    float side = floor(x / 100.0) < 0.5 ? -1.0 : 1.0;
    float q = mod(x, 100.0) / 99.0;
    alpha = 0.95;
    glow = 0.95;
    return vec3(27.4 + 5.8 * q, side * (1.05 + 1.7 * sin(q * PI)), 9.7 + 0.75 * cos(q * PI));
  }
  x -= 200.0;
  if (x < 6144.0) {
    float group = floor(x / 32.0);
    float j = mod(x, 32.0);
    float n = floor(group / 4.0);
    float side = floor(mod(group, 4.0) / 2.0) < 0.5 ? -1.0 : 1.0;
    float deck = mod(group, 2.0);
    float lx = 29.5 - n * 1.18;
    float f = refF(lx);
    float visible = f > 0.58 && (deck < 0.5 || (lx > -24.0 && lx < 27.0)) ? 1.0 : 0.0;
    vec3 p = refRing(lx, side * 3.75 * f * 1.015, deck < 0.5 ? 6.45 : 8.38, deck < 0.5 ? 0.16 : 0.15, deck < 0.5 ? 0.08 : 0.075, j, 32.0, alpha, glow);
    alpha *= visible * (side > 0.0 ? deck < 0.5 ? 0.85 : 0.76 : deck < 0.5 ? 0.41 : 0.34);
    return p;
  }
  x -= 6144.0;
  if (x < 2800.0) {
    float group = floor(x / 136.0);
    float local = mod(x, 136.0);
    float side = floor(group / 10.0) < 0.5 ? -1.0 : 1.0;
    float item = mod(group, 10.0);
    float upper = item > 5.5 ? 1.0 : 0.0;
    float idx = upper > 0.5 ? item - 6.0 : item;
    float lx = refDoorX(idx, upper);
    float f = refF(lx);
    vec3 p = refDoor(local, lx, side * 3.75 * f * 1.05, upper > 0.5 ? 8.3 : 6.3, upper > 0.5 ? 0.62 : 0.72, upper > 0.5 ? 1.75 : 2.2, alpha, glow);
    alpha *= upper > 0.5 ? 0.62 : 0.74;
    return p;
  }
  x -= 2800.0;
  if (x < 864.0) {
    float idx = floor(x / 96.0);
    float c = mod(x, 96.0) / 95.0 * TAU;
    float lx = refPanelX(idx);
    float f = refF(lx);
    alpha = 0.26;
    glow = 0.25;
    return vec3(lx, 3.75 * f * sin(c), 5.8 + 4.35 * f * cos(c));
  }
  x -= 864.0;
  if (x < 560.0) {
    float side = floor(x / 280.0) < 0.5 ? -1.0 : 1.0;
    float lx = -31.0 + 61.0 * (mod(x, 280.0) / 279.0);
    float f = refF(lx);
    alpha = side > 0.0 ? 0.58 : 0.30;
    glow = 0.56;
    return vec3(lx, side * 3.75 * f * 1.035, 7.35 + 0.16 * sin(lx / 2.0 + uTime));
  }
  x -= 560.0;
  if (x < 25000.0) {
    float side = floor(x / 12500.0) < 0.5 ? -1.0 : 1.0;
    float i = mod(x, 12500.0);
    float u = mod(i, 250.0) / 249.0;
    float v = mod(floor(i / 250.0), 50.0) / 49.0;
    return refWing(side, u, v, alpha, glow);
  }
  x -= 25000.0;
  if (x < 5000.0) {
    float side = floor(x / 2500.0) < 0.5 ? -1.0 : 1.0;
    float local = mod(x, 2500.0);
    if (local < 600.0) {
      float edge = floor(local / 300.0);
      return refWing(side, mod(local, 300.0) / 299.0, edge, alpha, glow);
    }
    if (local < 1500.0) {
      float g = floor((local - 600.0) / 150.0);
      float r = 0.17 + g * 0.148;
      return refWing(side, r, mod(local - 600.0, 150.0) / 149.0, alpha, glow);
    }
    float g = floor((local - 1500.0) / 100.0);
    float u = 0.08 + g * 0.075;
    return refWing(side, u, 0.14 + mod(local - 1500.0, 100.0) / 99.0 * 0.78, alpha, glow);
  }
  x -= 5000.0;
  if (x < 720.0) {
    float side = floor(x / 360.0) < 0.5 ? -1.0 : 1.0;
    float u = mod(x, 360.0) / 359.0;
    alpha = 0.72;
    glow = 0.82;
    return vec3(-15.2 - 1.6 * sin(u * PI), side * (39.875 + 0.4 * sin(u * PI)), 6.4 + 3.6 * u);
  }
  x -= 720.0;
  if (x < 10000.0) {
    float engine = floor(x / 2500.0);
    float side = engine < 2.0 ? -1.0 : 1.0;
    float outer = mod(engine, 2.0);
    return refEngine(mod(x, 2500.0), outer < 0.5 ? -1.5 : -5.2, side * (outer < 0.5 ? 12.8 : 25.2), outer < 0.5 ? 2.9 : 2.45, alpha, glow);
  }
  x -= 10000.0;
  if (x < 9000.0) {
    float side = floor(x / 4500.0) < 0.5 ? -1.0 : 1.0;
    float local = mod(x, 4500.0);
    if (local < 4300.0) {
      float u = mod(local, 145.0) / 144.0;
      float v = mod(floor(local / 145.0), 30.0) / 29.0;
      return refHTail(side, u, v, alpha, glow);
    }
    float edge = floor((local - 4300.0) / 100.0);
    return refHTail(side, mod(local - 4300.0, 100.0) / 99.0, edge, alpha, glow);
  }
  x -= 9000.0;
  if (x < 6000.0) {
    if (x < 4200.0) {
      float h = mod(x, 150.0) / 149.0;
      float v = mod(floor(x / 150.0), 42.0) / 41.0;
      float z = 9.1 + h * 15.4;
      float xLE = mix(-23.7, -32.8, h);
      float xTE = mix(-36.2, -38.0, h);
      alpha = 0.46 + 0.18 * h;
      glow = 0.62 + 0.18 * h;
      return vec3(mix(xLE, xTE, v), 0.12 * sin(x * 1.7 + uTime), z);
    }
    float local = x - 4200.0;
    float seg = floor(local / 120.0);
    float q = mod(local, 120.0);
    if (seg < 0.5) return refLine(q, 120.0, vec3(-23.7, 0.0, 9.1), vec3(-32.8, 0.0, 24.5), alpha, glow);
    if (seg < 1.5) return refLine(q, 120.0, vec3(-36.2, 0.0, 9.1), vec3(-38.0, 0.0, 24.5), alpha, glow);
    if (seg < 2.5) return refLine(q, 120.0, vec3(-32.8, 0.0, 24.5), vec3(-38.0, 0.0, 24.5), alpha, glow);
    if (seg < 3.5) return refLine(q, 120.0, vec3(-23.7, 0.0, 9.1), vec3(-36.2, 0.0, 9.1), alpha, glow);
    float tri = floor((local - 480.0) / 100.0);
    float h = 0.16 + floor(tri / 3.0) * 0.165;
    float z = 9.1 + h * 15.4;
    float xLE = mix(-23.7, -32.8, h);
    float xTE = mix(-36.2, -38.0, h);
    float which = mod(tri, 3.0);
    if (which < 0.5) return refLine(mod(local - 480.0, 100.0), 100.0, vec3(xLE, 0.0, z), vec3(xTE, 0.0, z), alpha, glow);
    if (which < 1.5) return refLine(mod(local - 480.0, 100.0), 100.0, vec3(xLE, 0.0, z), vec3(-36.2, 0.0, 9.1), alpha, glow);
    return refLine(mod(local - 480.0, 100.0), 100.0, vec3(xTE, 0.0, z), vec3(-23.7, 0.0, 9.1), alpha, glow);
  }
  x -= 6000.0;
  if (x < 1400.0) {
    float gear = floor(x / 120.0);
    float local = mod(x, 120.0);
    float gx = 25.4;
    float gy = 0.0;
    if (gear > 0.5) {
      float side = floor((gear - 1.0) / 5.0) < 0.5 ? -1.0 : 1.0;
      float slot = mod(gear - 1.0, 5.0);
      gx = slot < 0.5 ? -6.5 : slot < 1.5 ? -8.5 : slot < 2.5 ? -10.5 : slot < 3.5 ? -5.5 : -7.4;
      gy = side * (slot < 3.0 ? 2.8 : 6.6);
    }
    if (local < 36.0) return refLine(local, 36.0, vec3(gx, gy, 4.2), vec3(gx, gy, 0.45), alpha, glow);
    if (local < 78.0) return refWheel(local - 36.0, gx - 0.38, gy, 0.38, 0.48, alpha, glow);
    return refWheel(local - 78.0, gx + 0.38, gy, 0.38, 0.48, alpha, glow);
  }
  x -= 1400.0;
  if (x < 400.0) {
    if (x < 200.0) return refLine(x, 200.0, vec3(-36.365, 0.0, 5.8), vec3(36.365, 0.0, 5.8), alpha, glow);
    return refLine(x - 200.0, 200.0, vec3(-7.0, -39.875, 5.2), vec3(-7.0, 39.875, 5.2), alpha, glow);
  }
  alpha = 0.0;
  glow = 0.0;
  return vec3(0.0);
}

float a350F(float x) {
  float hl = 33.4;
  float f = smoothstep(-hl, -hl + 10.0, x) * (1.0 - smoothstep(hl - 8.2, hl, x));
  return pow(max(0.0, f), 0.36);
}

float a350DoorX(float idx) {
  if (idx < 0.5) return 29.0;
  if (idx < 1.5) return 17.0;
  if (idx < 2.5) return 5.0;
  if (idx < 3.5) return -8.5;
  if (idx < 4.5) return -21.5;
  return -30.0;
}

float a350PanelX(float idx) {
  if (idx < 0.5) return 30.0;
  if (idx < 1.5) return 24.0;
  if (idx < 2.5) return 18.0;
  if (idx < 3.5) return 12.0;
  if (idx < 4.5) return 6.0;
  if (idx < 5.5) return 0.0;
  if (idx < 6.5) return -7.0;
  if (idx < 7.5) return -14.0;
  if (idx < 8.5) return -21.0;
  if (idx < 9.5) return -27.0;
  if (idx < 10.5) return -31.0;
  return 33.0;
}

vec3 a350Wing(float side, float u, float v, out float alpha, out float glow) {
  float root = 3.25 + 0.7;
  float xLE = mix(8.6, -18.2, u);
  float chord = mix(16.4, 4.1, u);
  float rake = smoothstep(0.84, 1.0, u);
  float x = xLE - chord * v - 2.8 * rake * v + 0.12 * sin(10.0 * u + uTime);
  float y = side * mix(root, 32.375, u);
  float z = 5.0 + 1.55 * pow(u, 1.22) + 0.46 * sin(u * PI) - 0.12 * v + 1.8 * rake * pow(v, 1.4);
  alpha = 0.30 + 0.38 * (1.0 - u);
  glow = 0.34 + 0.22 * u + 0.18 * rake;
  return vec3(x, y, z);
}

vec3 a350Engine(float raw, float cx, float cy, float cz, out float alpha, out float glow) {
  if (raw < 2100.0) {
    float u = mod(raw, 84.0) / 83.0;
    float c = floor(raw / 84.0) / 25.0 * TAU;
    float x = cx + 7.2 * (u - 0.5);
    float r = 2.04 * (0.90 + 0.10 * sin(u * PI));
    alpha = 0.40;
    glow = 0.48;
    return vec3(x, cy + r * sin(c), cz + r * 0.78 * cos(c));
  }
  if (raw < 2236.0) {
    float c = (raw - 2100.0) / 135.0 * TAU;
    alpha = 0.90;
    glow = 0.98;
    return vec3(cx + 3.65, cy + 2.05 * sin(c), cz + 1.60 * cos(c));
  }
  if (raw < 2820.0) {
    float j = raw - 2236.0;
    float blade = floor(j / 24.0);
    float q = mod(j, 24.0) / 23.0;
    float c = blade / 24.0 * TAU + uTime * 4.4;
    alpha = 0.44 + uBass * 0.22 * uReactivity;
    glow = 0.94;
    return vec3(cx + 3.72, cy + 1.66 * cos(c) * q, cz + 1.26 * sin(c) * q);
  }
  float q = (raw - 2820.0) / 279.0;
  alpha = 0.50;
  glow = 0.46;
  return vec3(cx - 1.7 + 3.0 * q, cy * 0.985, cz + 1.2 + 2.75 * q);
}

vec3 a350HTail(float side, float u, float v, out float alpha, out float glow) {
  float xLE = mix(-23.2, -31.8, u);
  float chord = mix(9.4, 2.9, u);
  float x = xLE - chord * v;
  float y = side * mix(2.3, 15.4, u);
  float z = 9.0 + 0.52 * u - 0.08 * v;
  alpha = 0.48 + 0.28 * (1.0 - u);
  glow = 0.50;
  return vec3(x, y, z);
}

vec3 a350Sample(float raw, out float alpha, out float glow) {
  float x = raw;
  if (x < 17000.0) {
    float lx = -33.4 + 66.8 * (mod(x, 850.0) / 849.0);
    float f = a350F(lx);
    float c = x * 2.399 + uTime * 0.35;
    float r = 0.42 + 0.58 * abs(sin(x * 0.013));
    alpha = (36.0 + 44.0 * abs(sin(c))) / 170.0;
    glow = 0.18 + 0.42 * abs(sin(c));
    return vec3(lx, 3.25 * f * sin(c) * r, 5.65 + 3.95 * f * cos(c) * r + 0.18 * sin(lx * 0.72 + uTime));
  }
  x -= 17000.0;
  if (x < 1200.0) {
    float strip = floor(x / 300.0);
    float lx = -33.4 + 66.8 * (mod(x, 300.0) / 299.0);
    float f = a350F(lx);
    alpha = strip < 0.5 ? 0.76 : strip < 1.5 ? 0.58 : 0.42;
    glow = strip < 2.0 ? 0.72 : 0.36;
    if (strip < 0.5) return vec3(lx, 3.25 * f, 5.65);
    if (strip < 1.5) return vec3(lx, -3.25 * f, 5.65);
    if (strip < 2.5) return vec3(lx, 0.0, 5.65 + 3.95 * f);
    return vec3(lx, 0.0, 5.65 - 3.95 * f * 0.68);
  }
  x -= 1200.0;
  if (x < 1200.0) {
    float u = x / 1199.0;
    float c = u * TAU * 3.4 + uTime / 2.0;
    float lx = 33.4 - 8.2 + 8.2 * pow(u, 0.72);
    float f = a350F(lx);
    alpha = 0.56;
    glow = 0.55;
    return vec3(lx, 3.25 * f * sin(c) * 0.9, 5.95 + 3.95 * f * cos(c) * 0.74);
  }
  x -= 1200.0;
  if (x < 220.0) {
    float side = floor(x / 110.0) < 0.5 ? -1.0 : 1.0;
    float q = mod(x, 110.0) / 109.0;
    alpha = 0.96;
    glow = 0.96;
    return vec3(26.8 + 5.4 * q, side * (0.92 + 1.56 * sin(q * PI)), 9.32 + 0.66 * cos(q * PI));
  }
  x -= 220.0;
  if (x < 3264.0) {
    float group = floor(x / 32.0);
    float j = mod(x, 32.0);
    float n = floor(group / 2.0);
    float side = mod(group, 2.0) < 0.5 ? -1.0 : 1.0;
    float lx = 28.5 - n * 1.12;
    float f = a350F(lx);
    float visible = f > 0.56 ? 1.0 : 0.0;
    vec3 p = refRing(lx, side * 3.25 * f * 1.015, 6.55, 0.16, 0.08, j, 32.0, alpha, glow);
    alpha *= visible * (side > 0.0 ? 0.86 : 0.42);
    return p;
  }
  x -= 3264.0;
  if (x < 1632.0) {
    float group = floor(x / 136.0);
    float local = mod(x, 136.0);
    float side = floor(group / 6.0) < 0.5 ? -1.0 : 1.0;
    float lx = a350DoorX(mod(group, 6.0));
    float f = a350F(lx);
    return refDoor(local, lx, side * 3.25 * f * 1.05, 6.4, 0.66, 2.05, alpha, glow);
  }
  x -= 1632.0;
  if (x < 1152.0) {
    float idx = floor(x / 96.0);
    float c = mod(x, 96.0) / 95.0 * TAU;
    float lx = a350PanelX(idx);
    float f = a350F(lx);
    alpha = 0.26;
    glow = 0.28;
    return vec3(lx, 3.25 * f * sin(c), 5.65 + 3.95 * f * cos(c));
  }
  x -= 1152.0;
  if (x < 6500.0) {
    if (x < 3900.0) {
      float station = floor(x / 60.0);
      float c = mod(x, 60.0) / 59.0 * TAU;
      float lx = mix(30.5, -31.5, station / 64.0);
      float f = a350F(lx);
      alpha = 0.38 + 0.14 * smoothstep(0.92, 1.0, abs(cos(c)));
      glow = 0.52;
      return vec3(lx, 3.05 * f * sin(c), 5.65 + 3.70 * f * cos(c));
    }
    float local = x - 3900.0;
    float rail = floor(local / 200.0);
    float q = mod(local, 200.0) / 199.0;
    float lx = mix(31.0, -31.0, q);
    float f = a350F(lx);
    float c = rail / 13.0 * TAU;
    alpha = 0.32;
    glow = 0.44;
    return vec3(lx, 3.12 * f * sin(c), 5.65 + 3.78 * f * cos(c));
  }
  x -= 6500.0;
  if (x < 22000.0) {
    float side = floor(x / 11000.0) < 0.5 ? -1.0 : 1.0;
    float i = mod(x, 11000.0);
    float u = mod(i, 275.0) / 274.0;
    float v = mod(floor(i / 275.0), 40.0) / 39.0;
    return a350Wing(side, u, v, alpha, glow);
  }
  x -= 22000.0;
  if (x < 7000.0) {
    float side = floor(x / 3500.0) < 0.5 ? -1.0 : 1.0;
    float local = mod(x, 3500.0);
    if (local < 800.0) {
      float edge = floor(local / 400.0);
      return a350Wing(side, mod(local, 400.0) / 399.0, edge, alpha, glow);
    }
    if (local < 2200.0) {
      float r = floor((local - 800.0) / 175.0);
      float u = 0.12 + r * 0.105;
      return a350Wing(side, u, mod(local - 800.0, 175.0) / 174.0, alpha, glow);
    }
    float g = floor((local - 2200.0) / 100.0);
    float u = 0.10 + g * 0.06;
    return a350Wing(side, u, 0.12 + mod(local - 2200.0, 100.0) / 99.0 * 0.76, alpha, glow);
  }
  x -= 7000.0;
  if (x < 1000.0) {
    float side = floor(x / 500.0) < 0.5 ? -1.0 : 1.0;
    float q = mod(x, 500.0) / 499.0;
    alpha = 0.72;
    glow = 0.86;
    return vec3(-20.4 - 2.8 * q + 1.2 * sin(q * PI), side * (32.375 + 1.9 * sin(q * PI * 0.7)), 6.8 + 4.9 * q);
  }
  x -= 1000.0;
  if (x < 6200.0) {
    float side = floor(x / 3100.0) < 0.5 ? -1.0 : 1.0;
    return a350Engine(mod(x, 3100.0), -2.1, side * 18.7, 2.65, alpha, glow);
  }
  x -= 6200.0;
  if (x < 8500.0) {
    float side = floor(x / 4250.0) < 0.5 ? -1.0 : 1.0;
    float local = mod(x, 4250.0);
    if (local < 4050.0) {
      float u = mod(local, 135.0) / 134.0;
      float v = mod(floor(local / 135.0), 30.0) / 29.0;
      return a350HTail(side, u, v, alpha, glow);
    }
    float edge = floor((local - 4050.0) / 100.0);
    return a350HTail(side, mod(local - 4050.0, 100.0) / 99.0, edge, alpha, glow);
  }
  x -= 8500.0;
  if (x < 7200.0) {
    if (x < 5200.0) {
      float h = mod(x, 130.0) / 129.0;
      float v = mod(floor(x / 130.0), 40.0) / 39.0;
      float z = 8.8 + h * 12.2;
      float xLE = mix(-22.2, -29.8, h);
      float xTE = mix(-34.4, -35.8, h);
      alpha = 0.48 + 0.20 * h;
      glow = 0.60 + 0.18 * h;
      return vec3(mix(xLE, xTE, v), 0.10 * sin(x * 1.5 + uTime), z);
    }
    float local = x - 5200.0;
    float seg = floor(local / 100.0);
    float q = mod(local, 100.0);
    if (seg < 0.5) return refLine(q, 100.0, vec3(-22.2, 0.0, 8.8), vec3(-29.8, 0.0, 21.0), alpha, glow);
    if (seg < 1.5) return refLine(q, 100.0, vec3(-34.4, 0.0, 8.8), vec3(-35.8, 0.0, 21.0), alpha, glow);
    float h = min(0.96, 0.14 + floor((seg - 2.0) / 3.0) * 0.17);
    float z = 8.8 + h * 12.2;
    float xLE = mix(-22.2, -29.8, h);
    float xTE = mix(-34.4, -35.8, h);
    float which = mod(seg - 2.0, 3.0);
    if (which < 0.5) return refLine(q, 100.0, vec3(xLE, 0.0, z), vec3(xTE, 0.0, z), alpha, glow);
    if (which < 1.5) return refLine(q, 100.0, vec3(xLE, 0.0, z), vec3(-34.4, 0.0, 8.8), alpha, glow);
    return refLine(q, 100.0, vec3(xTE, 0.0, z), vec3(-22.2, 0.0, 8.8), alpha, glow);
  }
  x -= 7200.0;
  if (x < 900.0) {
    float gear = floor(x / 100.0);
    float local = mod(x, 100.0);
    float gx = gear < 0.5 ? 24.5 : -6.0 - mod(gear, 4.0) * 1.8;
    float gy = gear < 0.5 ? 0.0 : (floor((gear - 1.0) / 4.0) < 0.5 ? -4.1 : 4.1);
    if (local < 34.0) return refLine(local, 34.0, vec3(gx, gy, 4.1), vec3(gx, gy, 0.5), alpha, glow);
    return refWheel(local - 34.0, gx, gy, 0.46, 0.52, alpha, glow);
  }
  x -= 900.0;
  if (x < 6000.0) {
    float seg = floor(x / 500.0);
    float q = mod(x, 500.0);
    if (seg < 0.5) return refLine(q, 500.0, vec3(-33.4, 0.0, 5.65), vec3(33.4, 0.0, 5.65), alpha, glow);
    if (seg < 1.5) return refLine(q, 500.0, vec3(-4.5, -32.375, 5.2), vec3(-4.5, 32.375, 5.2), alpha, glow);
    if (seg < 7.5) {
      float side = seg < 4.5 ? -1.0 : 1.0;
      float lane = mod(seg - 2.0, 3.0);
      return a350Wing(side, q / 499.0, 0.25 + lane * 0.24, alpha, glow);
    }
    float lx = mix(27.5, -29.0, q / 499.0);
    float f = a350F(lx);
    alpha = 0.30;
    glow = 0.40;
    return vec3(lx, 0.0, 5.65 + (seg - 7.0) * 0.14 + 3.2 * f);
  }
  alpha = 0.0;
  glow = 0.0;
  return vec3(0.0);
}

vec3 a380AeroSample(float raw, out float alpha, out float glow) {
  float x = raw;
  if (x < 72000.0) {
    vec3 p = referenceA380Sample(x * 1.2456667, alpha, glow);
    alpha *= 0.86;
    glow *= 0.92;
    return p;
  }
  x -= 72000.0;
  if (x < 6500.0) {
    float side = floor(x / 3250.0) < 0.5 ? -1.0 : 1.0;
    float local = mod(x, 3250.0);
    float lane = floor(local / 650.0);
    float q = mod(local, 650.0) / 649.0;
    float u = q;
    float v = 0.10 + lane * 0.18 + 0.04 * sin(q * TAU * 2.0 + uTime * 0.6);
    vec3 p = refWing(side, u, v, alpha, glow);
    p.z += 1.25 + lane * 0.18 + 0.22 * sin(q * TAU * 3.0 + uTime);
    alpha = 0.20 + 0.16 * (1.0 - abs(lane - 2.0) / 2.0);
    glow = 0.56;
    return p;
  }
  x -= 6500.0;
  if (x < 5200.0) {
    float engine = floor(x / 1300.0);
    float side = engine < 2.0 ? -1.0 : 1.0;
    float outer = mod(engine, 2.0);
    float q = mod(x, 1300.0) / 1299.0;
    float cx = outer < 0.5 ? -1.5 : -5.2;
    float cy = side * (outer < 0.5 ? 12.8 : 25.2);
    float cz = outer < 0.5 ? 2.9 : 2.45;
    float c = q * TAU * 7.0 + uTime * 2.4;
    float r = 0.28 + q * 4.6;
    alpha = 0.26 + uBass * 0.14 * uReactivity;
    glow = 0.78;
    return vec3(cx + 3.4 + q * 18.0, cy + sin(c) * r, cz + cos(c) * r * 0.65);
  }
  x -= 5200.0;
  if (x < 3200.0) {
    float side = floor(x / 1600.0) < 0.5 ? -1.0 : 1.0;
    float q = mod(x, 1600.0) / 1599.0;
    float c = q * TAU * 8.0 + uTime * 1.2;
    alpha = 0.24 + 0.22 * (1.0 - q);
    glow = 0.72;
    return vec3(-15.4 - q * 20.0, side * (39.875 + q * 8.0 + sin(c) * (2.4 - q)), 7.1 + cos(c) * (1.5 - q * 0.6) + q * 2.4);
  }
  x -= 3200.0;
  if (x < 3300.0) {
    float seg = floor(x / 550.0);
    float q = mod(x, 550.0);
    if (seg < 0.5) return refLine(q, 550.0, vec3(-36.365, 0.0, 5.8), vec3(36.365, 0.0, 5.8), alpha, glow);
    if (seg < 1.5) return refLine(q, 550.0, vec3(-7.0, -39.875, 6.9), vec3(-7.0, 39.875, 6.9), alpha, glow);
    float side = seg < 3.5 ? -1.0 : 1.0;
    float lane = mod(seg - 2.0, 2.0);
    vec3 a = vec3(8.0 - lane * 12.0, side * 4.6, 6.2);
    vec3 b = vec3(-14.5 - lane * 5.0, side * 39.875, 8.2 + lane * 0.7);
    return refLine(q, 550.0, a, b, alpha, glow);
  }
  alpha = 0.0;
  glow = 0.0;
  return vec3(0.0);
}

vec3 a380StructuralSample(float raw, out float alpha, out float glow) {
  float x = raw;
  if (x < 24000.0) {
    vec3 p = referenceA380Sample(x * 3.737, alpha, glow);
    alpha *= 0.54;
    glow *= 0.78;
    return p;
  }
  x -= 24000.0;
  if (x < 16000.0) {
    float station = floor(x / 200.0);
    float c = mod(x, 200.0) / 199.0 * TAU;
    float lx = -35.7 + 71.4 * (station / 79.0);
    float f = refF(lx);
    alpha = 0.38 + 0.22 * smoothstep(0.88, 1.0, abs(cos(c)));
    glow = 0.56;
    return vec3(lx, 3.75 * f * sin(c), 5.8 + 4.35 * f * cos(c));
  }
  x -= 16000.0;
  if (x < 10000.0) {
    float rail = floor(x / 500.0);
    float q = mod(x, 500.0) / 499.0;
    float lx = mix(35.0, -35.0, q);
    float f = refF(lx);
    float c = rail / 20.0 * TAU;
    alpha = 0.34;
    glow = 0.46;
    return vec3(lx, 3.70 * f * sin(c), 5.8 + 4.25 * f * cos(c));
  }
  x -= 10000.0;
  if (x < 16000.0) {
    float side = floor(x / 8000.0) < 0.5 ? -1.0 : 1.0;
    float local = mod(x, 8000.0);
    if (local < 5000.0) {
      float rib = floor(local / 250.0);
      float q = mod(local, 250.0) / 249.0;
      float u = 0.04 + rib / 20.0 * 0.94;
      vec3 p = refWing(side, u, q, alpha, glow);
      alpha = 0.48 + 0.18 * (1.0 - u);
      glow = 0.58;
      return p;
    }
    float spar = floor((local - 5000.0) / 750.0);
    float q = mod(local - 5000.0, 750.0) / 749.0;
    float v = spar < 0.5 ? 0.18 : spar < 1.5 ? 0.42 : spar < 2.5 ? 0.67 : 0.86;
    vec3 p = refWing(side, q, v, alpha, glow);
    alpha = 0.54;
    glow = 0.64;
    return p;
  }
  x -= 16000.0;
  if (x < 7000.0) {
    float deck = floor(x / 1750.0);
    float local = mod(x, 1750.0);
    float beam = floor(local / 70.0);
    float q = mod(local, 70.0) / 69.0;
    float lx = mix(31.0, -32.0, beam / 24.0);
    float f = refF(lx);
    float z = deck < 0.5 ? 4.05 : deck < 1.5 ? 5.9 : deck < 2.5 ? 8.1 : 9.0;
    alpha = 0.36 + 0.12 * deck;
    glow = 0.50;
    return vec3(lx, mix(-3.1 * f, 3.1 * f, q), z);
  }
  x -= 7000.0;
  if (x < 7000.0) {
    if (x < 3600.0) {
      float h = mod(x, 120.0) / 119.0;
      float v = mod(floor(x / 120.0), 30.0) / 29.0;
      float z = 9.1 + h * 15.4;
      float xLE = mix(-23.7, -32.8, h);
      float xTE = mix(-36.2, -38.0, h);
      alpha = 0.48 + 0.18 * h;
      glow = 0.68;
      return vec3(mix(xLE, xTE, v), 0.09 * sin(x * 1.7 + uTime), z);
    }
    float local = x - 3600.0;
    float seg = floor(local / 100.0);
    float q = mod(local, 100.0);
    float h = min(0.96, 0.10 + floor(seg / 3.0) * 0.15);
    float z = 9.1 + h * 15.4;
    float xLE = mix(-23.7, -32.8, h);
    float xTE = mix(-36.2, -38.0, h);
    float which = mod(seg, 3.0);
    if (which < 0.5) return refLine(q, 100.0, vec3(xLE, 0.0, z), vec3(xTE, 0.0, z), alpha, glow);
    if (which < 1.5) return refLine(q, 100.0, vec3(xLE, 0.0, z), vec3(-36.2, 0.0, 9.1), alpha, glow);
    return refLine(q, 100.0, vec3(xTE, 0.0, z), vec3(-23.7, 0.0, 9.1), alpha, glow);
  }
  x -= 7000.0;
  if (x < 8000.0) {
    float seg = floor(x / 500.0);
    float q = mod(x, 500.0);
    if (seg < 4.0) {
      float side = seg < 2.0 ? -1.0 : 1.0;
      float inner = mod(seg, 2.0);
      vec3 a = vec3(inner < 0.5 ? 7.2 : -4.0, side * 3.9, 5.2);
      vec3 b = vec3(inner < 0.5 ? -12.0 : -22.0, side * (inner < 0.5 ? 18.0 : 30.0), 4.6);
      return refLine(q, 500.0, a, b, alpha, glow);
    }
    if (seg < 8.0) {
      float side = seg < 6.0 ? -1.0 : 1.0;
      float lx = -7.0 - mod(seg, 2.0) * 2.2;
      return refLine(q, 500.0, vec3(lx, side * 2.6, 5.2), vec3(lx, side * 2.6, 0.4), alpha, glow);
    }
    float side = seg < 12.0 ? -1.0 : 1.0;
    float local = mod(seg, 4.0);
    vec3 a = vec3(-20.0 + local * 3.2, side * 4.2, 3.8);
    vec3 b = vec3(-6.0 + local * 1.2, side * 16.0, 5.8);
    return refLine(q, 500.0, a, b, alpha, glow);
  }
  alpha = 0.0;
  glow = 0.0;
  return vec3(0.0);
}

vec3 sampleAircraft(float raw, out float alpha, out float glow) {
  if (isReferenceA380Profile()) return referenceA380Sample(raw, alpha, glow);
  if (isA350Profile()) return a350Sample(raw, alpha, glow);
  if (isStructuralProfile()) return a380StructuralSample(raw, alpha, glow);
  if (isGeneralA380Profile()) return a380AeroSample(raw, alpha, glow);
  if (isWingBoxProfile()) return wingBoxSample(raw, alpha, glow);
  float x = raw;
  if (x < S_FUSELAGE) return fuselageSample(x, alpha, glow);
  x -= S_FUSELAGE;
  if (x < S_OUTLINE) return outlineSample(x, alpha, glow);
  x -= S_OUTLINE;
  if (x < S_NOSE) return noseSample(x, alpha, glow);
  x -= S_NOSE;
  if (x < S_COCKPIT) return cockpitSample(x, alpha, glow);
  x -= S_COCKPIT;
  if (x < S_WINDOWS) return windowSample(x, alpha, glow);
  x -= S_WINDOWS;
  if (x < S_DOORS) return doorSample(x, alpha, glow);
  x -= S_DOORS;
  if (x < S_WINGS) return wingSurfaceSample(x, alpha, glow);
  x -= S_WINGS;
  if (x < S_WING_DETAIL) return wingDetailSample(x, alpha, glow);
  x -= S_WING_DETAIL;
  if (x < S_SHARKLETS) return sharkletSample(x, alpha, glow);
  x -= S_SHARKLETS;
  if (x < S_ENGINES) return engineSample(x, alpha, glow);
  x -= S_ENGINES;
  if (x < S_TAILPLANE) return tailplaneSurfaceSample(x, alpha, glow);
  x -= S_TAILPLANE;
  if (x < S_TAIL_DETAIL) return tailplaneDetailSample(x, alpha, glow);
  x -= S_TAIL_DETAIL;
  if (x < S_VERTICAL) return verticalSample(x, alpha, glow);
  x -= S_VERTICAL;
  if (x < S_VERTICAL_DETAIL) return verticalDetailSample(x, alpha, glow);
  x -= S_VERTICAL_DETAIL;
  if (x < S_AFT) return aftSample(x, alpha, glow);
  x -= S_AFT;
  if (x < S_PANELS) return panelSample(x, alpha, glow);
  alpha = 0.0;
  glow = 0.0;
  return vec3(0.0);
}

void main() {
  float alpha = 0.0;
  float glow = 0.0;
  vec3 model = sampleAircraft(aIndex, alpha, glow);
  vec2 p;
  float scale = 190.0;
  if (isReferenceA380Profile()) {
    float shimmer = sin(model.x * 0.9 + uTime + aIndex * 0.007) * 0.5 + 0.5;
    model.z += shimmer * uMid * 0.10 * uReactivity;
    model.y += sin(model.x * 0.14 + uTime * 0.35) * uBass * 0.05 * uReactivity;
    p = projectReferenceA380(model.x, model.y, model.z);
    scale = 200.0;
  } else if (isA350Profile()) {
    float shimmer = sin(model.x * 0.82 + uTime + aIndex * 0.006) * 0.5 + 0.5;
    model.z += shimmer * uMid * 0.12 * uReactivity;
    model.y += sin(model.x * 0.18 + uTime * 0.32) * uBass * 0.055 * uReactivity;
    p = projectAircraftIso(model.x, model.y, model.z, 4.18, 248.0, -0.47 + 0.035 * sin(uTime / 2.4), 245.0, 0.205);
    scale = 200.0;
  } else if (isGeneralA380Profile()) {
    float shimmer = sin(model.x * 0.74 + uTime * 0.8 + aIndex * 0.005) * 0.5 + 0.5;
    model.z += shimmer * uMid * 0.14 * uReactivity;
    model.y += sin(model.x * 0.12 + uTime * 0.32) * uBass * 0.06 * uReactivity;
    p = projectAircraftIso(model.x, model.y, model.z, 3.86, 252.0, -0.42 + 0.04 * sin(uTime / 2.2), 265.0, 0.215);
    scale = 200.0;
  } else if (isStructuralProfile()) {
    float shimmer = sin(model.x * 1.1 + uTime * 0.35 + aIndex * 0.011) * 0.5 + 0.5;
    model.z += shimmer * uMid * 0.08 * uReactivity;
    model.y += sin(model.x * 0.16 + uTime * 0.24) * uBass * 0.035 * uReactivity;
    p = projectAircraftIso(model.x, model.y, model.z, 3.78, 250.0, -0.50 + 0.03 * sin(uTime / 2.8), 265.0, 0.215);
    scale = 200.0;
  } else if (isWingBoxProfile()) {
    float shimmer = sin(model.x * 0.12 - uTime * 0.8 + aIndex * 0.013) * 0.55 + 0.45;
    model.z += shimmer * uMid * 0.18 * uReactivity;
    model.y += sin(model.x * 0.045 + uTime * 0.4) * uBass * 0.11 * uReactivity;
    p = projectAircraftIso(model.x, model.y, model.z, 1.36, 232.0, -0.62 + 0.025 * sin(uTime / 3.0), 520.0, 0.175);
    scale = 200.0;
  } else {
    model = applyProfile(model);
    float shimmer = sin(model.x / 21.0 - uTime + aIndex * 0.013) * 0.55 + 0.45;
    model.z += shimmer * uMid * 0.55 * uReactivity * (isStructuralProfile() ? 0.45 : 1.0);
    model.y += sin(model.x * 0.045 + uTime * 0.4) * uBass * 0.32 * uReactivity * (isWingBoxProfile() ? 0.35 : 1.0);
    p = projectAirframe(model.x, model.y, model.z);
    p = rotate2(p, (isWingBoxProfile() ? 0.05 : -0.02) + sin(uTime * 0.08) * 0.015);
    scale = isA380Profile() ? 226.0 : isWingBoxProfile() ? 205.0 : 190.0;
  }
  gl_Position = vec4(p / scale, 0.0, 1.0);

  float grain = hash(aIndex * 3.17);
  float audioGlow = uBrilliance * 0.28 + uFlux * 0.18 + uBeatPulse * 0.16;
  gl_PointSize = (1.15 + glow * 0.9 + grain * 0.22 + uRms * 0.8 + audioGlow * uReactivity) * 1.32;

  vec3 blueprint = isReferenceA380Profile() ? vec3(0.52, 0.84, 1.0) : isA350Profile() ? vec3(0.58, 0.92, 1.0) : isStructuralProfile() ? vec3(0.68, 0.86, 1.0) : isWingBoxProfile() ? vec3(0.36, 0.86, 1.0) : vec3(0.50, 0.80, 1.0);
  vec3 white = vec3(1.16, 1.18, 1.12);
  vec3 low = isReferenceA380Profile() ? vec3(0.09, 0.13, 0.15) : isA350Profile() ? vec3(0.08, 0.15, 0.17) : isWingBoxProfile() ? vec3(0.08, 0.16, 0.18) : vec3(0.11, 0.16, 0.20);
  float ink = alpha + glow * 0.28 + audioGlow * uReactivity;
  vec3 col = mix(low, blueprint, clamp(ink * 1.2, 0.0, 1.0));
  col = mix(col, white, clamp(glow * 0.62 + uBeatPulse * 0.10, 0.0, 1.0));

  vColor = col;
  vAlpha = clamp(alpha * (0.82 + uRms * 0.45) + glow * 0.12 + audioGlow * 0.16 * uReactivity, 0.0, 1.0);
  vGlow = glow;
}

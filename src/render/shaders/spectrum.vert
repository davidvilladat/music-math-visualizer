uniform float uHeightScale;
// per-instance: x=barIndex(0..N-1), y=normalizedEnergy(0..1)
attribute vec2 instanceData;

varying float vEnergy;
varying float vBarIndex;

void main() {
  vEnergy = instanceData.y;
  vBarIndex = instanceData.x;

  // scale Y by energy, keep base at bottom
  vec3 pos = position;
  pos.y = pos.y * instanceData.y * uHeightScale + (instanceData.y * uHeightScale - 1.0);

  // distribute bars across [-1, 1] in X
  float totalBars = 128.0;
  float barWidth = 2.0 / totalBars;
  float xCenter = (instanceData.x / (totalBars - 1.0)) * 2.0 - 1.0;
  pos.x = pos.x * barWidth * 0.85 + xCenter;

  gl_Position = vec4(pos, 1.0);
}

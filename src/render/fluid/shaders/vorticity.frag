precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 texelSize;
uniform float curlStrength;
uniform float dt;

void main() {
  float L = texture2D(uCurl, vUv - vec2(texelSize.x, 0.0)).x;
  float R = texture2D(uCurl, vUv + vec2(texelSize.x, 0.0)).x;
  float B = texture2D(uCurl, vUv - vec2(0.0, texelSize.y)).x;
  float T = texture2D(uCurl, vUv + vec2(0.0, texelSize.y)).x;
  float C = texture2D(uCurl, vUv).x;

  // normalized gradient of |curl| points toward regions of higher vorticity
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curlStrength * C;
  force.y *= -1.0; // screen-space flip

  vec2 vel = texture2D(uVelocity, vUv).xy;
  vel += force * dt;
  vel = clamp(vel, -1000.0, 1000.0);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}

// Interpolation shader for fractional sampling
// Linearly interpolates between previous and current climate textures
precision highp float;

uniform sampler2D previousTex;
uniform sampler2D currentTex;
uniform float interpolationFactor; // [0, 1] - 0 = previous, 1 = current

varying vec2 vUv;

void main() {
  vec4 previous = texture2D(previousTex, vUv);
  vec4 current = texture2D(currentTex, vUv);
  gl_FragColor = mix(previous, current, interpolationFactor);
}

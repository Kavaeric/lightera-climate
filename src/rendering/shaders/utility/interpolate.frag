// Interpolation shader for fractional sampling
// Linearly interpolates between previous and current climate textures
precision highp float;

uniform sampler2D previousTex;
uniform sampler2D currentTex;
uniform float interpolationFactor; // [0, 1] - 0 = previous, 1 = current

in vec2 vUv;

out vec4 fragColour;

void main() {
  vec4 previous = texture(previousTex, vUv);
  vec4 current = texture(currentTex, vUv);
  fragColour = mix(previous, current, interpolationFactor);
}

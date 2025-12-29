// Simple copy shader for initialising render targets
precision highp float;

uniform sampler2D sourceTex;
in vec2 vUv;

out vec4 fragColour;

void main() {
  fragColour = texture(sourceTex, vUv);
}

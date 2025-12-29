// Fragment shader for latitude/longitude grid lines
// Reduces opacity for back-facing segments

precision highp float;

uniform vec3 colour;
uniform float opacity;
uniform float backFaceOpacity;

in vec3 vWorldPosition;
in vec3 vViewDirection;

out vec4 fragColour;

void main() {
  // For a sphere centred at origin, the normal is the normalised position
  vec3 normal = normalize(vWorldPosition);

  // Calculate dot product of view direction and normal
  // Negative means back-facing
  float facing = dot(vViewDirection, normal);

  // Use full opacity for front-facing, reduced opacity for back-facing
  float finalOpacity = facing > 0.0 ? opacity : opacity * backFaceOpacity;

  fragColour = vec4(colour, finalOpacity);
}

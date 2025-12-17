// Fragment shader for latitude/longitude grid lines
// Reduces opacity for back-facing segments

uniform vec3 colour;
uniform float opacity;
uniform float backFaceOpacity;

varying vec3 vWorldPosition;
varying vec3 vViewDirection;

void main() {
  // For a sphere centred at origin, the normal is the normalised position
  vec3 normal = normalize(vWorldPosition);
  
  // Calculate dot product of view direction and normal
  // Negative means back-facing
  float facing = dot(vViewDirection, normal);
  
  // Use full opacity for front-facing, reduced opacity for back-facing
  float finalOpacity = facing > 0.0 ? opacity : opacity * backFaceOpacity;
  
  gl_FragColor = vec4(colour, finalOpacity);
}


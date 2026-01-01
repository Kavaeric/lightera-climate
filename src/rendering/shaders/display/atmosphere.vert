// Atmosphere vertex shader
// Simple pass-through for sphere geometry

uniform float radius;
uniform float atmosphereHeight;

out vec2 vUv;
out vec3 vWorldPosition;
out float vFacing;
out float vFresnel;

void main() {
  vUv = uv;
  // Scale position outward by atmosphere height
  // position is already at radius distance, so scale by (1.0 + atmosphereHeight/radius)
  vec3 scaledPosition = position * (1.0 + atmosphereHeight / radius);
  
  // Calculate fresnel: surface normal (normalised position) vs view direction
  vec3 normal = normalize(scaledPosition);
  vec3 viewDir = normalize(cameraPosition - scaledPosition);
  vFacing = dot(normal, viewDir);
  vFresnel = 1.0 - vFacing;

  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(scaledPosition, 1.0);
}

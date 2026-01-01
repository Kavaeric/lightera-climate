// Highlight overlay vertex shader
// Passes cell UV coordinates to fragment shader for hit detection
// Calculates view direction for backface fading effect

out vec2 vUv;
out float vFacing;
out float vFresnel;
out vec3 vWorldPosition;
out vec3 vViewDirection;

void main() {
  vUv = uv;

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  // Calculate fresnel: surface normal (normalised position) vs view direction
  vec3 normal = normalize(worldPosition.xyz);
  vec3 viewDir = normalize(cameraPosition - worldPosition.xyz);
  vFacing = dot(normal, viewDir);
  vFresnel = 1.0 - vFacing;

  // Calculate view direction for backface detection
  vViewDirection = normalize(cameraPosition - worldPosition.xyz);

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}

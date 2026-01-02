// Cell highlight vertex shader
// Calculates world position and camera facing for Fresnel effect

out vec3 vWorldPosition;
out float vIsFacingCamera;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  // Calculate if facing camera
  vec3 normal = normalize(worldPosition.xyz);
  vec3 viewDir = normalize(cameraPosition - worldPosition.xyz);
  float facing = dot(normal, viewDir);
  vIsFacingCamera = step(0.0, facing);

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}

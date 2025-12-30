// Vertex shader for latitude/longitude grid lines
// Calculates view direction and position for back-face detection
// Note: cameraPosition is automatically provided by Three.js

out vec3 vWorldPosition;
out vec3 vViewDirection;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  // Calculate view direction in world space (from vertex to camera)
  // cameraPosition is a built-in uniform provided by Three.js
  vViewDirection = normalize(cameraPosition - worldPosition.xyz);

  vec4 offset = vec4(0.0, 0.0, 0.0, 0.0);

  gl_Position = projectionMatrix * viewMatrix * worldPosition + offset;
}

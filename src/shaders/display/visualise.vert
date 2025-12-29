// Display vertex shader - maps geodesic mesh to screen
// Maps UVs to texture coordinates for sampling cell data

out vec2 vUv;
out vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

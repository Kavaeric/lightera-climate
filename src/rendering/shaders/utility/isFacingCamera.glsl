// Calculate whether a point on a sphere is facing the camera
// Returns 1.0 if facing camera, 0.0 if facing away
// worldPosition: the world-space position of the fragment
// cameraPos: the world-space camera position
float isFacingCamera(vec3 worldPosition, vec3 cameraPos) {
  vec3 normal = normalize(worldPosition);
  vec3 viewDir = normalize(cameraPos - worldPosition);
  return step(0.0, dot(normal, viewDir));
}

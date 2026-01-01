// XRayMeshLine vertex shader
// Custom MeshLineMaterial variant that calculates view direction for backface fading
// Used with Three.js shader chunks for fog, depth, and clipping support
// Probably to be deprecated in favour of a custom implementation of a thick line material/shader

#include <common>
#include <logdepthbuf_pars_vertex>
#include <fog_pars_vertex>
#include <clipping_planes_pars_vertex>

attribute vec3 previous;
attribute vec3 next;
attribute float side;
attribute float width;
attribute float counters;

uniform vec2 resolution;
uniform float lineWidth;
uniform vec3 color;
uniform float opacity;
uniform float sizeAttenuation;

varying vec2 vUV;
varying vec4 vColor;
varying float vCounters;
varying float vIsFacingCamera;

// Calculate whether a point on an origin-centered sphere is facing the camera
// Returns 1.0 if facing camera, 0.0 if facing away
float isFacingCamera(vec3 worldPosition, vec3 cameraPos) {
  vec3 normal = normalize(worldPosition);
  vec3 viewDir = normalize(cameraPos - worldPosition);
  return step(0.0, dot(normal, viewDir));
}

vec2 fix(vec4 i, float aspect) {
  vec2 res = i.xy / i.w;
  res.x *= aspect;
  return res;
}

void main() {
  float aspect = resolution.x / resolution.y;
  vColor = vec4(color, opacity);
  vUV = uv;
  vCounters = counters;

  // Calculate world position and facing for backface detection
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vIsFacingCamera = isFacingCamera(worldPosition.xyz, cameraPosition);

  mat4 m = projectionMatrix * modelViewMatrix;
  vec4 finalPosition = m * vec4(position, 1.0) * aspect;
  vec4 prevPos = m * vec4(previous, 1.0);
  vec4 nextPos = m * vec4(next, 1.0);

  vec2 currentP = fix(finalPosition, aspect);
  vec2 prevP = fix(prevPos, aspect);
  vec2 nextP = fix(nextPos, aspect);

  float w = lineWidth * width;

  vec2 dir;
  if (nextP == currentP) dir = normalize(currentP - prevP);
  else if (prevP == currentP) dir = normalize(nextP - currentP);
  else {
    vec2 dir1 = normalize(currentP - prevP);
    vec2 dir2 = normalize(nextP - currentP);
    dir = normalize(dir1 + dir2);
  }

  vec4 normal = vec4(-dir.y, dir.x, 0., 1.);
  normal.xy *= .5 * w;
  if (sizeAttenuation == 0.) {
    normal.xy *= finalPosition.w;
    normal.xy /= (vec4(resolution, 0., 1.) * projectionMatrix).xy * aspect;
  }

  finalPosition.xy += normal.xy * side;
  gl_Position = finalPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  #include <clipping_planes_vertex>
  #include <fog_vertex>
}

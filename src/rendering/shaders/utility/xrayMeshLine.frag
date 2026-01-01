// XRayMeshLine fragment shader
// Reduces opacity for fragments on the backfacing side of a sphere
// Produces x-ray effect where backfacing portions are faded but still visible
// Probably to be deprecated in favour of a custom implementation of a thick line material/shader

#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

uniform sampler2D map;
uniform sampler2D alphaMap;
uniform float useGradient;
uniform float useMap;
uniform float useAlphaMap;
uniform float useDash;
uniform float dashArray;
uniform float dashOffset;
uniform float dashRatio;
uniform float visibility;
uniform float alphaTest;
uniform vec2 repeat;
uniform vec3 gradient[2];

// X-ray uniform
uniform float backfacingOpacity;

varying vec2 vUV;
varying vec4 vColor;
varying float vCounters;
varying float vIsFacingCamera;

void main() {
  #include <logdepthbuf_fragment>
  vec4 diffuseColor = vColor;
  if (useGradient == 1.) diffuseColor = vec4(mix(gradient[0], gradient[1], vCounters), 1.0);
  if (useMap == 1.) diffuseColor *= texture2D(map, vUV * repeat);
  if (useAlphaMap == 1.) diffuseColor.a *= texture2D(alphaMap, vUV * repeat).a;
  if (diffuseColor.a < alphaTest) discard;
  if (useDash == 1.) diffuseColor.a *= ceil(mod(vCounters + dashOffset, dashArray) - (dashArray * dashRatio));
  diffuseColor.a *= step(vCounters, visibility);

  // X-ray backface fade: reduce opacity when facing away from camera
  float backfaceFactor = mix(backfacingOpacity, 1.0, vIsFacingCamera);
  diffuseColor.a *= backfaceFactor;

  #include <clipping_planes_fragment>
  gl_FragColor = diffuseColor;
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <COLORSPACE_FRAGMENT>
}

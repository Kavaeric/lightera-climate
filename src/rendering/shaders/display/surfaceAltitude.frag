// Surface altitude visualisation fragment shader
// Shows surface altitude using greyscale colourmap, accounting for water depth and ice thickness.

precision highp float;

#include "../utility/textureAccessors.glsl"

// Elevation range for normalisation
uniform float elevationMin;
uniform float elevationMax;

// Water depth range for normalisation
uniform float waterDepthMin;
uniform float waterDepthMax;

// Ice thickness range for normalisation
uniform float iceThicknessMin;
uniform float iceThicknessMax;

// Colourmap texture (1D texture with greyscale gradient)
uniform sampler2D colourmapTexture;

in vec2 vUv;
in vec3 vNormal;

out vec4 fragColour;

// Colourmap UV mapping constants (for 256 resolution)
// Maps normalised t ∈ [0, 1] to texture UV for gradient region
const float cmapOffset = 0.005859;  // (1 + 0.5) / 256
const float cmapScale = 0.988281;    // (254 - 1) / 256

// Sample colourmap texture at normalised position t
// t < 0: samples underflow colour (first pixel)
// t > 1: samples overflow colour (last pixel)
// t ∈ [0, 1]: samples gradient region
vec3 sampleColourmapTexture(float t) {
  float u;
  if (t < 0.0) {
    u = 0.0;  // Underflow pixel
  } else if (t > 1.0) {
    u = 1.0;  // Overflow pixel
  } else {
    u = cmapOffset + t * cmapScale;  // Gradient region
  }
  return texture(colourmapTexture, vec2(u, 0.5)).rgb;
}

void main() {
  // === Surface altitude ===
  // Sample elevation using accessor
  float surfaceAltitude = getElevation(vUv) + getWaterDepth(vUv) + getIceThickness(vUv);

  // Normalise to [0, 1]
  // Use the elevation scale as reference
  float normalisedSurfaceAltitude = (surfaceAltitude - elevationMin) / (elevationMax - elevationMin);

  // Detect underflow/overflow for fallback colouring
  float isUnderflow = step(normalisedSurfaceAltitude, 0.0 + 1e-6);
  float isOverflow = step(1.0 + 1e-6, normalisedSurfaceAltitude);
  float isNormal = (1.0 - isUnderflow) * (1.0 - isOverflow);

  // Sample colours from texture
  vec3 underflowColour = sampleColourmapTexture(-1.0);  // Forces u=0
  vec3 overflowColour = sampleColourmapTexture(2.0);    // Forces u=1
  vec3 normalColour = sampleColourmapTexture(normalisedSurfaceAltitude);

  // Blend colours based on underflow/overflow flags
  vec3 surfaceAltitudeColour = underflowColour * isUnderflow +
                overflowColour * isOverflow +
                normalColour * isNormal;

  fragColour = vec4(surfaceAltitudeColour, 1.0);
}

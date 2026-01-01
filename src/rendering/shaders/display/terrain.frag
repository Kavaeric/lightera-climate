// Terrain visualisation fragment shader
// Simple true-ish colour view of the planet with elevation, water depth, and ice thickness.

precision highp float;

#include "../utility/textureAccessors.glsl"

// Elevation range for normalisation
uniform float elevationMin;
uniform float elevationMax;

// Water depth range for normalisation
uniform float waterDepthMin;
uniform float waterDepthMax;

// Colourmap textures (1D textures with gradients)
uniform sampler2D elevationColourmapTexture;
uniform sampler2D waterDepthColourmapTexture;
uniform sampler2D iceThicknessColourmapTexture;

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
vec3 sampleColourmapTexture(sampler2D cmapTex, float t) {
  float u;
  if (t < 0.0) {
    u = 0.0;  // Underflow pixel
  } else if (t > 1.0) {
    u = 1.0;  // Overflow pixel
  } else {
    u = cmapOffset + t * cmapScale;  // Gradient region
  }
  return texture(cmapTex, vec2(u, 0.5)).rgb;
}

void main() {
  // === Elevation ===
  // Sample elevation using accessor
  float elevation = getElevation(vUv);

  // Normalise to [0, 1]
  float normalisedElevation = (elevation - elevationMin) / (elevationMax - elevationMin);

  // Detect underflow/overflow for fallback colouring
  float isUnderflow = step(normalisedElevation, 0.0 - 1e-6);
  float isOverflow = step(1.0 + 1e-6, normalisedElevation);
  float isNormal = (1.0 - isUnderflow) * (1.0 - isOverflow);

  // Sample colours from texture
  vec3 underflowColour = sampleColourmapTexture(elevationColourmapTexture, -1.0);  // Forces u=0
  vec3 overflowColour = sampleColourmapTexture(elevationColourmapTexture, 2.0);     // Forces u=1
  vec3 normalElevationColour = sampleColourmapTexture(elevationColourmapTexture, normalisedElevation);

  // Blend elevation colour with underflow/overflow colours
  vec3 elevationColour = underflowColour * isUnderflow +
                overflowColour * isOverflow +
                normalElevationColour * isNormal;

  // === Water depth ===
  // Sample water depth using accessor
  float waterDepth = getWaterDepth(vUv);

  // Normalise to [0, 1]
  float normalisedWaterDepth = (waterDepth - 0.0) / (5000.0 - 0.0);

  // Detect underflow/overflow for fallback colouring
  float isUnderflowWaterDepth = step(normalisedWaterDepth, 0.0 - 1e-6);
  float isOverflowWaterDepth = step(1.0 + 1e-6, normalisedWaterDepth);
  float isNormalWaterDepth = (1.0 - isUnderflowWaterDepth) * (1.0 - isOverflowWaterDepth);

  // Sample colours from texture
  vec3 waterUnderflowColour = sampleColourmapTexture(waterDepthColourmapTexture, -1.0);
  vec3 waterOverflowColour = sampleColourmapTexture(waterDepthColourmapTexture, 2.0);
  vec3 normalWaterDepthColour = sampleColourmapTexture(waterDepthColourmapTexture, normalisedWaterDepth);

  // Blend water depth colour with elevation colour based on water presence
  vec3 waterDepthColour = waterUnderflowColour * isUnderflowWaterDepth +
                waterOverflowColour * isOverflowWaterDepth +
                normalWaterDepthColour * isNormalWaterDepth;

  // Create a mask for water presence
  float hasWater = step(0.01, waterDepth);

  // === Ice thickness ===
  // Sample ice thickness using accessor
  float iceThickness = getIceThickness(vUv);

  // Normalise to [0, 1]
  float normalisedIceThickness = (iceThickness - 0.0) / (5000.0 - 0.0);

  // Detect underflow/overflow for fallback colouring
  float isUnderflowIceThickness = step(normalisedIceThickness, 0.0 - 1e-6);
  float isOverflowIceThickness = step(1.0 + 1e-6, normalisedIceThickness);
  float isNormalIceThickness = (1.0 - isUnderflowIceThickness) * (1.0 - isOverflowIceThickness);

  // Sample colours from texture
  vec3 iceUnderflowColour = sampleColourmapTexture(iceThicknessColourmapTexture, -1.0);
  vec3 iceOverflowColour = sampleColourmapTexture(iceThicknessColourmapTexture, 2.0);
  vec3 normalIceThicknessColour = sampleColourmapTexture(iceThicknessColourmapTexture, normalisedIceThickness);

  // Blend ice thickness colour with elevation colour based on ice presence
  vec3 iceThicknessColour = iceUnderflowColour * isUnderflowIceThickness +
                iceOverflowColour * isOverflowIceThickness +
                normalIceThicknessColour * isNormalIceThickness;

  // Create a mask for ice presence
  float hasIce = step(0.01, iceThickness);

  // Overlay ice and water colours on top of elevation colour
  vec3 colour = mix(mix(elevationColour, waterDepthColour, hasWater), iceThicknessColour, hasIce);

  fragColour = vec4(colour, 1.0);
}

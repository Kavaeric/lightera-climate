// Terrain visualisation fragment shader
// Simple greyscale elevation heightmap for debugging

precision highp float;

#include "../textureAccessors.glsl"

// Elevation range for normalisation
uniform float elevationMin;
uniform float elevationMax;

// Water depth range for normalisation
uniform float waterDepthMin;
uniform float waterDepthMax;

// Ice thickness range for normalisation
uniform float iceThicknessMin;
uniform float iceThicknessMax;

in vec2 vUv;
in vec3 vNormal;

out vec4 fragColour;

// Greyscale colourmap - simple black to white
const vec3 greyscaleColourmap[2] = vec3[](
  vec3(0.0, 0.0, 0.0),   // Black
  vec3(1.0, 1.0, 1.0)    // White
);

const int greyscaleColourmapLength = 2;
const vec3 greyscaleUnderflowColour = vec3(0.0, 0.0, 0.2);
const vec3 greyscaleOverflowColour = vec3(1.0, 1.0, 1.0);

// Colourmap sampling functions
// These should be refactored into a generic function, when I figure out
// how to stop it from complaining about the array sizes

/**
 * Sample colour from greyscale colourmap using normalised value [0, 1]
 */
vec3 sampleGreyscaleColourmap(float t) {
  // Clamp to [0, 1]
  t = clamp(t, 0.0, 1.0);
  
  // Map t to colourmap range
  float segment = t * float(greyscaleColourmapLength - 1);
  int index = int(floor(segment));
  float localT = fract(segment);
  
  // Clamp index to valid range
  if (index >= greyscaleColourmapLength - 1) {
    return greyscaleColourmap[greyscaleColourmapLength - 1];
  }
  if (index < 0) {
    return greyscaleColourmap[0];
  }
  
  // Linear interpolation between adjacent control points
  return mix(greyscaleColourmap[index], greyscaleColourmap[index + 1], localT);
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

  // Sample colour from elevation colourmap or use overflow/underflow colours
  vec3 normalSurfaceAltitudeColour = sampleGreyscaleColourmap(normalisedSurfaceAltitude);

  // Blend elevation colour with underflow/overflow colours
  vec3 surfaceAltitudeColour = greyscaleUnderflowColour * isUnderflow +
                greyscaleOverflowColour * isOverflow +
                normalSurfaceAltitudeColour * isNormal;

  fragColour = vec4(surfaceAltitudeColour, 1.0);
}

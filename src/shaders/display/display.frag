// Unified data display fragment shader
// Visualises any scalar data with configurable colourmap
// Pure data visualisation - highlighting is handled by CellHighlightOverlay

precision highp float;

// Data source texture (surface temperature, elevation, water depth, or salinity)
uniform sampler2D dataTex;

// Value range for normalisation
uniform float valueMin;
uniform float valueMax;

// Which channel to sample from dataTex (0=r, 1=g, 2=b, 3=a)
uniform int dataChannel;

// Colourmap control points (can be 2, 8, or 32 points depending on visualisation)
// Maximum 32 colours supported
uniform vec3 colourmapColors[32];
uniform int colourmapLength;

// Underflow/overflow colours
uniform vec3 underflowColour;
uniform vec3 overflowColour;

varying vec2 vUv;
varying vec3 vNormal;

/**
 * Interpolate colour from colourmap using normalised value [0, 1]
 * Supports variable-length colourmaps with linear interpolation between control points
 */
vec3 sampleColourmap(float t) {
  // Clamp to [0, 1]
  t = clamp(t, 0.0, 1.0);

  // Map t to colourmap range
  float segment = t * float(colourmapLength - 1);
  int index = int(floor(segment));
  float localT = fract(segment);

  // Clamp index to valid range
  if (index >= colourmapLength - 1) {
    return colourmapColors[colourmapLength - 1];
  }
  if (index < 0) {
    return colourmapColors[0];
  }

  // Linear interpolation between adjacent control points
  return mix(colourmapColors[index], colourmapColors[index + 1], localT);
}

void main() {
  // Sample the data value
  vec4 data = texture2D(dataTex, vUv);

  // Select the appropriate channel based on visualisation mode
  float value;
  if (dataChannel == 0) {
    value = data.r;
  } else if (dataChannel == 1) {
    value = data.g;
  } else if (dataChannel == 2) {
    value = data.b;
  } else {
    value = data.a;
  }

  // Normalise to [0, 1]
  float normalised = (value - valueMin) / (valueMax - valueMin);

  // Detect underflow/overflow for fallback colouring
  float isUnderflow = step(normalised, 0.0);
  float isOverflow = step(1.0, normalised);
  float isNormal = (1.0 - isUnderflow) * (1.0 - isOverflow);

  // Sample colour from colourmap or use overflow/underflow colours
  vec3 normalColor = sampleColourmap(normalised);

  vec3 colour = underflowColour * isUnderflow +
                overflowColour * isOverflow +
                normalColor * isNormal;

  gl_FragColor = vec4(colour, 1.0);
}

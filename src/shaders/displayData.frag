// Unified data display fragment shader
// Visualizes any scalar data with configurable colourmap
// Pure data visualization - highlighting is handled by CellHighlightOverlay

precision highp float;

// Data source texture (temperature, elevation, water depth, or salinity)
uniform sampler2D dataTex;

// Value range for normalization
uniform float valueMin;
uniform float valueMax;

// Which channel to sample from dataTex (0=r, 1=g, 2=b, 3=a)
uniform int dataChannel;

// Colourmap control points (can be 2, 8, or 32 points depending on visualization)
// Maximum 32 colors supported
uniform vec3 colourmapColors[32];
uniform int colourmapLength;

// Underflow/overflow colors
uniform vec3 underflowColor;
uniform vec3 overflowColor;

varying vec2 vUv;
varying vec3 vNormal;

/**
 * Interpolate color from colourmap using normalized value [0, 1]
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
    value = data.r;  // Temperature or elevation
  } else if (dataChannel == 1) {
    value = data.g;  // Water depth
  } else if (dataChannel == 2) {
    value = data.b;  // Salinity
  } else {
    value = data.a;  // Albedo
  }

  // Normalize to [0, 1]
  float normalized = (value - valueMin) / (valueMax - valueMin);

  // Detect underflow/overflow for fallback coloring
  float isUnderflow = step(normalized, 0.0);
  float isOverflow = step(1.0, normalized);
  float isNormal = (1.0 - isUnderflow) * (1.0 - isOverflow);

  // Sample color from colourmap or use overflow/underflow colors
  vec3 normalColor = sampleColourmap(normalized);

  vec3 color = underflowColor * isUnderflow +
               overflowColor * isOverflow +
               normalColor * isNormal;

  gl_FragColor = vec4(color, 1.0);
}

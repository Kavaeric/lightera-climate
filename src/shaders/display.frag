// Display fragment shader - visualizes simulation data with Fast colormap
// Samples temperature from state texture and applies color mapping

precision highp float;

uniform sampler2D stateTex;
uniform float valueMin;
uniform float valueMax;
uniform vec3 fastColors[32];
uniform vec3 underflowColor;    // Color for values below range
uniform vec3 overflowColor;     // Color for values above range
uniform float highlightThreshold; // Distance threshold for cell highlighting
uniform float hoveredCellIndex;
uniform float selectedCellIndex;
uniform float textureWidth;
uniform float textureHeight;

varying vec2 vUv;
varying vec3 vNormal;

// Fast colormap interpolation (32 control points)
vec3 fast(float t) {
  t = clamp(t, 0.0, 1.0);

  // Map t to 0-31 range for 32 control points
  float segment = t * 31.0;
  int index = int(floor(segment));
  float localT = fract(segment);

  // Clamp index to valid range
  if (index >= 31) return fastColors[31];
  if (index < 0) return fastColors[0];

  return mix(fastColors[index], fastColors[index + 1], localT);
}

void main() {
  // Sample temperature from state texture
  vec4 state = texture2D(stateTex, vUv);
  float temperature = state.r;

  // Normalize to [0, 1]
  float normalized = (temperature - valueMin) / (valueMax - valueMin);

  // Branchless color selection using step() and mix()
  vec3 normalColor = fast(clamp(normalized, 0.0, 1.0));

  // Use step() to create masks (returns 0.0 or 1.0)
  float isUnderflow = step(normalized, 0.0);
  float isOverflow = step(1.0, normalized);
  float isNormal = (1.0 - isUnderflow) * (1.0 - isOverflow);

  vec3 color = underflowColor * isUnderflow +
               overflowColor * isOverflow +
               normalColor * isNormal;

  // Check if this is the selected cell
  // Calculate expected UV for selected cell with sub-pixel accuracy
  float selectedX = mod(selectedCellIndex, textureWidth);
  float selectedY = floor(selectedCellIndex / textureWidth);
  float selectedU = (selectedX + 0.5) / textureWidth;
  float selectedV = (selectedY + 0.5) / textureHeight;

  // Use Chebyshev distance (max of absolute differences) for tighter bounds
  // More precise than Manhattan distance for cell detection
  float selectedDist = max(abs(vUv.x - selectedU), abs(vUv.y - selectedV));
  float isSelected = step(selectedDist, highlightThreshold) * step(0.0, selectedCellIndex);

  // Apply selected highlight with stronger intensity to overcome z-fighting
  color = mix(color, vec3(1.0, 1.0, 1.0), isSelected * 0.8);

  // Check if this is the hovered cell
  float hoveredX = mod(hoveredCellIndex, textureWidth);
  float hoveredY = floor(hoveredCellIndex / textureWidth);
  float hoveredU = (hoveredX + 0.5) / textureWidth;
  float hoveredV = (hoveredY + 0.5) / textureHeight;

  float hoveredDist = max(abs(vUv.x - hoveredU), abs(vUv.y - hoveredV));
  float isHovered = step(hoveredDist, highlightThreshold) * step(0.0, hoveredCellIndex) * (1.0 - isSelected);

  // Apply hover highlight (white) only if not selected
  color = mix(color, vec3(1.0, 1.0, 1.0), isHovered * 0.3);

  gl_FragColor = vec4(color, 1.0);
}

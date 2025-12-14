// Display fragment shader - visualizes simulation data with Fast colormap
// Samples temperature from state texture and applies color mapping

precision highp float;

uniform sampler2D stateTex;
uniform float valueMin;
uniform float valueMax;
uniform vec3 fastColors[32];
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

  vec3 color;
  if (normalized < 0.0) {
    // Underflow: deep navy blue
    color = vec3(0.0, 0.0, 0.2);
  } else if (normalized > 1.0) {
    // Overflow: bright magenta
    color = vec3(1.0, 0.0, 1.0);
  } else {
    // Normal range: use Fast colormap
    color = fast(normalized);
  }

  // Check if this is the selected cell (higher priority than hover)
  bool isSelected = false;
  if (selectedCellIndex >= 0.0) {
    // Calculate expected UV for selected cell
    float x = mod(selectedCellIndex, textureWidth);
    float y = floor(selectedCellIndex / textureWidth);
    float expectedU = (x + 0.5) / textureWidth;
    float expectedV = (y + 0.5) / textureHeight;

    // Check if current UV matches (with small epsilon for floating point comparison)
    float uvDist = abs(vUv.x - expectedU) + abs(vUv.y - expectedV);
    if (uvDist < 0.001) {
      // Strong yellow highlight for selected cell
      color = mix(color, vec3(1.0, 1.0, 0.0), 0.6);
      isSelected = true;
    }
  }

  // Check if this is the hovered cell (only if not selected)
  if (!isSelected && hoveredCellIndex >= 0.0) {
    // Calculate expected UV for hovered cell
    float x = mod(hoveredCellIndex, textureWidth);
    float y = floor(hoveredCellIndex / textureWidth);
    float expectedU = (x + 0.5) / textureWidth;
    float expectedV = (y + 0.5) / textureHeight;

    // Check if current UV matches (with small epsilon for floating point comparison)
    float uvDist = abs(vUv.x - expectedU) + abs(vUv.y - expectedV);
    if (uvDist < 0.001) {
      // Subtle white highlight for hover
      color = mix(color, vec3(1.0, 1.0, 1.0), 0.4);
    }
  }

  gl_FragColor = vec4(color, 1.0);
}

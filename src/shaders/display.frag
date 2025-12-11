// Display fragment shader - visualizes simulation data with Moreland colormap
// Samples temperature from state texture and applies color mapping

precision highp float;

uniform sampler2D stateTex;
uniform float valueMin;
uniform float valueMax;
uniform vec3 morelandColors[5];
uniform float hoveredCellIndex;
uniform float textureWidth;
uniform float textureHeight;

varying vec2 vUv;
varying vec3 vNormal;

// Moreland colormap interpolation
vec3 moreland(float t) {
  t = clamp(t, 0.0, 1.0);

  float segment = t * 4.0; // 0-4 range for 5 control points
  int index = int(floor(segment));
  float localT = fract(segment);

  if (index >= 4) return morelandColors[4];

  return mix(morelandColors[index], morelandColors[index + 1], localT);
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
    // Normal range: use Moreland colormap
    color = moreland(normalized);
  }

  // Check if this is the hovered cell
  if (hoveredCellIndex >= 0.0) {
    // Calculate expected UV for hovered cell
    float x = mod(hoveredCellIndex, textureWidth);
    float y = floor(hoveredCellIndex / textureWidth);
    float expectedU = (x + 0.5) / textureWidth;
    float expectedV = (y + 0.5) / textureHeight;

    // Check if current UV matches (with small epsilon for floating point comparison)
    float uvDist = abs(vUv.x - expectedU) + abs(vUv.y - expectedV);
    if (uvDist < 0.001) {
      // Brighten and add white outline
      color = mix(color, vec3(1.0, 1.0, 1.0), 0.5);
    }
  }

  gl_FragColor = vec4(color, 1.0);
}

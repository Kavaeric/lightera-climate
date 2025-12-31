// Highlight overlay fragment shader
// Renders colored overlay for selected and hovered cells
// Fades out on backfacing surfaces for x-ray effect

precision highp float;

uniform float highlightThreshold;
uniform float hoveredCellIndex;
uniform float selectedCellIndex;
uniform float textureWidth;
uniform float textureHeight;

in vec2 vUv;
in vec3 vWorldPosition;
in vec3 vViewDirection;

out vec4 fragColour;

void main() {
  // Detect if this fragment is backfacing (for fading effect)
  vec3 normal = normalize(vWorldPosition);
  float facing = dot(vViewDirection, normal);
  float isFrontFacing = step(0.0, facing);

  vec3 color = vec3(0.0);
  float alpha = 0.0;

  // Check if this is the selected cell
  float selectedX = mod(selectedCellIndex, textureWidth);
  float selectedY = floor(selectedCellIndex / textureWidth);
  float selectedU = (selectedX + 0.5) / textureWidth;
  float selectedV = (selectedY + 0.5) / textureHeight;

  float selectedDist = max(abs(vUv.x - selectedU), abs(vUv.y - selectedV));
  float isSelected = step(selectedDist, highlightThreshold) * step(0.0, selectedCellIndex);

  if (isSelected > 0.5) {
    color = vec3(1.0, 1.0, 1.0); // White highlight for selection
    alpha = 0.8 * isFrontFacing + 0.3 * (1.0 - isFrontFacing); // Stronger on front, dimmer on back
    fragColour = vec4(color, alpha);
    return;
  }

  // Check if this is the hovered cell
  float hoveredX = mod(hoveredCellIndex, textureWidth);
  float hoveredY = floor(hoveredCellIndex / textureWidth);
  float hoveredU = (hoveredX + 0.5) / textureWidth;
  float hoveredV = (hoveredY + 0.5) / textureHeight;

  float hoveredDist = max(abs(vUv.x - hoveredU), abs(vUv.y - hoveredV));
  float isHovered = step(hoveredDist, highlightThreshold) * step(0.0, hoveredCellIndex);

  if (isHovered > 0.5) {
    color = vec3(1.0, 1.0, 1.0); // White highlight for hover
    alpha = 0.3; // More subtle than selection
    fragColour = vec4(color, alpha);
    return;
  }

  // No highlight otherwise
  discard;
}

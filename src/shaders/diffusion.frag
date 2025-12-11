// Diffusion simulation shader - runs on GPU via render-to-texture
// Computes heat diffusion across geodesic grid cells

precision highp float;

uniform sampler2D stateTex;
uniform sampler2D neighbourIndices1; // RGB = neighbours 0,1,2
uniform sampler2D neighbourIndices2; // RGB = neighbours 3,4,5
uniform sampler2D neighbourCounts;   // R = count (5 or 6)
uniform float textureWidth;
uniform float diffusionRate;

varying vec2 vUv;

// Convert cell index to UV coordinate
vec2 indexToUV(float index) {
  float u = (index + 0.5) / textureWidth;
  return vec2(u, 0.5);
}

void main() {
  // Read current cell's temperature
  vec4 currentState = texture2D(stateTex, vUv);
  float currentTemp = currentState.r;

  // Read neighbour indices
  vec3 neighbours1 = texture2D(neighbourIndices1, vUv).rgb;
  vec3 neighbours2 = texture2D(neighbourIndices2, vUv).rgb;

  // Branchless neighbour sampling using step()
  // step(a, b) returns 1.0 if b >= a, else 0.0

  float neighbourSum = 0.0;
  float validCount = 0.0;

  // Process all 6 neighbours without branching
  vec3 valid1 = step(0.0, neighbours1); // 1.0 if >= 0, else 0.0
  vec3 valid2 = step(0.0, neighbours2);

  neighbourSum += texture2D(stateTex, indexToUV(neighbours1.r)).r * valid1.r;
  neighbourSum += texture2D(stateTex, indexToUV(neighbours1.g)).r * valid1.g;
  neighbourSum += texture2D(stateTex, indexToUV(neighbours1.b)).r * valid1.b;
  neighbourSum += texture2D(stateTex, indexToUV(neighbours2.r)).r * valid2.r;
  neighbourSum += texture2D(stateTex, indexToUV(neighbours2.g)).r * valid2.g;
  neighbourSum += texture2D(stateTex, indexToUV(neighbours2.b)).r * valid2.b;

  validCount = valid1.r + valid1.g + valid1.b + valid2.r + valid2.g + valid2.b;

  float neighbourAvg = neighbourSum / validCount;

  // Apply diffusion: move toward neighbour average
  float newTemp = currentTemp + (neighbourAvg - currentTemp) * diffusionRate;

  // Output new temperature (R channel)
  gl_FragColor = vec4(newTemp, 0.0, 0.0, 0.0);
}

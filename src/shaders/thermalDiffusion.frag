precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D currentTemperature; // Current temperature field
uniform sampler2D neighbourIndices1;  // Neighbours 0,1,2
uniform sampler2D neighbourIndices2;  // Neighbours 3,4,5
uniform sampler2D neighbourCounts;    // Number of neighbours (5 or 6)

// Simulation parameters
uniform float textureWidth;
uniform float textureHeight;
uniform float diffusionRate;         // 0-1, controls diffusion strength
uniform float cosmicBackgroundTemp;  // Minimum temperature (K)

/**
 * Convert cell index to UV coordinates
 */
vec2 cellIndexToUV(float cellIndex) {
  float x = mod(cellIndex, textureWidth);
  float y = floor(cellIndex / textureWidth);
  return vec2((x + 0.5) / textureWidth, (y + 0.5) / textureHeight);
}

void main() {
  // Read current temperature
  vec4 currentData = texture2D(currentTemperature, vUv);
  float currentTemp = currentData.r;

  // Read neighbor indices
  vec3 neighbors1 = texture2D(neighbourIndices1, vUv).rgb; // neighbors 0,1,2
  vec3 neighbors2 = texture2D(neighbourIndices2, vUv).rgb; // neighbors 3,4,5
  float neighborCount = texture2D(neighbourCounts, vUv).r;

  // Collect neighbor temperatures
  float neighborSum = 0.0;
  float validNeighbors = 0.0;

  // Process first 3 neighbors
  for (int i = 0; i < 3; i++) {
    float neighborIdx = i == 0 ? neighbors1.r : (i == 1 ? neighbors1.g : neighbors1.b);
    float isValid = step(0.0, neighborIdx); // 1.0 if valid, 0.0 if -1

    vec2 neighborUV = cellIndexToUV(neighborIdx);
    float neighborTemp = texture2D(currentTemperature, neighborUV).r;

    neighborSum += neighborTemp * isValid;
    validNeighbors += isValid;
  }

  // Process next 3 neighbors
  for (int i = 0; i < 3; i++) {
    float neighborIdx = i == 0 ? neighbors2.r : (i == 1 ? neighbors2.g : neighbors2.b);
    float isValid = step(0.0, neighborIdx); // 1.0 if valid, 0.0 if -1

    vec2 neighborUV = cellIndexToUV(neighborIdx);
    float neighborTemp = texture2D(currentTemperature, neighborUV).r;

    neighborSum += neighborTemp * isValid;
    validNeighbors += isValid;
  }

  // Calculate average neighbor temperature
  float avgNeighborTemp = neighborSum / max(validNeighbors, 1.0);

  // Apply diffusion: blend toward neighbor average
  // diffusionRate controls how much we blend (0 = no diffusion, 1 = full diffusion)
  float newTemp = mix(currentTemp, avgNeighborTemp, diffusionRate);

  // Enforce minimum temperature (cosmic background)
  newTemp = max(newTemp, cosmicBackgroundTemp);

  // Output: RGBA = [temperature, humidity, pressure, unused]
  // For now, keep humidity and pressure unchanged
  gl_FragColor = vec4(newTemp, currentData.g, currentData.b, currentData.a);
}

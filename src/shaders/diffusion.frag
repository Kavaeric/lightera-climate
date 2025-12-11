// Diffusion simulation shader - runs on GPU via render-to-texture
// Computes heat diffusion across geodesic grid cells

precision highp float;

uniform sampler2D stateTex;
uniform sampler2D neighborIndices1; // RGB = neighbors 0,1,2
uniform sampler2D neighborIndices2; // RGB = neighbors 3,4,5
uniform sampler2D neighborCounts;   // R = count (5 or 6)
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

  // Read neighbor indices
  vec3 neighbors1 = texture2D(neighborIndices1, vUv).rgb;
  vec3 neighbors2 = texture2D(neighborIndices2, vUv).rgb;
  float neighborCount = texture2D(neighborCounts, vUv).r;

  // Sum neighbor temperatures
  float neighborSum = 0.0;
  int validNeighbors = 0;

  // Process first 3 neighbors
  if (neighbors1.r >= 0.0) {
    vec2 uv = indexToUV(neighbors1.r);
    neighborSum += texture2D(stateTex, uv).r;
    validNeighbors++;
  }
  if (neighbors1.g >= 0.0) {
    vec2 uv = indexToUV(neighbors1.g);
    neighborSum += texture2D(stateTex, uv).r;
    validNeighbors++;
  }
  if (neighbors1.b >= 0.0) {
    vec2 uv = indexToUV(neighbors1.b);
    neighborSum += texture2D(stateTex, uv).r;
    validNeighbors++;
  }

  // Process next 3 neighbors
  if (neighbors2.r >= 0.0) {
    vec2 uv = indexToUV(neighbors2.r);
    neighborSum += texture2D(stateTex, uv).r;
    validNeighbors++;
  }
  if (neighbors2.g >= 0.0) {
    vec2 uv = indexToUV(neighbors2.g);
    neighborSum += texture2D(stateTex, uv).r;
    validNeighbors++;
  }
  if (neighbors2.b >= 0.0) {
    vec2 uv = indexToUV(neighbors2.b);
    neighborSum += texture2D(stateTex, uv).r;
    validNeighbors++;
  }

  // Calculate average neighbor temperature
  float neighborAvg = neighborSum / float(validNeighbors);

  // Apply diffusion: move toward neighbor average
  float newTemp = currentTemp + (neighborAvg - currentTemp) * diffusionRate;

  // Output new temperature (R channel)
  gl_FragColor = vec4(newTemp, 0.0, 0.0, 0.0);
}

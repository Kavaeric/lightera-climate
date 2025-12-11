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
  float neighbourCount = texture2D(neighbourCounts, vUv).r;

  // Sum neighbour temperatures
  float neighbourSum = 0.0;
  int validneighbours = 0;

  // Process first 3 neighbours
  if (neighbours1.r >= 0.0) {
    vec2 uv = indexToUV(neighbours1.r);
    neighbourSum += texture2D(stateTex, uv).r;
    validneighbours++;
  }
  if (neighbours1.g >= 0.0) {
    vec2 uv = indexToUV(neighbours1.g);
    neighbourSum += texture2D(stateTex, uv).r;
    validneighbours++;
  }
  if (neighbours1.b >= 0.0) {
    vec2 uv = indexToUV(neighbours1.b);
    neighbourSum += texture2D(stateTex, uv).r;
    validneighbours++;
  }

  // Process next 3 neighbours
  if (neighbours2.r >= 0.0) {
    vec2 uv = indexToUV(neighbours2.r);
    neighbourSum += texture2D(stateTex, uv).r;
    validneighbours++;
  }
  if (neighbours2.g >= 0.0) {
    vec2 uv = indexToUV(neighbours2.g);
    neighbourSum += texture2D(stateTex, uv).r;
    validneighbours++;
  }
  if (neighbours2.b >= 0.0) {
    vec2 uv = indexToUV(neighbours2.b);
    neighbourSum += texture2D(stateTex, uv).r;
    validneighbours++;
  }

  // Calculate average neighbour temperature
  float neighbourAvg = neighbourSum / float(validneighbours);

  // Apply diffusion: move toward neighbour average
  float newTemp = currentTemp + (neighbourAvg - currentTemp) * diffusionRate;

  // Output new temperature (R channel)
  gl_FragColor = vec4(newTemp, 0.0, 0.0, 0.0);
}

precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousTemperature; // Previous timestep temperature
uniform sampler2D cellPositions;       // Cell lat/lon positions
uniform sampler2D neighbourIndices1;   // Neighbours 0,1,2
uniform sampler2D neighbourIndices2;   // Neighbours 3,4,5
uniform sampler2D neighbourCounts;     // Number of neighbours (5 or 6)

// Physical constants
const float STEFAN_BOLTZMANN = 5.670374419e-8; // W/(m²·K⁴)

// Simulation parameters
uniform vec2 subsolarPoint;           // [lat, lon] in degrees
uniform float solarFlux;          // W/m²
uniform float albedo;                 // 0-1
uniform float emissivity;             // 0-1 - thermal emissivity
uniform float surfaceHeatCapacity;    // J/(m²·K)
uniform float dt;                     // timestep in seconds
uniform float textureWidth;
uniform float textureHeight;
uniform float cosmicBackgroundTemp;   // K
uniform float thermalConductivity;    // W/(m·K) - for lateral heat conduction

/**
 * Convert degrees to radians
 */
float deg2rad(float deg) {
  return deg * 3.14159265359 / 180.0;
}

/**
 * Calculate solar flux on a surface element given its lat/lon and subsolar point
 * Returns flux in W/m²
 */
float calculateSolarFlux(float lat, float lon, vec2 subsolar) {
  // Convert to radians
  float lat_rad = deg2rad(lat);
  float lon_rad = deg2rad(lon);
  float subsolar_lat_rad = deg2rad(subsolar.x);
  float subsolar_lon_rad = deg2rad(subsolar.y);

  // Calculate angle between surface normal and sun direction
  // Using spherical dot product: cos(angle) = sin(lat1)*sin(lat2) + cos(lat1)*cos(lat2)*cos(lon2-lon1)
  float cosAngle = sin(lat_rad) * sin(subsolar_lat_rad) +
                   cos(lat_rad) * cos(subsolar_lat_rad) * cos(lon_rad - subsolar_lon_rad);

  // Flux = solarFlux * max(0, cosAngle)
  // If cosAngle < 0, the sun is below the horizon
  float flux = solarFlux * max(0.0, cosAngle);

  return flux;
}

/**
 * Convert cell index to UV coordinates
 */
vec2 cellIndexToUV(float cellIndex) {
  float x = mod(cellIndex, textureWidth);
  float y = floor(cellIndex / textureWidth);
  return vec2((x + 0.5) / textureWidth, (y + 0.5) / textureHeight);
}

void main() {
  // Read previous temperature
  vec4 prevData = texture2D(previousTemperature, vUv);
  float T_old = prevData.r;

  // Read cell position
  vec2 cellLatLon = texture2D(cellPositions, vUv).rg; // [lat, lon] in degrees

  // Calculate incoming solar flux
  float Q_solar = calculateSolarFlux(cellLatLon.x, cellLatLon.y, subsolarPoint);

  // Account for albedo (fraction of light reflected)
  Q_solar = Q_solar * (1.0 - albedo);

  // Calculate outgoing blackbody radiation
  // Q_out = emissivity * σ * T^4
  float Q_radiation = emissivity * STEFAN_BOLTZMANN * pow(T_old, 4.0);

  // Calculate net radiative heating rate
  float dQ_radiation = Q_solar - Q_radiation;

  // Lateral heat conduction (diffusion from neighbors)
  // Read neighbor indices
  vec3 neighbors1 = texture2D(neighbourIndices1, vUv).rgb;
  vec3 neighbors2 = texture2D(neighbourIndices2, vUv).rgb;

  // Collect neighbor temperatures
  float neighborSum = 0.0;
  float validNeighbors = 0.0;

  // Process first 3 neighbors
  for (int i = 0; i < 3; i++) {
    float neighborIdx = i == 0 ? neighbors1.r : (i == 1 ? neighbors1.g : neighbors1.b);
    float isValid = step(0.0, neighborIdx);

    vec2 neighborUV = cellIndexToUV(neighborIdx);
    float neighborTemp = texture2D(previousTemperature, neighborUV).r;

    neighborSum += neighborTemp * isValid;
    validNeighbors += isValid;
  }

  // Process next 3 neighbors
  for (int i = 0; i < 3; i++) {
    float neighborIdx = i == 0 ? neighbors2.r : (i == 1 ? neighbors2.g : neighbors2.b);
    float isValid = step(0.0, neighborIdx);

    vec2 neighborUV = cellIndexToUV(neighborIdx);
    float neighborTemp = texture2D(previousTemperature, neighborUV).r;

    neighborSum += neighborTemp * isValid;
    validNeighbors += isValid;
  }

  // Calculate conductive heat flux (simplified: assume constant thermal conductivity)
  float avgNeighborTemp = neighborSum / max(validNeighbors, 1.0);
  float dQ_conduction = thermalConductivity * (avgNeighborTemp - T_old);

  // Total heating rate (W/m²)
  float dQ_total = dQ_radiation + dQ_conduction;

  // Temperature change: dT/dt = dQ / C
  // Where C is heat capacity per unit area [J/(m²·K)]
  float dT = (dQ_total / surfaceHeatCapacity) * dt;

  // New temperature
  float T_new = T_old + dT;

  // Enforce minimum temperature (cosmic background)
  T_new = max(T_new, cosmicBackgroundTemp);

  // Output: RGBA = [temperature, humidity, pressure, unused]
  gl_FragColor = vec4(T_new, prevData.g, prevData.b, prevData.a);
}

precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousTemperature; // Previous timestep temperature
uniform sampler2D cellPositions;       // Cell lat/lon positions
uniform sampler2D neighbourIndices1;   // Neighbours 0,1,2
uniform sampler2D neighbourIndices2;   // Neighbours 3,4,5
uniform sampler2D neighbourCounts;     // Number of neighbours (5 or 6)
uniform sampler2D terrainData;         // Terrain data [elevation, waterDepth, salinity, baseAlbedo]

// Physical constants
const float STEFAN_BOLTZMANN = 5.670374419e-8; // W/(m²·K⁴)

// Simulation parameters
uniform vec2 baseSubsolarPoint;       // [lat, lon] in degrees - subsolar point at vernal equinox
uniform float axialTilt;              // degrees - planet's axial tilt (0 = no tilt, 23.44 = Earth-like)
uniform float yearProgress;           // 0-1 - current position in orbit (0 = vernal equinox, 0.5 = autumnal)
uniform float solarFlux;              // W/m²
uniform float albedo;                 // 0-1
uniform float emissivity;             // 0-1 - thermal emissivity
uniform float surfaceHeatCapacity;    // J/(m²·K) - heat capacity per unit area
uniform float dt;                     // timestep in seconds
uniform float textureWidth;
uniform float textureHeight;
uniform float cosmicBackgroundTemp;   // K
uniform float thermalConductivity;    // W/(m·K) - for lateral heat conduction
uniform float planetRadius;           // meters - planet's radius for calculating surface area and scaling

/**
 * Convert degrees to radians
 */
float deg2rad(float deg) {
  return deg * 3.14159265359 / 180.0;
}

/**
 * Calculate subsolar point latitude based on orbital position and axial tilt
 *
 * During the year, the subsolar latitude oscillates due to axial tilt:
 * - At vernal/autumnal equinox (yearProgress = 0.0 or 0.5): subsolar_lat = base_lat
 * - At summer solstice (yearProgress = 0.25): subsolar_lat = base_lat + axialTilt
 * - At winter solstice (yearProgress = 0.75): subsolar_lat = base_lat - axialTilt
 */
float calculateSubsolarLatitude(float baseLat, float tilt, float progress) {
  // Convert to radians for sinusoidal motion
  float orbitAngle = progress * 2.0 * 3.14159265359;

  // Sun's latitude oscillates from -tilt to +tilt relative to base latitude
  float tiltedLat = baseLat + tilt * sin(orbitAngle);

  return tiltedLat;
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

  // Read terrain data
  vec4 terrain = texture2D(terrainData, vUv);
  float elevation = terrain.r;        // meters (signed)
  float waterDepth = terrain.g;       // meters (unsigned, 0 = land)
  float salinity = terrain.b;         // PSU (0-50)
  float baseAlbedo = terrain.a;       // 0-1, terrain reflectivity

  // Calculate subsolar point based on orbital position and axial tilt
  float subsolarLat = calculateSubsolarLatitude(baseSubsolarPoint.x, axialTilt, yearProgress);
  vec2 subsolarPoint = vec2(subsolarLat, baseSubsolarPoint.y);

  // Calculate incoming solar flux
  float Q_solar = calculateSolarFlux(cellLatLon.x, cellLatLon.y, subsolarPoint);

  // Account for per-cell albedo (fraction of light reflected)
  // Use terrain base albedo; in future, this will blend with biome-derived albedo
  Q_solar = Q_solar * (1.0 - baseAlbedo);

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

  // Determine effective heat capacity based on water presence
  // Water has much higher heat capacity than rock due to its specific heat (4186 J/kg·K)
  // For a water column: C_water = specificHeat * density * depth = 4186 * 1000 * waterDepth
  float isWater = step(0.01, waterDepth);  // 1.0 if waterDepth > 0.01m, else 0.0
  float C_water = 4186.0 * 1000.0 * waterDepth;  // J/(m²·K) for water column
  float effectiveHeatCapacity = mix(surfaceHeatCapacity, C_water, isWater);

  // Temperature change: dT/dt = dQ / C
  // Where C is heat capacity per unit area [J/(m²·K)]
  float dT = (dQ_total / effectiveHeatCapacity) * dt;

  // New temperature
  float T_new = T_old + dT;

  // Enforce minimum temperature (cosmic background)
  T_new = max(T_new, cosmicBackgroundTemp);

  // Output: RGBA = [temperature, humidity, pressure, unused]
  gl_FragColor = vec4(T_new, prevData.g, prevData.b, prevData.a);
}

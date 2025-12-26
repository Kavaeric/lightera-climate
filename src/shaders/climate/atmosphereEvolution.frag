// Deprecated, replacing it with stuff in src/climate/pass

precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousAtmosphere;     // Previous frame: RGBA = [T_atm, P_local, reserved, reserved]
uniform sampler2D previousSurfaceData;    // Surface temperature and albedo
uniform sampler2D cellInformation;          // Cell lat/lon positions
uniform sampler2D terrainData;            // Terrain data [elevation, reserved, reserved, reserved]
uniform sampler2D neighbourIndices1;      // Neighbour cell indices (x, y, z = first 3 neighbours)
uniform sampler2D neighbourIndices2;      // Neighbour cell indices (x, y, z = next 3 neighbours)

// Global atmosphere composition (from atmosphereConfig)
uniform float totalPressure;              // Pa (e.g., 101325 for Earth)
uniform float co2Content;                 // ppm (e.g., 400)
uniform float h2oContent;                 // kg/m² (e.g., 15)
uniform float co2AbsorptionCoeff;         // Mass absorption coefficient (m²/kg)
uniform float h2oAbsorptionCoeff;         // Mass absorption coefficient (m²/kg)

// Radiation/heating parameters
uniform float solarFlux;                  // W/m²
uniform float emissivity;                 // Surface emissivity
uniform float dt;                         // Timestep in seconds
uniform float yearProgress;               // 0-1
uniform vec2 baseSubsolarPoint;           // Subsolar location
uniform float axialTilt;                  // Axial tilt
uniform float atmosphereEmissivity;       // Atmosphere emissivity (typically ~1.0)
uniform float atmosphericDiffusion;       // W/(m·K) - lateral atmospheric heat transport

// Physical constants
const float STEFAN_BOLTZMANN = 5.670374419e-8;  // W/(m²·K⁴)
const float GRAVITY = 10.0;                     // m/s² - gravitational acceleration
const float SPECIFIC_HEAT_AIR = 1000.0;         // J/(kg·K) - specific heat of air at constant pressure
const float THERMAL_CONDUCTIVITY_ATMOS = 10.0;  // W/(m·K) - convection coupling

/**
 * Convert degrees to radians
 */
float deg2rad(float deg) {
  return deg * 3.14159265359 / 180.0;
}

/**
 * Calculate subsolar point latitude based on orbital position and axial tilt
 */
float calculateSubsolarLatitude(float baseLat, float tilt, float progress) {
  float orbitAngle = progress * 2.0 * 3.14159265359;
  float tiltedLat = baseLat + tilt * sin(orbitAngle);
  return tiltedLat;
}

/**
 * Calculate solar flux on a surface element given its lat/lon and subsolar point
 * Returns flux in W/m²
 */
float calculateSolarFlux(float lat, float lon, vec2 subsolar) {
  float lat_rad = deg2rad(lat);
  float lon_rad = deg2rad(lon);
  float subsolar_lat_rad = deg2rad(subsolar.x);
  float subsolar_lon_rad = deg2rad(subsolar.y);

  // Spherical dot product: cos(angle) = sin(lat1)*sin(lat2) + cos(lat1)*cos(lat2)*cos(lon2-lon1)
  float cosAngle = sin(lat_rad) * sin(subsolar_lat_rad) +
                   cos(lat_rad) * cos(subsolar_lat_rad) * cos(lon_rad - subsolar_lon_rad);

  // Flux = solarFlux * max(0, cosAngle)
  float flux = solarFlux * max(0.0, cosAngle);

  return flux;
}

/**
 * Calculate IR transmittance through atmosphere
 *
 * Physics: Optical depth τ = σ × column_mass
 * where column_mass ≈ pressure / gravity
 *
 * For Earth (reference):
 * - Total pressure: 101,325 Pa
 * - Gravity: ~10 m/s²
 * - Column mass: ~10,000 kg/m²
 * - CO2 at 400 ppm: column mass ~6 kg/m²
 *
 * Greenhouse effect scales with BOTH concentration AND total atmospheric mass
 */
float calculateTransmittance(float totalPress, float co2Ppm, float h2oMass) {
  // Calculate atmospheric column mass (kg/m²)
  float columnMass = totalPress / GRAVITY;

  // Calculate CO2 column mass (kg/m²)
  // CO2 fraction × total column mass
  float co2ColumnMass = (co2Ppm / 1.0e6) * columnMass;

  // Optical depth from CO2
  // For Earth (400 ppm, 101325 Pa): τ_CO2 ≈ 1.0 (tuned to observations)
  // This gives absorption coefficient: σ ≈ 1.0 / 6 kg/m² ≈ 0.17 m²/kg
  float co2Opacity = co2AbsorptionCoeff * co2ColumnMass;

  // H2O opacity (already in kg/m²)
  float h2oOpacity = h2oAbsorptionCoeff * h2oMass;

  float totalOpacity = co2Opacity + h2oOpacity;

  return exp(-totalOpacity);
}

void main() {
  // Read previous atmospheric state
  vec4 prevAtmos = texture2D(previousAtmosphere, vUv);

  // PHYSICS REMOVED: Just pass through unchanged
  // TODO: Rebuild physics architecture

  // Output: RGBA = [T_atm, P_local, reserved, reserved]
  gl_FragColor = prevAtmos;
}

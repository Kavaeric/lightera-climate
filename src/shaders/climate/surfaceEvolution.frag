// Deprecated, replacing it with stuff in src/climate/pass

precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousSurfaceData;  // Previous timestep: RGBA = [surfaceTemperature, albedo, reserved, reserved]
uniform sampler2D cellInformation;        // Cell lat/lon position and surface area

// Physical constants
const float STEFAN_BOLTZMANN = 5.670374419e-8; // W/(m²·K⁴)
const float GRAVITY = 10.0; // m/s² - gravitational acceleration

// Simulation parameters
uniform vec2 baseSubsolarPoint;       // [lat, lon] in degrees - subsolar point at vernal equinox
uniform float axialTilt;              // degrees - planet's axial tilt (0 = no tilt, 23.44 = Earth-like)
uniform float yearProgress;           // 0-1 - current position in orbit (0 = vernal equinox, 0.5 = autumnal)
uniform float solarFlux;               // W/m²
uniform float emissivity;              // 0-1 - thermal emissivity
uniform float atmosEmissivity;         // 0-1 - atmospheric emissivity (typically 1.0)
uniform float surfaceHeatCapacity;    // J/(m²·K) - heat capacity per unit area
uniform float dt;                      // timestep in seconds
uniform float textureWidth;
uniform float textureHeight;
uniform float cosmicBackgroundTemp;   // K
uniform float thermalConductivity;     // W/(m·K) - for lateral heat conduction
uniform float planetRadius;           // metres - planet's radius for calculating surface area and scaling

// Atmospheric radiative properties
uniform float totalPressure;          // Pa - total atmospheric pressure
uniform float co2Content;             // ppm - CO2 concentration
uniform float h2oContent;             // kg/m² - water vapour column
uniform float co2AbsorptionCoeff;     // m²/kg - CO2 mass absorption coefficient
uniform float h2oAbsorptionCoeff;     // m²/kg - H2O mass absorption coefficient

/**
 * Convert degrees to radians
 */
float deg2rad(float deg) {
  return deg * 3.14159265359 / 180.0;
}

/**
 * Calculate IR transmittance through atmosphere
 * Same formula as atmosphereEvolution.frag for consistency
 */
float calculateTransmittance(float totalPress, float co2Ppm, float h2oMass) {
  // Calculate atmospheric column mass (kg/m²)
  float columnMass = totalPress / GRAVITY;

  // Calculate CO2 column mass (kg/m²)
  float co2ColumnMass = (co2Ppm / 1.0e6) * columnMass;

  // Optical depth from CO2 and H2O
  float co2Opacity = co2AbsorptionCoeff * co2ColumnMass;
  float h2oOpacity = h2oAbsorptionCoeff * h2oMass;
  float totalOpacity = co2Opacity + h2oOpacity;

  return exp(-totalOpacity);
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
  // Read previous surface data (surface temperature and albedo)
  vec4 prevData = texture2D(previousSurfaceData, vUv);

  // PHYSICS REMOVED: Just pass through unchanged
  // TODO: Rebuild physics architecture

  // Output: RGBA = [surfaceTemperature, albedo, reserved, reserved]
  gl_FragColor = prevData;
}

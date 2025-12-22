precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousAtmosphere;     // Previous frame: RGBA = [T_atm, P_local, reserved, reserved]
uniform sampler2D previousSurfaceData;    // Surface temperature and albedo
uniform sampler2D cellPositions;          // Cell lat/lon positions
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
  float T_atm_old = prevAtmos.r;  // Atmospheric temperature in Kelvin
  float P_local = prevAtmos.g;    // Local atmospheric pressure in Pa

  // For now, use uniform total pressure if not initialised
  if (P_local < 1.0) {
    P_local = totalPressure;
  }

  // Read surface state (same frame hydrology pass has completed)
  vec4 surfaceData = texture2D(previousSurfaceData, vUv);
  float T_surf = surfaceData.r;   // Surface temperature
  float surfaceAlbedo = surfaceData.g;

  // Read cell position for solar calculation
  vec2 cellLatLon = texture2D(cellPositions, vUv).rg; // [lat, lon] in degrees

  // ===== CALCULATE SOLAR HEATING OF ATMOSPHERE =====

  // Subsolar point (same calculation as surface shader)
  float subsolarLat = calculateSubsolarLatitude(baseSubsolarPoint.x, axialTilt, yearProgress);
  vec2 subsolarPoint = vec2(subsolarLat, baseSubsolarPoint.y);

  // Incident solar flux at this cell
  float Q_solar_incident = calculateSolarFlux(cellLatLon.x, cellLatLon.y, subsolarPoint);

  // Calculate IR transmittance using local pressure
  float transmittance = calculateTransmittance(P_local, co2Content, h2oContent);

  // Solar absorption by atmosphere
  // H2O absorbs ~15% in near-IR bands, O3 absorbs ~3% UV, clouds ~5%
  // With H2O but no O3 or clouds: ~15-18%
  // For Earth-like with all components: ~23%
  // TODO: Make this dynamic based on H2O content when implementing water cycle
  const float SOLAR_ABSORPTION_FRACTION = 0.18;
  float Q_solar_absorbed = Q_solar_incident * SOLAR_ABSORPTION_FRACTION;

  // ===== CALCULATE IR RADIATION =====

  // Surface emission (from surface shader calculation)
  float surfaceEmission = emissivity * STEFAN_BOLTZMANN * pow(T_surf, 4.0);

  // Gray atmosphere radiative transfer (single-layer model)
  // Atmosphere with emissivity ε_a = (1 - τ) absorbs and emits IR

  // Two-stream radiative transfer for gray atmosphere
  // The atmosphere absorbs and emits with emissivity ε = (1-τ)

  // Energy absorbed by atmosphere from surface IR
  float Q_absorbed_from_surface = surfaceEmission * (1.0 - transmittance);

  // Atmospheric emission (both upward to space and downward to surface)
  float atmosphericEmission = (1.0 - transmittance) * STEFAN_BOLTZMANN * pow(T_atm_old, 4.0);

  // Net radiative exchange for atmosphere
  // Atmosphere loses energy in BOTH directions (upward + downward)
  // Even though downward heats surface, it still represents energy leaving atmosphere
  float dQ_ir = Q_absorbed_from_surface - 2.0 * atmosphericEmission;

  // ===== CALCULATE SENSIBLE HEAT EXCHANGE WITH SURFACE =====

  // Sensible heat transfer (turbulent mixing and conduction)
  // Represents convective heat exchange between surface and atmosphere
  // For Earth: ~20-30 W/m² average sensible heat flux
  // Using coupling coefficient that gives realistic flux
  const float SENSIBLE_HEAT_COUPLING = 5.0;  // W/(m·K)
  float Q_sensible = SENSIBLE_HEAT_COUPLING * (T_surf - T_atm_old);

  // ===== CALCULATE LATERAL ATMOSPHERIC HEAT DIFFUSION =====

  // Read neighbour indices
  vec3 neighbours1 = texture2D(neighbourIndices1, vUv).rgb;
  vec3 neighbours2 = texture2D(neighbourIndices2, vUv).rgb;

  // Sample neighbour atmospheric temperatures
  float neighbourSum = 0.0;
  float validNeighbours = 0.0;

  // Helper function to safely sample neighbour temperature
  #define SAMPLE_NEIGHBOUR(index) \
    if (index >= 0.0) { \
      vec2 neighbourCoord = vec2(mod(index, 256.0) / 256.0, floor(index / 256.0) / 256.0); \
      float T_neighbour = texture2D(previousAtmosphere, neighbourCoord).r; \
      neighbourSum += T_neighbour; \
      validNeighbours += 1.0; \
    }

  SAMPLE_NEIGHBOUR(neighbours1.r)
  SAMPLE_NEIGHBOUR(neighbours1.g)
  SAMPLE_NEIGHBOUR(neighbours1.b)
  SAMPLE_NEIGHBOUR(neighbours2.r)
  SAMPLE_NEIGHBOUR(neighbours2.g)
  SAMPLE_NEIGHBOUR(neighbours2.b)

  // Calculate diffusive heat flux from neighbours (lateral heat transport)
  // This represents large-scale atmospheric circulation and mixing
  float avgNeighbourAtmosTemp = neighbourSum / max(validNeighbours, 1.0);
  float Q_diffusion = atmosphericDiffusion * (avgNeighbourAtmosTemp - T_atm_old);

  // ===== CALCULATE NET HEATING RATE =====

  // Energy balance for atmosphere:
  // Gains: solar absorption + IR from surface + sensible heat from surface + diffusion from neighbors
  // Losses: IR to space (upward only) + diffusion to cold neighbors
  // Note: Downward IR emission heats surface, not counted here
  float dQ_total = Q_solar_absorbed + dQ_ir + Q_sensible + Q_diffusion;

  // ===== CALCULATE TEMPERATURE CHANGE =====

  // Calculate atmospheric heat capacity from local pressure
  // C = (column_mass) × (specific_heat) = (P/g) × c_p
  // For Earth (101325 Pa): C = 10132.5 kg/m² × 1000 J/(kg·K) ≈ 1e7 J/(m²·K)
  // For thin atmospheres, this scales down proportionally
  float atmosphereHeatCapacity = (P_local / GRAVITY) * SPECIFIC_HEAT_AIR;

  // Prevent division by zero for airless worlds
  atmosphereHeatCapacity = max(atmosphereHeatCapacity, 1.0);

  // dT/dt = dQ / C
  float dT = (dQ_total / atmosphereHeatCapacity) * dt;

  // New atmospheric temperature
  float T_atm_new = T_atm_old + dT;

  // Enforce minimum temperature (cosmic background radiation)
  const float COSMIC_BACKGROUND = 2.73;  // K
  T_atm_new = max(T_atm_new, COSMIC_BACKGROUND);

  // Output: RGBA = [T_atm, P_local, reserved, reserved]
  // For now, P_local remains constant (uniform across planet)
  gl_FragColor = vec4(T_atm_new, P_local, prevAtmos.b, prevAtmos.a);
}

precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousSurfaceData;  // Previous timestep: RGBA = [surfaceTemperature, albedo, reserved, reserved]
uniform sampler2D cellPositions;        // Cell lat/lon positions
uniform sampler2D neighbourIndices1;    // Neighbours 0,1,2
uniform sampler2D neighbourIndices2;     // Neighbours 3,4,5
uniform sampler2D neighbourCounts;      // Number of neighbours (5 or 6)
uniform sampler2D terrainData;          // Terrain data [elevation, reserved, reserved, reserved]
uniform sampler2D hydrologyData;         // Hydrology data [iceThickness, waterThermalMass, waterDepth, reserved]
uniform sampler2D atmosphereData;        // Atmosphere data [atmosphereTemperature, reserved, reserved, reserved]

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
uniform float h2oContent;             // kg/m² - water vapor column
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
  float T_old = prevData.r;  // Previous surface temperature
  float prevAlbedo = prevData.g;  // Previous albedo (for reference, but we'll recompute)

  // Read cell position
  vec2 cellLatLon = texture2D(cellPositions, vUv).rg; // [lat, lon] in degrees

  // Read terrain data (elevation only - other properties stored in hydrology/surface layers)
  vec4 terrain = texture2D(terrainData, vUv);
  float elevation = terrain.r;        // metres (signed)

  // Read hydrology state for both albedo and heat capacity calculations
  vec4 hydro = texture2D(hydrologyData, vUv);
  float iceThickness = hydro.r;       // metres
  float waterThermalMass = hydro.g;   // 0-1 normalised indicator
  float waterDepth = hydro.b;         // metres (dynamic, evolves with evaporation)

  // ===== COMPUTE EFFECTIVE ALBEDO =====
  // Compute effective surface albedo based on phase state (branch-free)
  // Ice and water have much higher albedo than rock
  float hasWater = step(0.01, waterDepth);      // 1.0 if water present
  float hasIce = step(0.01, iceThickness);       // 1.0 if ice present
  float hasWaterOrIce = max(hasWater, hasIce);  // 1.0 if water OR ice present

  // Albedo transitions:
  // - No water/ice: 0.2 (average rock/dirt)
  // - Liquid water: 0.06 (absorbs most radiation)
  // - Ice-covered water or ice on land: 0.65 (reflects most radiation)
  float albedoRock = 0.2;
  float albedoWater = 0.06;
  float albedoIce = 0.65;
  float albedoWaterOrIce = mix(albedoWater, albedoIce, hasIce);
  float effectiveAlbedo = mix(albedoRock, albedoWaterOrIce, hasWaterOrIce);

  // ===== COMPUTE SURFACE TEMPERATURE EVOLUTION =====
  // Calculate subsolar point based on orbital position and axial tilt
  float subsolarLat = calculateSubsolarLatitude(baseSubsolarPoint.x, axialTilt, yearProgress);
  vec2 subsolarPoint = vec2(subsolarLat, baseSubsolarPoint.y);

  // Calculate incoming solar flux at top of atmosphere
  float Q_solar_toa = calculateSolarFlux(cellLatLon.x, cellLatLon.y, subsolarPoint);

  // Atmosphere absorbs fraction of solar (O3, H2O, clouds absorb UV/visible)
  // H2O absorbs ~15-18% in near-IR, O3 ~3% UV, clouds ~5%
  // This matches the SOLAR_ABSORPTION_FRACTION in atmosphere shader
  const float SOLAR_ABSORPTION_BY_ATMOSPHERE = 0.18;

  // Solar reaching surface after atmospheric absorption
  float Q_solar_at_surface = Q_solar_toa * (1.0 - SOLAR_ABSORPTION_BY_ATMOSPHERE);

  // Account for surface albedo (fraction of light reflected back to space)
  float Q_solar = Q_solar_at_surface * (1.0 - effectiveAlbedo);

  // Read atmospheric temperature for radiative transfer
  vec4 atmosData = texture2D(atmosphereData, vUv);
  float T_atmo = atmosData.r;
  float P_local = atmosData.g;

  // Use global pressure if local not initialized
  if (P_local < 1.0) {
    P_local = totalPressure;
  }

  // Calculate atmospheric IR transmittance
  float transmittance = calculateTransmittance(P_local, co2Content, h2oContent);

  // ===== RADIATIVE TRANSFER WITH GREENHOUSE EFFECT =====

  // Surface emits blackbody radiation: ε × σ × T_surf^4
  float surfaceEmission = emissivity * STEFAN_BOLTZMANN * pow(T_old, 4.0);

  // Fraction of surface emission that escapes to space (rest absorbed by atmosphere)
  float Q_ir_to_space = surfaceEmission * transmittance;

  // Atmospheric back-radiation to surface
  // Two-stream approximation for gray atmosphere:
  // Atmosphere at temperature T_atm emits σ × T_atm^4 per unit area
  // In single-layer model, assume atmosphere emits equally upward and downward
  // BUT: must account for atmospheric absorptivity (1-τ)
  // A fully opaque atmosphere (τ=0) emits full blackbody: σ × T_atm^4
  // A transparent atmosphere (τ=1) emits nothing: 0
  // Gray atmosphere emits: (1-τ) × σ × T_atm^4 downward
  // For Earth (τ≈0.5): atmosphere emits 0.5 × σ × T_atm^4 downward
  float Q_back_radiation = (1.0 - transmittance) * STEFAN_BOLTZMANN * pow(T_atmo, 4.0);

  // Net radiative balance for surface
  // Gains: solar + atmospheric back-radiation
  // Losses: surface IR emission (all of it - atmosphere will absorb fraction (1-τ))
  float dQ_radiation = Q_solar + Q_back_radiation - surfaceEmission;

  // Lateral heat conduction (diffusion from neighbours)
  // Read neighbour indices
  vec3 neighbours1 = texture2D(neighbourIndices1, vUv).rgb;
  vec3 neighbours2 = texture2D(neighbourIndices2, vUv).rgb;

  // Collect neighbour surface temperatures
  float neighbourSum = 0.0;
  float validNeighbours = 0.0;

  // Process first 3 neighbours
  for (int i = 0; i < 3; i++) {
    float neighbourIdx = i == 0 ? neighbours1.r : (i == 1 ? neighbours1.g : neighbours1.b);
    float isValid = step(0.0, neighbourIdx);

    vec2 neighbourUV = cellIndexToUV(neighbourIdx);
    float neighbourSurfaceTemp = texture2D(previousSurfaceData, neighbourUV).r;

    neighbourSum += neighbourSurfaceTemp * isValid;
    validNeighbours += isValid;
  }

  // Process next 3 neighbours
  for (int i = 0; i < 3; i++) {
    float neighbourIdx = i == 0 ? neighbours2.r : (i == 1 ? neighbours2.g : neighbours2.b);
    float isValid = step(0.0, neighbourIdx);

    vec2 neighbourUV = cellIndexToUV(neighbourIdx);
    float neighbourSurfaceTemp = texture2D(previousSurfaceData, neighbourUV).r;

    neighbourSum += neighbourSurfaceTemp * isValid;
    validNeighbours += isValid;
  }

  // Calculate conductive heat flux from neighbours (lateral heat conduction)
  // Uses Fourier's law: Q = k * A * (dT / dx)
  // For geodesic grid: approximate cell spacing from planet surface area / cell count
  // Typical resolution: 16 subdivisions = ~2560 cells
  // Approximate cell spacing: sqrt(4π * R² / N) where N = cell count
  // For Earth (R = 6.371e6 m) with 2560 cells: spacing ≈ 1e5 m = 100 km

  float avgNeighbourSurfaceTemp = neighbourSum / max(validNeighbours, 1.0);

  // Phase-dependent thermal conductivity based on physical material properties
  // Thermal conductivity values (W/(m·K)):
  // - Water: 0.6
  // - Ice: 2.2
  // - Rock (typical): 2.5
  const float WATER_CONDUCTIVITY = 0.6;
  const float ICE_CONDUCTIVITY = 2.2;
  const float ROCK_CONDUCTIVITY = 2.5;

  float k = ROCK_CONDUCTIVITY;  // Default to rock conductivity
  if (hasWater > 0.0 && hasIce < 0.01) {
    k = WATER_CONDUCTIVITY;
  } else if (hasIce > 0.0) {
    k = ICE_CONDUCTIVITY;
  }

  // Estimate cell spacing for heat conduction calculation
  // Approximate: sqrt(surface_area / N_cells) where N ≈ textureWidth * textureHeight
  float totalCells = textureWidth * textureHeight;
  float cellSpacing = sqrt(4.0 * 3.14159 * planetRadius * planetRadius / totalCells);

  // Fourier's law: Q = k * (dT / dx) per unit area
  // Here: dQ (W/m²) = k (W/(m·K)) * dT (K) / spacing (m)
  float dQ_conduction = k * (avgNeighbourSurfaceTemp - T_old) / cellSpacing;

  // Sensible heat transfer (convection/conduction) between atmosphere and surface
  // In this simplified single-layer model, most energy transfer is via radiation
  // Sensible heat represents only the small non-radiative component (turbulent eddies, etc.)
  // Keep this small to avoid double-counting with radiative transfer
  const float SENSIBLE_HEAT_COUPLING_ROCK = 0.0;  // W/(m·K) - negligible for this model
  const float SENSIBLE_HEAT_COUPLING_WATER = 0.0; // W/(m·K) - negligible for this model
  float sensibleHeatCoupling = mix(SENSIBLE_HEAT_COUPLING_ROCK, SENSIBLE_HEAT_COUPLING_WATER, hasWaterOrIce);
  float dQ_sensible = sensibleHeatCoupling * (T_atmo - T_old);

  // Total heating rate (W/m²)
  // Radiation: solar + back_radiation - IR_to_space
  // Conduction: lateral heat diffusion from neighbors
  // Sensible: turbulent heat exchange with atmosphere
  float dQ_total = dQ_radiation + dQ_conduction + dQ_sensible;

  // Determine effective heat capacity based on phase state (hydrology already read above)
  // Three cases:
  // 1. Rock/land: C = surfaceHeatCapacity (2.16e6 J/(m²·K)) - represents ~100-150m crust
  // 2. Liquid water: C = 4186 * 1000 * min(waterDepth, CRUST_DEPTH) - capped at mixed layer depth
  // 3. Ice: C = 2100 * 917 * min(iceThickness, CRUST_DEPTH) - capped at active depth
  // This prevents unrealistic heat capacities from very deep water while still providing thermal inertia

  const float CRUST_DEPTH = 25.0;  // approximate depth of thermal crust being simulated in metres (ocean mixed layer)

  // Heat capacities for different phases
  float C_rock = surfaceHeatCapacity;                                 // Rock: 2.16e6 J/(m²·K)
  float C_water = 4186.0 * 1000.0 * min(waterDepth, CRUST_DEPTH);     // Liquid water: capped at crust depth
  float C_ice = 2100.0 * 917.0 * min(iceThickness, CRUST_DEPTH);      // Ice: capped at crust depth

  // Select heat capacity based on current phase
  // When both ice and water are present, combine their heat capacities
  // Otherwise use the appropriate single-phase heat capacity
  float effectiveHeatCapacity = C_rock;
  
  if (hasIce > 0.0 && hasWater > 0.0) {
    // Both ice and water present: combine heat capacities
    effectiveHeatCapacity = C_ice + C_water;
  } else if (hasIce > 0.0) {
    // Only ice present
    effectiveHeatCapacity = C_ice;
  } else if (hasWater > 0.0) {
    // Only water present
    effectiveHeatCapacity = C_water;
  }

  // Surface temperature change: dT/dt = dQ / C
  // Where C is heat capacity per unit area [J/(m²·K)]
  float dT = (dQ_total / effectiveHeatCapacity) * dt;

  // New surface temperature
  float T_new = T_old + dT;

  // Enforce minimum surface temperature (cosmic background)
  T_new = max(T_new, cosmicBackgroundTemp);

  // Output: RGBA = [surfaceTemperature, albedo, reserved, reserved]
  gl_FragColor = vec4(T_new, effectiveAlbedo, prevData.b, prevData.a);
}

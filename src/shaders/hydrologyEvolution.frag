precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousHydrology;      // Current frame hydrology: RGBA = [iceThickness, waterThermalMass, unused, unused]
uniform sampler2D currentTemperature;     // Temperature from climate layer (same frame)
uniform sampler2D terrainData;            // Static terrain: RGBA = [elevation, waterDepth, salinity, baseAlbedo]

// Physical constants
const float LATENT_HEAT_FUSION = 3.34e5;  // J/kg - energy to melt/freeze ice
const float ICE_DENSITY = 917.0;          // kg/m³
const float WATER_DENSITY = 1000.0;       // kg/m³
const float ICE_THERMAL_CONDUCTIVITY = 2.2;  // W/(m·K) - thermal conductivity of ice
const float DT = 1.0;                     // Timestep (in shader units - actual dt applied in engine)

// Thresholds
const float WATER_FREEZE_POINT = 273.15;  // K - freshwater freezing point (0°C)
const float ICE_SUBLIMATION_TEMP = 263.15; // K - approximate sublimation threshold in vacuum

// Ice formation/melting parameters (tuned for simulation)
const float MAX_FREEZE_RATE = 0.5;        // m/frame - maximum ice formation rate
const float MAX_MELT_RATE = 0.5;          // m/frame - maximum ice melting rate

void main() {
  // Read current state
  vec4 hydro = texture2D(previousHydrology, vUv);
  float iceThickness = hydro.r;           // meters of ice
  float waterThermalMass = hydro.g;       // 0-1, normalized indicator of water presence

  // Read temperature and terrain
  float T = texture2D(currentTemperature, vUv).r; // Kelvin
  vec4 terrain = texture2D(terrainData, vUv);
  float waterDepth = terrain.g;           // meters
  float salinity = terrain.b;             // PSU (Practical Salinity Units)

  // Calculate salinity-dependent freezing point
  // T_freeze = 273.15 - 0.054 * salinity (degrees K depression per PSU)
  float freezingPoint = WATER_FREEZE_POINT - 0.054 * salinity;

  // Determine if water is present (from terrain)
  float hasWater = step(0.01, waterDepth);  // 1.0 if waterDepth > 0.01m

  // ===== ICE DYNAMICS =====
  // Based on Stefan's problem: ice growth/melting driven by temperature difference
  // from freezing point, limited by latent heat and thermal conductivity

  float newIceThickness = iceThickness;
  float newWaterThermalMass = waterThermalMass;

  if (hasWater > 0.5) {
    // Water is present at this location
    float tempDifference = freezingPoint - T;  // Positive when below freezing, negative when above

    if (tempDifference > 0.1) {
      // FREEZING: Temperature below freezing point
      // Ice growth rate scales with how far below freezing we are
      // Rate increases with temperature difference (colder = faster freezing)
      // Rate decreases with existing ice thickness (insulation effect)

      // Normalized temperature difference (0 to 1): how far below freezing, capped at 20K
      float normalizedTempDiff = min(tempDifference / 20.0, 1.0);

      // Insulation factor: thicker ice slows freezing (exponential decay)
      float insulationFactor = exp(-iceThickness / 5.0);  // 5m e-folding depth

      // Physical freezing rate from Stefan's problem:
      // dh/dt = k * dT / (L * rho_ice)
      // Simplified: rate proportional to temperature difference and insulation
      float freezeRate = MAX_FREEZE_RATE * normalizedTempDiff * insulationFactor;

      newIceThickness = iceThickness + freezeRate;
      newWaterThermalMass = 0.0;  // When freezing occurs, water is becoming ice

    } else if (tempDifference < -0.1) {
      // MELTING: Temperature above freezing point
      // Ice melting rate scales with how far above freezing we are

      // Normalized temperature difference (0 to 1): how far above freezing, capped at 10K
      float normalizedTempDiff = min(-tempDifference / 10.0, 1.0);

      // Melting rate increases with warmer temperatures
      float meltRate = MAX_MELT_RATE * normalizedTempDiff;

      newIceThickness = max(0.0, iceThickness - meltRate);

      // Return to liquid water when no ice remains
      if (newIceThickness < 0.01) {
        newIceThickness = 0.0;
        newWaterThermalMass = 1.0;  // Back to liquid
      }

    } else if (T < ICE_SUBLIMATION_TEMP && iceThickness > 0.01) {
      // SUBLIMATION: Very low temperatures (airless worlds)
      // Ice directly converts to vapor at extremely cold temps
      float sublimationRate = 0.01;  // Very slow, only at extreme cold
      newIceThickness = max(0.0, iceThickness - sublimationRate);

      if (newIceThickness < 0.01) {
        newIceThickness = 0.0;
        newWaterThermalMass = 0.0;  // Ice sublimated to vapor
      }
    }
    // else: temperature near freezing with existing ice -> no change

  } else {
    // No water present at this location (land/rock)
    // Ice can't form without water
    // Any existing ice would sublimate away
    newIceThickness = 0.0;
    newWaterThermalMass = 0.0;
  }

  // Clamp values to valid ranges
  newIceThickness = clamp(newIceThickness, 0.0, 10000.0);
  newWaterThermalMass = clamp(newWaterThermalMass, 0.0, 1.0);

  // Output new hydrology state
  // RGBA = [iceThickness, waterThermalMass, reserved, reserved]
  gl_FragColor = vec4(newIceThickness, newWaterThermalMass, 0.0, 0.0);
}

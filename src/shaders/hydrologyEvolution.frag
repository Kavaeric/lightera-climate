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

  // ===== ICE DYNAMICS (Branch-free) =====
  // Based on Stefan's problem: ice growth/melting driven by temperature difference
  // from freezing point, limited by latent heat and thermal conductivity
  // Uses smooth step and mix operations to avoid GPU branch divergence

  float tempDifference = freezingPoint - T;  // Positive when below freezing, negative when above

  // Compute freezing rate (when tempDifference > 0.1)
  float normalizedFreezeDiff = clamp(tempDifference / 20.0, 0.0, 1.0);
  float insulationFactor = exp(-iceThickness / 5.0);  // 5m e-folding depth
  float freezeRate = MAX_FREEZE_RATE * normalizedFreezeDiff * insulationFactor;

  // Smooth transition into freezing (threshold at 0.1K)
  float freezingWeight = smoothstep(-0.05, 0.15, tempDifference);

  // Compute melting rate (when tempDifference < -0.1)
  float normalizedMeltDiff = clamp(-tempDifference / 10.0, 0.0, 1.0);
  float meltRate = MAX_MELT_RATE * normalizedMeltDiff;

  // Smooth transition into melting (threshold at -0.1K)
  float meltingWeight = smoothstep(0.15, -0.05, tempDifference);

  // Compute sublimation rate (when T < ICE_SUBLIMATION_TEMP)
  float sublimationWeight = step(T, ICE_SUBLIMATION_TEMP);
  float sublimationRate = 0.01 * sublimationWeight;

  // Apply phase changes based on weights
  // Freezing grows ice and reduces thermal mass
  float iceDeltaFreeze = freezeRate * freezingWeight;
  float thermalMassFreeze = mix(waterThermalMass, 0.0, freezingWeight);

  // Melting shrinks ice and increases thermal mass
  float iceDeltaMelt = -meltRate * meltingWeight;
  float thermalMassMelt = mix(thermalMassFreeze, 1.0, meltingWeight * step(0.01, iceThickness + iceDeltaFreeze + iceDeltaMelt));

  // Sublimation (lowest priority, only at extreme cold)
  float iceDeltaSublime = -sublimationRate;

  // Combine all phase change rates (freezing takes precedence when both active)
  float iceDelta = mix(iceDeltaMelt + iceDeltaSublime, iceDeltaFreeze, freezingWeight);
  float newIceThickness = max(0.0, iceThickness + iceDelta);

  // Reset if no water present (land/rock) - water ablates ice
  float hasWater = step(0.01, waterDepth);
  newIceThickness *= hasWater;

  // Thermal mass transitions
  float newWaterThermalMass = mix(0.0, thermalMassMelt, hasWater);

  // When ice completely melts, return to liquid water
  float hasIceNow = step(0.01, newIceThickness);
  newWaterThermalMass = mix(1.0, newWaterThermalMass, hasIceNow);

  // Clamp values to valid ranges
  newIceThickness = clamp(newIceThickness, 0.0, 10000.0);
  newWaterThermalMass = clamp(newWaterThermalMass, 0.0, 1.0);

  // Output new hydrology state
  // RGBA = [iceThickness, waterThermalMass, reserved, reserved]
  gl_FragColor = vec4(newIceThickness, newWaterThermalMass, 0.0, 0.0);
}

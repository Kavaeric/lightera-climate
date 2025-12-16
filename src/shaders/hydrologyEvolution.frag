precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousHydrology;      // Current frame hydrology: RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
uniform sampler2D currentTemperature;     // Temperature from climate layer (same frame)
uniform sampler2D terrainData;            // Static terrain: RGBA = [elevation, reserved, reserved, reserved]

// Physical constants
const float LATENT_HEAT_FUSION = 3.34e5;  // J/kg - energy to melt/freeze ice
const float ICE_DENSITY = 917.0;          // kg/m³
const float WATER_DENSITY = 1000.0;       // kg/m³
const float ICE_THERMAL_CONDUCTIVITY = 2.2;  // W/(m·K) - thermal conductivity of ice
const float DT = 1.0;                     // Timestep (in shader units - actual dt applied in engine)

// Thresholds
const float WATER_FREEZE_POINT = 273.15;  // K - freshwater freezing point (0°C)
const float WATER_BOIL_POINT_VACUUM = 273.15; // K - boiling point in vacuum (~0°C, no atmospheric pressure)

// Ice formation/melting parameters (tuned for simulation)
const float MAX_FREEZE_RATE = 0.25;       // m/frame - maximum ice formation rate
const float MAX_MELT_RATE = 0.25;         // m/frame - maximum ice melting rate

// Water evaporation parameters
const float MAX_EVAPORATION_RATE = 10.0;  // m/frame - maximum water evaporation rate (10m per physics frame)
const float LATENT_HEAT_VAPORIZATION = 2.26e6; // J/kg - energy to evaporate water

void main() {
  // Read current state from hydrology (dynamic)
  vec4 hydro = texture2D(previousHydrology, vUv);
  float iceThickness = hydro.r;           // meters of ice
  float waterThermalMass = hydro.g;       // 0-1, normalized indicator of water presence
  float waterDepth = hydro.b;             // meters (evolves with evaporation/freezing)
  float salinity = hydro.a;               // PSU (Practical Salinity Units - travels with water)

  // Read temperature and terrain
  float T = texture2D(currentTemperature, vUv).r; // Kelvin

  // Calculate salinity-dependent freezing point
  // T_freeze = 273.15 - 0.054 * salinity (degrees K depression per PSU)
  float freezingPoint = WATER_FREEZE_POINT - 0.054 * salinity;

  // ===== ICE DYNAMICS (Branch-free) =====
  // Based on Stefan's problem: ice growth/melting driven by temperature difference
  // from freezing point, limited by latent heat and thermal conductivity
  // Uses smooth step and mix operations to avoid GPU branch divergence

  float tempDifference = freezingPoint - T;  // Positive when below freezing, negative when above

  // Compute freezing rate (when tempDifference > 0)
  // Symmetrized: both freeze and melt use same normalization scale (15K)
  float normalizedFreezeDiff = clamp(tempDifference / 15.0, 0.0, 1.0);
  float freezeRate = MAX_FREEZE_RATE * normalizedFreezeDiff;

  // Smooth transition into freezing (threshold at 0.1K)
  float freezingWeight = smoothstep(-0.05, 0.15, tempDifference);

  // Compute melting rate (when tempDifference < 0)
  // Symmetrized: both freeze and melt use same normalization scale (15K)
  float normalizedMeltDiff = clamp(-tempDifference / 15.0, 0.0, 1.0);
  float meltRate = MAX_MELT_RATE * normalizedMeltDiff;

  // Smooth transition into melting (threshold at -0.1K)
  float meltingWeight = smoothstep(0.15, -0.05, tempDifference);

  // Water presence check (needed for freezing)
  float hasWater = step(0.01, waterDepth);

  // Apply phase changes based on weights
  // Freezing and melting are mutually exclusive: only one applies per frame
  // Freezing: below freezing point, water present → ice grows, thermal mass drops
  // Melting: above freezing point, ice present → ice shrinks, thermal mass rises

  // Freezing is limited by available water
  // Cannot freeze more ice than water available (ice forms from water)
  float maxFreezableIce = waterDepth; // All water can potentially freeze
  float iceDeltaFreeze = min(freezeRate * freezingWeight * hasWater, maxFreezableIce);

  float iceDeltaMelt = -meltRate * meltingWeight;

  // Phase change: freezing dominates when freezingWeight > meltingWeight
  // Ensures we don't both freeze and melt in same frame (they're opposites)
  float isFreezingCondition = freezingWeight * hasWater;
  float iceDelta = mix(iceDeltaMelt, iceDeltaFreeze, isFreezingCondition);
  float newIceThickness = max(0.0, iceThickness + iceDelta);

  // Thermal mass follows phase state: liquid water (1.0) or ice (0.0)
  float thermalMassAfterFreeze = mix(waterThermalMass, 0.0, isFreezingCondition);
  float thermalMassAfterMelt = mix(thermalMassAfterFreeze, 1.0, meltingWeight * step(0.01, newIceThickness));

  // Thermal mass transitions
  float newWaterThermalMass = mix(0.0, thermalMassAfterMelt, hasWater);

  // When ice completely melts, return to liquid water
  float hasIceNow = step(0.01, newIceThickness);
  newWaterThermalMass = mix(1.0, newWaterThermalMass, hasIceNow);

  // ===== WATER EVAPORATION (Vacuum environment) =====
  // In vacuum (no atmospheric pressure), water boils at ~0°C (273.15K)
  // Exposed surface water above boiling point evaporates rapidly
  // Uses branch-free approach with smoothstep for smooth transitions

  float waterBoilDifference = T - WATER_BOIL_POINT_VACUUM;  // Positive when above boiling point

  // Compute evaporation rate (proportional to temperature above boiling point)
  // Normalize aggressively: 0K above boiling = 0% rate, 10K above = 100% rate
  float normalizedEvapDiff = clamp(waterBoilDifference / 10.0, 0.0, 1.0);

  // Salty water evaporates slower than fresh water
  // 0 PSU (fresh): 100% evaporation rate
  // 35 PSU (ocean): ~65% evaporation rate
  // 100+ PSU (hypersaline): ~0% evaporation rate
  float salinityReductionFactor = 1.0 - (salinity / 100.0);
  float evaporationRate = MAX_EVAPORATION_RATE * normalizedEvapDiff * salinityReductionFactor;

  // Smooth transition into evaporation (threshold at boiling point)
  // Smoothly ramp from 0 at -1K to 1 at +1K relative to boiling point
  float evaporationWeight = smoothstep(-1.0, 1.0, waterBoilDifference);

  // Water can only evaporate if it's liquid (not ice)
  // No threshold on water depth - water can evaporate completely to zero
  float canEvaporate = (1.0 - hasIceNow);

  // Evaporation removes water: combines weight (when to start evaporating) with rate (how fast)
  // evaporationWeight ensures smooth onset at boiling point
  // evaporationRate scales with temperature above boiling
  // canEvaporate ensures only liquid water evaporates (ice sublimes separately)
  float waterLossFromEvap = evaporationWeight * evaporationRate * canEvaporate;

  // Freezing consumes water - reduce water depth when ice forms
  // Note: iceDeltaFreeze is the amount of ice added (can be positive or zero)
  // When water freezes into ice, the water is consumed
  float waterLossFromFreeze = max(0.0, iceDeltaFreeze);

  // Reduce both water depth and thermal mass from evaporation
  float newWaterDepth = max(0.0, waterDepth - waterLossFromEvap - waterLossFromFreeze);
  float newWaterThermalMass_evap = max(0.0, newWaterThermalMass - waterLossFromEvap);

  // Final water state: frozen, liquid, or evaporated
  newWaterThermalMass = newWaterThermalMass_evap;

  // Zero out trace amounts of water below resolution threshold
  // Prevents puddles and residual water from accumulating
  newWaterDepth = mix(0.0, newWaterDepth, step(0.01, newWaterDepth));

  // Clamp values to valid ranges (no basin capacity - water can evaporate away)
  newIceThickness = clamp(newIceThickness, 0.0, 10000.0);
  newWaterThermalMass = clamp(newWaterThermalMass, 0.0, 1.0);
  newWaterDepth = clamp(newWaterDepth, 0.0, 10000.0);

  // Clear salinity if no water or ice present
  // Salinity is tied to water, so when all water/ice is gone, reset to 0 for fresh water accumulation
  float hasWaterOrIce = step(0.01, newWaterDepth + newIceThickness);
  float newSalinity = mix(0.0, salinity, hasWaterOrIce);

  // Output new hydrology state
  // RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
  gl_FragColor = vec4(newIceThickness, newWaterThermalMass, newWaterDepth, newSalinity);
}

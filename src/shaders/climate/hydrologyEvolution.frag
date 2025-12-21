precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousHydrology;      // Current frame hydrology: RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
uniform sampler2D currentTemperature;     // Surface temperature from climate layer (same frame) - RGBA = [surfaceTemperature, albedo, reserved, reserved]
uniform sampler2D atmosphereData;         // Atmospheric data from previous frame: RGBA = [T_atm, P_local, reserved, reserved]
uniform sampler2D terrainData;            // Static terrain: RGBA = [elevation, reserved, reserved, reserved]

// Physical constants
const float LATENT_HEAT_FUSION = 3.34e5;  // J/kg - energy to melt/freeze ice
const float ICE_DENSITY = 917.0;          // kg/m³
const float WATER_DENSITY = 1000.0;       // kg/m³
const float ICE_THERMAL_CONDUCTIVITY = 2.2;  // W/(m·K) - thermal conductivity of ice
const float DT = 1.0;                     // Timestep (in shader units - actual dt applied in engine)

// Thresholds
const float WATER_FREEZE_POINT = 273.15;  // K - freshwater freezing point (0°C) at 1 atm
const float STANDARD_PRESSURE = 101325.0; // Pa - standard atmospheric pressure (1 atm)
const float WATER_BOIL_POINT_1ATM = 373.15; // K - boiling point at 1 atm (100°C)

// Ice formation/melting parameters (tuned for simulation)
const float MAX_FREEZE_RATE = 0.25;       // m/frame - maximum ice formation rate
const float MAX_MELT_RATE = 0.25;         // m/frame - maximum ice melting rate

// Water evaporation parameters
const float MAX_EVAPORATION_RATE = 10.0;  // m/frame - maximum water evaporation rate (10m per physics frame)
const float LATENT_HEAT_VAPORIZATION = 2.26e6; // J/kg - energy to evaporate water

// Quantisation increment for water/ice depths (prevents floating point drift)
// NOTE: This value must match DEPTH_QUANTUM in src/config/simulationConfig.ts
const float DEPTH_QUANTUM = 0.1; // meters - all depths quantised to 10cm increments

/**
 * Quantise depth value to DEPTH_QUANTUM increments
 * This prevents floating point drift and ensures depths are either
 * meaningful (≥0.1m) or exactly zero
 */
float quantiseDepth(float depth) {
  return floor(depth / DEPTH_QUANTUM + 0.5) * DEPTH_QUANTUM;
}

/**
 * Calculate freezing point of water as a function of atmospheric pressure
 * Uses Clausius-Clapeyron equation for ice-water equilibrium
 *
 * Physics: Higher pressure slightly lowers the freezing point of water
 * This is why ice skating works - pressure melts ice under the blade
 *
 * dT/dP ≈ -0.0074 K/MPa (negative because pressure lowers freezing point)
 * For reference: -7.4 mK per atmosphere
 *
 * Examples:
 * - 101325 Pa (1 atm): 273.15 K (0°C)
 * - 202650 Pa (2 atm): ~273.142 K (-0.008°C)
 * - 1 MPa (10 atm): ~273.08 K (-0.07°C)
 * - 10 MPa (100 atm): ~272.41 K (-0.74°C)
 *
 * Note: Effect is small at atmospheric pressures, significant only at very high pressures
 */
float calculateFreezingPoint(float pressure, float salinity) {
  // Pressure effect on freezing point (small but physical)
  // dT = -0.0074 K/MPa × (P - P_ref) in MPa
  float pressureMPa = pressure / 1.0e6; // Convert Pa to MPa
  float referencePressureMPa = STANDARD_PRESSURE / 1.0e6;
  float pressureEffect = -0.0074 * (pressureMPa - referencePressureMPa);

  // Salinity effect (dominant at ocean salinities)
  // T_freeze = 273.15 - 0.054 * salinity (degrees K depression per PSU)
  float salinityEffect = -0.054 * salinity;

  // Combined freezing point
  return WATER_FREEZE_POINT + pressureEffect + salinityEffect;
}

/**
 * Calculate boiling point of water as a function of atmospheric pressure
 * Uses simplified Clausius-Clapeyron equation
 *
 * Physics: ln(P2/P1) = -(L/R) * (1/T2 - 1/T1)
 * Rearranging: T_boil = 1 / (1/T_ref - (R/L) * ln(P/P_ref))
 *
 * For water:
 * - Reference: T_ref = 373.15 K (100°C), P_ref = 101325 Pa (1 atm)
 * - L/R ≈ 5120 K (effective latent heat / gas constant ratio for water)
 *
 * Examples:
 * - 101325 Pa (1 atm): 373.15 K (100°C)
 * - 50000 Pa (0.5 atm): ~355 K (~82°C)
 * - 1000 Pa (0.01 atm): ~280 K (~7°C)
 * - 100 Pa: ~260 K (-13°C)
 * - 0 Pa (vacuum): ~0 K (instant boiling)
 */
float calculateBoilingPoint(float pressure) {
  // Prevent division by zero and handle vacuum
  if (pressure < 1.0) {
    return 273.15; // In vacuum, water boils at freezing point
  }

  // Clausius-Clapeyron parameters for water
  const float L_OVER_R = 5120.0; // K - effective latent heat ratio
  const float T_REF = WATER_BOIL_POINT_1ATM; // 373.15 K
  const float P_REF = STANDARD_PRESSURE; // 101325 Pa

  // Calculate boiling point: T_boil = 1 / (1/T_ref - (1/L_R) * ln(P/P_ref))
  float pressureRatio = pressure / P_REF;
  float invTemp = (1.0 / T_REF) - (log(pressureRatio) / L_OVER_R);
  float T_boil = 1.0 / invTemp;

  // Clamp to physically reasonable range
  // Minimum: triple point of water (273.16 K)
  // Maximum: reference boiling point at 1 atm (no extrapolation to high pressure)
  return clamp(T_boil, 273.15, T_REF);
}

void main() {
  // Read current state from hydrology (dynamic)
  vec4 hydro = texture2D(previousHydrology, vUv);
  float iceThickness = hydro.r;           // meters of ice
  float waterThermalMass = hydro.g;       // 0-1, normalised indicator of water presence
  float waterDepth = hydro.b;             // meters (evolves with evaporation/freezing)
  float salinity = hydro.a;               // PSU (Practical Salinity Units - travels with water)

  // Read surface temperature and atmospheric pressure
  float T = texture2D(currentTemperature, vUv).r; // Surface temperature in Kelvin
  vec4 atmos = texture2D(atmosphereData, vUv);
  float P_local = atmos.g;                // Local atmospheric pressure in Pa

  // Calculate pressure- and salinity-dependent freezing point
  float freezingPoint = calculateFreezingPoint(P_local, salinity);

  // ===== ICE DYNAMICS (Branch-free) =====
  // Based on Stefan's problem: ice growth/melting driven by temperature difference
  // from freezing point, limited by latent heat and thermal conductivity
  // Uses smooth step and mix operations to avoid GPU branch divergence

  float tempDifference = freezingPoint - T;  // Positive when below freezing, negative when above

  // Compute freezing rate (when tempDifference > 0)
  // Symmetrized: both freeze and melt use same normalisation scale (15K)
  float normalisedFreezeDiff = clamp(tempDifference / 15.0, 0.0, 1.0);
  float freezeRate = MAX_FREEZE_RATE * normalisedFreezeDiff;

  // Smooth transition into freezing (threshold at 0.1K)
  float freezingWeight = smoothstep(-0.05, 0.15, tempDifference);

  // Compute melting rate (when tempDifference < 0)
  // Symmetrized: both freeze and melt use same normalisation scale (15K)
  float normalisedMeltDiff = clamp(-tempDifference / 15.0, 0.0, 1.0);
  float meltRate = MAX_MELT_RATE * normalisedMeltDiff;

  // Smooth transition into melting (threshold at -0.1K)
  float meltingWeight = smoothstep(0.15, -0.05, tempDifference);

  // Water presence check (needed for freezing)
  float hasWater = step(DEPTH_QUANTUM, waterDepth);

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

  // Quantise ice thickness to prevent floating point drift
  float newIceThickness = quantiseDepth(iceThickness + iceDelta);

  // Calculate actual ice change (after quantisation and mixing)
  // Positive when ice increases (freezing), negative when ice decreases (melting)
  float actualIceChange = newIceThickness - iceThickness;

  // Thermal mass follows phase state: liquid water (1.0) or ice (0.0)
  float thermalMassAfterFreeze = mix(waterThermalMass, 0.0, isFreezingCondition);
  float thermalMassAfterMelt = mix(thermalMassAfterFreeze, 1.0, meltingWeight * step(DEPTH_QUANTUM, newIceThickness));

  // Thermal mass transitions
  float newWaterThermalMass = mix(0.0, thermalMassAfterMelt, hasWater);

  // When ice completely melts, return to liquid water
  float hasIceNow = step(DEPTH_QUANTUM, newIceThickness);
  newWaterThermalMass = mix(1.0, newWaterThermalMass, hasIceNow);

  // ===== WATER EVAPORATION (Pressure-dependent) =====
  // Calculate boiling point based on local atmospheric pressure
  // Lower pressure → lower boiling point → easier evaporation
  float boilingPoint = calculateBoilingPoint(P_local);

  float waterBoilDifference = T - boilingPoint;  // Positive when above boiling point

  // Compute evaporation rate (proportional to temperature above boiling point)
  // Normalise aggressively: 0K above boiling = 0% rate, 10K above = 100% rate
  float normalisedEvapDiff = clamp(waterBoilDifference / 10.0, 0.0, 1.0);

  // Salty water evaporates slower than fresh water
  // 0 PSU (fresh): 100% evaporation rate
  // 35 PSU (ocean): ~65% evaporation rate
  // 100+ PSU (hypersaline): ~0% evaporation rate
  float salinityReductionFactor = 1.0 - (salinity / 100.0);
  float evaporationRate = MAX_EVAPORATION_RATE * normalisedEvapDiff * salinityReductionFactor;

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
  // CRITICAL: Limit evaporation to available water (cannot evaporate more than exists)
  float waterLossFromEvap = min(evaporationWeight * evaporationRate * canEvaporate, waterDepth);

  // Water <-> Ice phase change accounting
  // When ice increases (freezing): water is consumed
  // When ice decreases (melting): water is produced
  // Use actualIceChange to get exact 1:1 mass conservation
  float waterLossFromFreeze = max(0.0, actualIceChange);   // Positive when freezing

  // Only gain water from melting if there was actually ice to melt
  float hasIce = step(DEPTH_QUANTUM, iceThickness);
  float waterGainFromMelt = max(0.0, -actualIceChange) * hasIce;    // Positive when melting

  // Update water depth: subtract evaporation and freezing, add melting
  // Do all arithmetic BEFORE quantising to minimize cumulative rounding errors
  float waterDepthBeforeQuantise = waterDepth - waterLossFromEvap - waterLossFromFreeze + waterGainFromMelt;
  // Quantise to DEPTH_QUANTUM increments to prevent floating point drift
  float newWaterDepth = quantiseDepth(waterDepthBeforeQuantise);
  float newWaterThermalMass_evap = max(0.0, newWaterThermalMass - waterLossFromEvap);

  // Final water state: frozen, liquid, or evaporated
  newWaterThermalMass = newWaterThermalMass_evap;

  // Clamp values to valid ranges (no basin capacity - water can evaporate away)
  newIceThickness = clamp(newIceThickness, 0.0, 10000.0);
  newWaterThermalMass = clamp(newWaterThermalMass, 0.0, 1.0);
  newWaterDepth = clamp(newWaterDepth, 0.0, 10000.0);

  // Clear salinity if no water or ice present
  // Salinity is tied to water, so when all water/ice is gone, reset to 0 for fresh water accumulation
  float hasWaterOrIce = step(DEPTH_QUANTUM, newWaterDepth + newIceThickness);
  float newSalinity = mix(0.0, salinity, hasWaterOrIce);

  // DEBUG: Output diagnostic data to detect mass loss
  // Uncomment one of the following to debug:
  // gl_FragColor = vec4(actualIceChange, waterGainFromMelt, waterLossFromFreeze, hasIce);
  // gl_FragColor = vec4(iceThickness, iceDelta, newIceThickness, actualIceChange);
  // gl_FragColor = vec4(waterDepth, waterDepthBeforeQuantise, newWaterDepth, waterDepth - newWaterDepth);

  // Output new hydrology state
  // RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
  gl_FragColor = vec4(newIceThickness, newWaterThermalMass, newWaterDepth, newSalinity);
}

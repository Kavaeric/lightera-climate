precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousHydrology;      // Current frame hydrology: RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
uniform sampler2D currentTemperature;     // Surface temperature from climate layer (same frame) - RGBA = [surfaceTemperature, albedo, reserved, reserved]
uniform sampler2D atmosphereData;         // Atmospheric data from previous frame: RGBA = [T_atm, P_local, reserved, reserved]
uniform sampler2D terrainData;            // Static terrain: RGBA = [elevation, reserved, reserved, reserved]

// Physical constants
const float WATER_FREEZE_POINT = 273.15;  // K - freshwater freezing point (0°C) at 1 atm
const float STANDARD_PRESSURE = 101325.0; // Pa - standard atmospheric pressure (1 atm)
const float WATER_BOIL_POINT_1ATM = 373.15; // K - boiling point at 1 atm (100°C)

// Phase change rates (meters per frame)
const float MAX_FREEZE_RATE = 0.25;       // m/frame - maximum ice formation rate
const float MAX_MELT_RATE = 0.25;         // m/frame - maximum ice melting rate
const float MAX_EVAPORATION_RATE = 10.0;  // m/frame - maximum water evaporation rate

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
 * Calculate freezing point of water as a function of atmospheric pressure and salinity
 * Uses Clausius-Clapeyron equation for ice-water equilibrium
 */
float calculateFreezingPoint(float pressure, float salinity) {
  // Pressure effect on freezing point (small but physical)
  // dT = -0.0074 K/MPa × (P - P_ref) in MPa
  float pressureMPa = pressure / 1.0e6;
  float referencePressureMPa = STANDARD_PRESSURE / 1.0e6;
  float pressureEffect = -0.0074 * (pressureMPa - referencePressureMPa);

  // Salinity effect (dominant at ocean salinities)
  // T_freeze = 273.15 - 0.054 * salinity (degrees K depression per PSU)
  float salinityEffect = -0.054 * salinity;

  return WATER_FREEZE_POINT + pressureEffect + salinityEffect;
}

/**
 * Calculate boiling point of water as a function of atmospheric pressure
 * Uses simplified Clausius-Clapeyron equation
 */
float calculateBoilingPoint(float pressure) {
  if (pressure < 1.0) {
    return 273.15; // In vacuum, water boils at freezing point
  }

  const float L_OVER_R = 5120.0; // K - effective latent heat ratio
  const float T_REF = WATER_BOIL_POINT_1ATM; // 373.15 K
  const float P_REF = STANDARD_PRESSURE; // 101325 Pa

  float pressureRatio = pressure / P_REF;
  float invTemp = (1.0 / T_REF) - (log(pressureRatio) / L_OVER_R);
  float T_boil = 1.0 / invTemp;

  return clamp(T_boil, 273.15, T_REF);
}

void main() {
  // Read current state
  vec4 hydro = texture2D(previousHydrology, vUv);
  float iceThickness = hydro.r;
  float waterDepth = hydro.b;
  float salinity = hydro.a;

  // Read environmental conditions
  float T = texture2D(currentTemperature, vUv).r; // Surface temperature in Kelvin
  vec4 atmos = texture2D(atmosphereData, vUv);
  float P_local = atmos.g; // Local atmospheric pressure in Pa

  // Calculate phase transition temperatures
  float freezingPoint = calculateFreezingPoint(P_local, salinity);
  float boilingPoint = calculateBoilingPoint(P_local);

  // ===== PHASE CHANGES: FREEZING AND MELTING =====
  // Water freezes when T < freezing point
  // Ice melts when T > freezing point
  // Mass is conserved: 1 m³ water = 1 m³ ice (density difference handled elsewhere)

  float tempDifference = freezingPoint - T; // Positive when below freezing

  // Calculate freezing: only happens when below freezing point and water is available
  float isBelowFreezing = step(0.0, tempDifference); // 1.0 if below freezing, 0.0 otherwise
  float freezeRate = MAX_FREEZE_RATE * clamp(tempDifference / 15.0, 0.0, 1.0);
  float freezeAmount = freezeRate * isBelowFreezing;
  freezeAmount = min(freezeAmount, waterDepth); // Can't freeze more than available water
  // Quantise freeze amount to ensure 1:1 conversion precision, then re-check limit
  freezeAmount = quantiseDepth(freezeAmount);
  freezeAmount = min(freezeAmount, waterDepth); // Ensure we don't exceed available after quantisation

  // Calculate melting: only happens when above freezing point and ice is available
  float isAboveFreezing = step(0.0, -tempDifference); // 1.0 if above freezing, 0.0 otherwise
  float meltRate = MAX_MELT_RATE * clamp(-tempDifference / 15.0, 0.0, 1.0);
  float meltAmount = meltRate * isAboveFreezing;
  meltAmount = min(meltAmount, iceThickness); // Can't melt more than available ice
  // Quantise melt amount to ensure 1:1 conversion precision, then re-check limit
  meltAmount = quantiseDepth(meltAmount);
  meltAmount = min(meltAmount, iceThickness); // Ensure we don't exceed available after quantisation

  // Apply phase changes (mutually exclusive: either freezing or melting, never both)
  // 1:1 conversion: 1m ice melts to 1m water, 1m water freezes to 1m ice
  float newIceThickness = iceThickness - meltAmount + freezeAmount;
  float newWaterDepth = waterDepth - freezeAmount + meltAmount;

  // ===== EVAPORATION =====
  // Water evaporates when T > boiling point
  // Evaporation removes water from the system (no mass conservation)

  float tempAboveBoiling = T - boilingPoint; // Positive when above boiling
  float isAboveBoiling = step(0.0, tempAboveBoiling); // 1.0 if above boiling, 0.0 otherwise

  // Calculate evaporation rate
  float evapRate = MAX_EVAPORATION_RATE * clamp(tempAboveBoiling / 10.0, 0.0, 1.0);
  
  // Salty water evaporates slower
  float salinityFactor = 1.0 - clamp(salinity / 100.0, 0.0, 1.0);
  evapRate *= salinityFactor;

  // Only liquid water evaporates (ice sublimes separately if needed)
  // Evaporation is limited by available water
  float evaporation = evapRate * isAboveBoiling;
  evaporation = min(evaporation, newWaterDepth);
  newWaterDepth -= evaporation;

  // ===== QUANTISATION AND CLAMPING =====
  // Quantise all depths to prevent floating point drift
  newIceThickness = quantiseDepth(max(0.0, newIceThickness));
  newWaterDepth = quantiseDepth(max(0.0, newWaterDepth));

  // Clamp to reasonable maximums
  newIceThickness = clamp(newIceThickness, 0.0, 10000.0);
  newWaterDepth = clamp(newWaterDepth, 0.0, 10000.0);

  // ===== DERIVE THERMAL MASS =====
  // Thermal mass indicates phase: 1.0 = liquid water, 0.0 = ice or no water
  // This is derived from final state rather than tracked through updates
  float hasWater = step(DEPTH_QUANTUM, newWaterDepth);
  float hasIce = step(DEPTH_QUANTUM, newIceThickness);
  float newWaterThermalMass = hasWater * (1.0 - hasIce); // Liquid water only (not ice)

  // ===== SALINITY =====
  // Salinity travels with water/ice, cleared when all water is gone
  float hasWaterOrIce = step(DEPTH_QUANTUM, newWaterDepth + newIceThickness);
  float newSalinity = mix(0.0, salinity, hasWaterOrIce);

  // Output new hydrology state
  // RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
  gl_FragColor = vec4(newIceThickness, newWaterThermalMass, newWaterDepth, newSalinity);
}

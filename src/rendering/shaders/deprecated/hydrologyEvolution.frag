// Deprecated, replacing it with stuff in src/climate/pass

precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D previousHydrology;      // Current frame hydrology: RGBA = [waterDepth, iceThickness, unused, salinity]
uniform sampler2D currentTemperature;     // Surface temperature from climate layer (same frame) - RGBA = [surfaceTemperature, albedo, reserved, reserved]
uniform sampler2D atmosphereData;         // Atmospheric data from previous frame: RGBA = [T_atm, P_local, reserved, reserved]
uniform sampler2D terrainData;            // Static terrain: RGBA = [elevation, reserved, reserved, reserved]

// Physical constants
const float WATER_FREEZE_POINT = 273.15;  // K - freshwater freezing point (0°C) at 1 atm
const float STANDARD_PRESSURE = 101325.0; // Pa - standard atmospheric pressure (1 atm)
const float WATER_BOIL_POINT_1ATM = 373.15; // K - boiling point at 1 atm (100°C)

// Phase change rates (metres per frame)
const float MAX_FREEZE_RATE = 0.25;       // m/frame - maximum ice formation rate
const float MAX_MELT_RATE = 0.25;         // m/frame - maximum ice melting rate
const float MAX_EVAPORATION_RATE = 10.0;  // m/frame - maximum water evaporation rate

// Quantisation increment for water/ice depths (prevents floating point drift)
// NOTE: This value must match DEPTH_QUANTUM in src/config/simulationConfig.ts
const float DEPTH_QUANTUM = 0.1; // metres - all depths quantised to 10cm increments

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

  // PHYSICS REMOVED: Just pass through unchanged
  // TODO: Rebuild physics architecture

  // Output new hydrology state
  // RGBA = [waterDepth, iceThickness, unused, salinity]
  gl_FragColor = hydro;
}

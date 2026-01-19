/**
 * Pass 4: Vertical mixing & convection.
 *
 * Handles vertical transport between atmospheric layers:
 * - Convective adjustment when lapse rate exceeds dry/moist adiabatic.
 * - Moisture transport upward through convection.
 * - Simple cloud parameterization based on relative humidity.
 *
 * This pass runs after radiation and hydrology to adjust for unstable
 * temperature profiles created by surface heating.
 */

precision highp float;

#include "../../../rendering/shaders/utility/textureAccessors.glsl"
#include "../../shaders/constants.glsl"
#include "../../shaders/generated/atmosphereLayerAccessors.glsl"

in vec2 vUv;

// === PHYSICS PARAMETERS ===
uniform float dt;                       // seconds
uniform float surfaceGravity;           // m/s²
uniform float surfacePressure;          // Pa
uniform float atmosphereScaleHeight;    // m
uniform float dryAdiabaticLapseRate;    // K/m

// Mixing timescale (seconds) - how quickly convection acts
const float CONVECTION_TIMESCALE = 3600.0; // 1 hour

// Cloud formation threshold (relative humidity)
const float CLOUD_RH_THRESHOLD = 0.8;

// === OUTPUTS (MRT) ===
layout(location = 0) out vec4 outLayer0Thermo;
layout(location = 1) out vec4 outLayer1Thermo;
layout(location = 2) out vec4 outLayer2Thermo;
layout(location = 3) out vec4 outLayer0Dynamics;
layout(location = 4) out vec4 outLayer1Dynamics;
layout(location = 5) out vec4 outLayer2Dynamics;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate saturation specific humidity using Clausius-Clapeyron approximation.
 * Returns kg/kg (specific humidity at saturation).
 */
float saturationHumidity(float temperature, float pressure) {
  // Saturation vapour pressure (Tetens formula)
  float tempC = temperature - 273.15;
  float es = 610.78 * exp((17.27 * tempC) / (tempC + 237.3)); // Pa

  // Saturation specific humidity
  // q_sat = 0.622 * e_s / (p - 0.378 * e_s)
  float qsat = 0.622 * es / (pressure - 0.378 * es);
  return max(qsat, 0.0001); // Minimum to avoid division by zero
}

/**
 * Calculate relative humidity.
 */
float relativeHumidity(float humidity, float temperature, float pressure) {
  float qsat = saturationHumidity(temperature, pressure);
  return humidity / qsat;
}

/**
 * Calculate moist adiabatic lapse rate.
 * Accounts for latent heat release during condensation.
 */
float moistAdiabaticLapseRate(float temperature, float pressure) {
  // Simplified: moist lapse rate is roughly 60-70% of dry
  // More accurate would use full formula with latent heat
  float qsat = saturationHumidity(temperature, pressure);
  float moistFactor = 1.0 / (1.0 + 2500.0 * qsat / (1004.0 * temperature));
  return dryAdiabaticLapseRate * moistFactor;
}

// =============================================================================
// MAIN
// =============================================================================

void main() {
  // === READ CURRENT LAYER STATES ===
  Layer0ThermoState layer0 = getLayer0ThermoState(vUv);
  Layer1ThermoState layer1 = getLayer1ThermoState(vUv);
  Layer2ThermoState layer2 = getLayer2ThermoState(vUv);

  vec2 wind0 = getLayer0Wind(vUv);
  float omega0 = getLayer0Omega(vUv);
  vec2 wind1 = getLayer1Wind(vUv);
  float omega1 = getLayer1Omega(vUv);
  vec2 wind2 = getLayer2Wind(vUv);
  float omega2 = getLayer2Omega(vUv);

  // Working copies of temperatures and humidities
  float temp0 = layer0.temperature;
  float temp1 = layer1.temperature;
  float temp2 = layer2.temperature;
  float humid0 = layer0.humidity;
  float humid1 = layer1.humidity;
  float humid2 = layer2.humidity;
  float cloud0 = layer0.cloudFraction;
  float cloud1 = layer1.cloudFraction;
  float cloud2 = layer2.cloudFraction;

  // Calculate layer midpoint altitudes from pressure fractions
  float layer0PressureMid = LAYER_0_REF_PRESSURE_FRACTION * surfacePressure;
  float layer1PressureMid = LAYER_1_REF_PRESSURE_FRACTION * surfacePressure;
  float layer2PressureMid = LAYER_2_REF_PRESSURE_FRACTION * surfacePressure;

  float layer0Midpoint = calculateAltitude(layer0PressureMid, surfacePressure, atmosphereScaleHeight);
  float layer1Midpoint = calculateAltitude(layer1PressureMid, surfacePressure, atmosphereScaleHeight);
  float layer2Midpoint = calculateAltitude(layer2PressureMid, surfacePressure, atmosphereScaleHeight);

  // ==========================================================================
  // CONVECTIVE ADJUSTMENT (Layer 0 ↔ Layer 1)
  // ==========================================================================

  // Calculate actual lapse rate between layer 0 and layer 1
  float dz_01 = layer1Midpoint - layer0Midpoint;
  float actualLapseRate_01 = (temp0 - temp1) / dz_01;

  // Critical lapse rate (use moist if humid, dry otherwise)
  float avgTemp_01 = (temp0 + temp1) * 0.5;
  float avgPressure_01 = (layer0.pressure + layer1.pressure) * 0.5;
  float avgHumid_01 = (humid0 + humid1) * 0.5;
  float rh_01 = relativeHumidity(avgHumid_01, avgTemp_01, avgPressure_01);

  float criticalLapseRate_01 = rh_01 > 0.5
    ? moistAdiabaticLapseRate(avgTemp_01, avgPressure_01)
    : dryAdiabaticLapseRate;

  // If actual lapse rate exceeds critical, the atmosphere is unstable
  // Mix temperatures toward neutral profile
  if (actualLapseRate_01 > criticalLapseRate_01) {
    // Calculate mixing fraction based on timestep and convection timescale
    float mixFraction = min(dt / CONVECTION_TIMESCALE, 0.5);

    // Target temperatures for neutral buoyancy
    float meanTemp_01 = (temp0 + temp1) * 0.5;
    float targetTemp0 = meanTemp_01 + criticalLapseRate_01 * dz_01 * 0.5;
    float targetTemp1 = meanTemp_01 - criticalLapseRate_01 * dz_01 * 0.5;

    // Mix toward target
    temp0 = mix(temp0, targetTemp0, mixFraction);
    temp1 = mix(temp1, targetTemp1, mixFraction);

    // No humidity transport - humidity remains constant

    // Update vertical velocity (positive = upward in pressure coords = negative omega)
    omega0 = mix(omega0, -10.0, mixFraction); // Upward motion
    omega1 = mix(omega1, -5.0, mixFraction);
  }

  // ==========================================================================
  // CONVECTIVE ADJUSTMENT (Layer 1 ↔ Layer 2)
  // ==========================================================================

  float dz_12 = layer2Midpoint - layer1Midpoint;
  float actualLapseRate_12 = (temp1 - temp2) / dz_12;

  float avgTemp_12 = (temp1 + temp2) * 0.5;
  float avgPressure_12 = (layer1.pressure + layer2.pressure) * 0.5;
  float avgHumid_12 = (humid1 + humid2) * 0.5;
  float rh_12 = relativeHumidity(avgHumid_12, avgTemp_12, avgPressure_12);

  float criticalLapseRate_12 = rh_12 > 0.5
    ? moistAdiabaticLapseRate(avgTemp_12, avgPressure_12)
    : dryAdiabaticLapseRate;

  if (actualLapseRate_12 > criticalLapseRate_12) {
    float mixFraction = min(dt / CONVECTION_TIMESCALE, 0.5);

    float meanTemp_12 = (temp1 + temp2) * 0.5;
    float targetTemp1_from12 = meanTemp_12 + criticalLapseRate_12 * dz_12 * 0.5;
    float targetTemp2 = meanTemp_12 - criticalLapseRate_12 * dz_12 * 0.5;

    temp1 = mix(temp1, targetTemp1_from12, mixFraction);
    temp2 = mix(temp2, targetTemp2, mixFraction);

    // No humidity transport - humidity remains constant

    omega1 = mix(omega1, -5.0, mixFraction);
    omega2 = mix(omega2, -2.0, mixFraction);
  }

  // ==========================================================================
  // CLOUDS
  // ==========================================================================

  // Calculate relative humidities
  float rh0 = relativeHumidity(humid0, temp0, layer0.pressure);
  float rh1 = relativeHumidity(humid1, temp1, layer1.pressure);
  float rh2 = relativeHumidity(humid2, temp2, layer2.pressure);

  // Cloud fraction increases when RH exceeds threshold
  // Simple linear parameterization
  float targetCloud0 = clamp((rh0 - CLOUD_RH_THRESHOLD) / (1.0 - CLOUD_RH_THRESHOLD), 0.0, 1.0);
  float targetCloud1 = clamp((rh1 - CLOUD_RH_THRESHOLD) / (1.0 - CLOUD_RH_THRESHOLD), 0.0, 1.0);
  float targetCloud2 = clamp((rh2 - CLOUD_RH_THRESHOLD) / (1.0 - CLOUD_RH_THRESHOLD), 0.0, 1.0);

  // Smooth transition toward target cloud fraction
  float cloudTimescale = 3600.0; // 1 hour for cloud formation/dissipation
  float cloudMix = min(dt / cloudTimescale, 0.5);
  cloud0 = mix(cloud0, targetCloud0, cloudMix);
  cloud1 = mix(cloud1, targetCloud1, cloudMix);
  cloud2 = mix(cloud2, targetCloud2, cloudMix);

  // No supersaturation condensation - humidity remains constant

  // ==========================================================================
  // VERTICAL VELOCITY DECAY
  // ==========================================================================

  // Vertical velocities decay over time (return to equilibrium)
  float omegaDecay = exp(-dt / 3600.0); // 1-hour decay timescale
  omega0 *= omegaDecay;
  omega1 *= omegaDecay;
  omega2 *= omegaDecay;

  // ==========================================================================
  // OUTPUT
  // ==========================================================================

  // Ensure humidity stays positive
  humid0 = max(humid0, 0.0);
  humid1 = max(humid1, 0.0);
  humid2 = max(humid2, 0.0);

  // Output thermo states (pressure unchanged)
  outLayer0Thermo = packLayer0Thermo(temp0, layer0.pressure, humid0, cloud0);
  outLayer1Thermo = packLayer1Thermo(temp1, layer1.pressure, humid1, cloud1);
  outLayer2Thermo = packLayer2Thermo(temp2, layer2.pressure, humid2, cloud2);

  // Output dynamics states (winds unchanged, omega updated)
  outLayer0Dynamics = packLayer0Dynamics(wind0.x, wind0.y, omega0);
  outLayer1Dynamics = packLayer1Dynamics(wind1.x, wind1.y, omega1);
  outLayer2Dynamics = packLayer2Dynamics(wind2.x, wind2.y, omega2);
}

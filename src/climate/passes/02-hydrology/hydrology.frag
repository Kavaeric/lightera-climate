/**
 * Pass 2: Hydrology with boundary layer interaction.
 *
 * Handles water cycle dynamics with multi-layer atmosphere:
 * - Ice/water phase transitions (freezing and melting).
 * - Water vaporisation at temperatures above boiling point.
 * - Latent heat effects on surface temperature.
 * - Evaporation adds humidity to Layer 0 (boundary layer).
 * - Precipitation draws from Layer 0 humidity (future).
 *
 * This version integrates with the multi-layer atmosphere system,
 * directing evaporated water to the boundary layer specifically.
 */

precision highp float;

#include "../../../rendering/shaders/utility/textureAccessors.glsl"
#include "../../shaders/constants.glsl"
#include "../../shaders/waterVapour.glsl"
#include "../../shaders/surfaceThermal.glsl"
#include "../../shaders/generated/atmosphereLayerAccessors.glsl"

in vec2 vUv;

// Input uniforms
uniform float dt;              // Timestep in seconds
uniform float surfaceGravity;  // m/s²
uniform float surfacePressure; // Pa - reference surface pressure

// Output: Hydrology + surface + layer 0 thermo (layers 1-2 passed through)
layout(location = 0) out vec4 outHydrologyState;
layout(location = 1) out vec4 outAuxiliary;
layout(location = 2) out vec4 outSurfaceState;
layout(location = 3) out vec4 outLayer0Thermo;

// Phase change constants
const float PHASE_CHANGE_HEAT_TRANSFER_COEFF_AIR = 100.0; // W/(m²·K)

// Approximation of vaporisation temperature as function of pressure
float getVaporisationPoint(float pressure) {
  float logP = log(pressure);
  return (-4965.11 + 23.519 * logP) / (-24.0385 + logP);
}

// Melting point as function of salinity
float getMeltingPoint(float salinity) {
  return 273.15 - (0.054 * salinity);
}

// Effective heat transfer coefficient with ice insulation
float getEffectiveHeatTransferCoeff(float iceThickness) {
  float thermalResistance = 1.0 / PHASE_CHANGE_HEAT_TRANSFER_COEFF_AIR +
                            iceThickness / MATERIAL_ICE_THERMAL_CONDUCTIVITY;
  return 1.0 / thermalResistance;
}

// Phase change rate from heat flux
float calculatePhaseChangeRate(float deltaT, float iceThickness) {
  float h_eff = getEffectiveHeatTransferCoeff(iceThickness);
  float heatFlux = h_eff * deltaT;
  return heatFlux / (MATERIAL_ICE_DENSITY * MATERIAL_ICE_LATENT_HEAT_FUSION);
}

// Vaporisation rate from heat flux
float calculateVaporisationRate(float deltaT) {
  float heatFlux = PHASE_CHANGE_HEAT_TRANSFER_COEFF_AIR * deltaT;
  return heatFlux / (MATERIAL_WATER_DENSITY * MATERIAL_WATER_LATENT_HEAT_VAPORISATION);
}

/**
 * Calculate evaporation rate based on Dalton's evaporation law.
 * Evaporation occurs when the atmosphere is not saturated, even below boiling.
 *
 * E = k × (q_sat - q) × wind_factor
 *
 * Where:
 * - k = transfer coefficient
 * - q_sat = saturation humidity at surface temperature
 * - q = actual humidity in boundary layer
 */
float calculateEvaporationRate(float surfaceTemp, float boundaryHumidity, float boundaryPressure) {
  // Saturation vapour pressure at surface temperature (Tetens formula)
  float tempC = surfaceTemp - 273.15;
  float es = 610.78 * exp((17.27 * tempC) / (tempC + 237.3)); // Pa

  // Saturation specific humidity at surface
  float qsat = 0.622 * es / (boundaryPressure - 0.378 * es);

  // Humidity deficit
  float humidityDeficit = max(qsat - boundaryHumidity, 0.0);

  // Transfer coefficient (simplified, assumes moderate wind)
  // Units: kg/(m²·s) per (kg/kg) = m/s effectively
  float transferCoeff = 0.001; // About 1mm/s per 100% humidity deficit

  return transferCoeff * humidityDeficit;
}

void main() {
  // === READ CURRENT STATE ===
  vec4 hydrologyState = texture(hydrologyData, vUv);
  float waterDepth = hydrologyState.r;
  float iceThickness = hydrologyState.g;
  float salinity = hydrologyState.a;

  vec4 surfaceState = texture(surfaceData, vUv);
  float surfaceTemperature = surfaceState.r;
  float surfaceAlbedo = surfaceState.a;

  vec4 currentAuxiliary = texture(auxiliaryData, vUv);

  // Read boundary layer (layer 0) state
  Layer0ThermoState layer0 = getLayer0ThermoState(vUv);

  // Calculate phase transition temperatures
  float meltingPoint = getMeltingPoint(salinity);
  float boilingPoint = getVaporisationPoint(layer0.pressure);

  // === PHASE CHANGE DYNAMICS (Ice ↔ Water) ===
  float deltaT = surfaceTemperature - meltingPoint;
  float phaseChangeAmount = calculatePhaseChangeRate(deltaT, iceThickness) * dt;

  float newWaterDepth = waterDepth;
  float newIceThickness = iceThickness;
  float actualPhaseChange = 0.0;

  // Branchless melt/freeze logic
  float meltAmount = min(max(phaseChangeAmount, 0.0), iceThickness);
  float freezeAmount = min(max(-phaseChangeAmount, 0.0), waterDepth);

  newIceThickness = iceThickness - meltAmount + freezeAmount;
  newWaterDepth = waterDepth + meltAmount - freezeAmount;
  actualPhaseChange = meltAmount - freezeAmount;

  newWaterDepth = max(0.0, newWaterDepth);
  newIceThickness = max(0.0, newIceThickness);

  // === VAPORISATION (above boiling point) ===
  float deltaT_vaporisation = surfaceTemperature - boilingPoint;
  float vaporisationAmount = 0.0;

  float vaporiseCond = step(0.0, deltaT_vaporisation) * step(0.0, newWaterDepth);
  float vaporisationRate = calculateVaporisationRate(deltaT_vaporisation) * vaporiseCond;
  float potentialVaporisation = vaporisationRate * dt;

  vaporisationAmount = min(potentialVaporisation, newWaterDepth) * vaporiseCond;
  newWaterDepth = max(0.0, newWaterDepth - vaporisationAmount);

  // No below-boiling evaporation yet
  float evaporationAmount = 0.0;

  // Humidity remains unchanged (no dynamic humidity changes)
  float newLayer0Humidity = layer0.humidity;

  // === LATENT HEAT CORRECTIONS ===
  float fusionLatentHeatEnergy = actualPhaseChange * MATERIAL_ICE_DENSITY * MATERIAL_ICE_LATENT_HEAT_FUSION;
  float vapourLatentHeatEnergy = vaporisationAmount * MATERIAL_WATER_DENSITY * MATERIAL_WATER_LATENT_HEAT_VAPORISATION;
  float evapLatentHeatEnergy = evaporationAmount * MATERIAL_WATER_DENSITY * MATERIAL_WATER_LATENT_HEAT_VAPORISATION;
  float totalLatentHeatEnergy = fusionLatentHeatEnergy + vapourLatentHeatEnergy + evapLatentHeatEnergy;

  float heatCapacity = getSurfaceHeatCapacity(newWaterDepth, newIceThickness);
  float latentHeatTemperatureChange = -totalLatentHeatEnergy / heatCapacity;

  float newSurfaceTemperature = surfaceTemperature + latentHeatTemperatureChange;

  // === SALINITY UPDATE ===
  float hasWaterOrIce = step(1e-6, newWaterDepth) + step(1e-6, newIceThickness);
  float newSalinity = salinity * min(hasWaterOrIce, 1.0);

  // === SURFACE ALBEDO UPDATE ===
  float newSurfaceAlbedo = getAlbedo(newWaterDepth, newIceThickness, MATERIAL_ROCK_ALBEDO_VISIBLE);

  // === OUTPUT ===

  // Hydrology state
  outHydrologyState = packHydrologyData(newWaterDepth, newIceThickness, newSalinity);

  // Compute water state (0 = solid, 0.5 = liquid, 1 = gas)
  float waterState = 0.5; // Default to liquid
  if (newIceThickness > 0.01) {
    // Ice present - solid state
    waterState = 0.0;
  } else if (newSurfaceTemperature > boilingPoint) {
    // Above boiling point - gas state
    waterState = 1.0;
  } else if (newWaterDepth > 0.01) {
    // Water present and not frozen - liquid state
    waterState = 0.5;
  } else {
    // No water/ice - use temperature to indicate potential state
    if (newSurfaceTemperature < meltingPoint) {
      waterState = 0.0; // Would be solid if water present
    } else if (newSurfaceTemperature > boilingPoint) {
      waterState = 1.0; // Would be gas if water present
    }
  }

  // Auxiliary (update water state in G channel, preserve R channel from radiation pass)
  outAuxiliary = vec4(currentAuxiliary.r, waterState, currentAuxiliary.ba);

  // Surface state
  outSurfaceState = packSurfaceData(newSurfaceTemperature, newSurfaceAlbedo);

  // Layer 0 thermo (updated humidity, other values unchanged)
  outLayer0Thermo = packLayer0Thermo(
    layer0.temperature,
    layer0.pressure,
    newLayer0Humidity,
    layer0.cloudFraction
  );
}

/**
 * Pass 0: Initialisation
 *
 * Initialises all simulation state textures on first load or when importing terrain.
 * This shader only runs once on climate initialisation.
 *
 * This handles:
 * - Initial temperature (surface and atmosphere)
 * - Initial pressure (atmosphere)
 * - Initial albedo (surface, calculated from hydrology state)
 * - Initial water/ice distribution (hydrology)
 * - Initial precipitable water (atmosphere)
 */

precision highp float;

#include "../../../rendering/shaders/utility/textureAccessors.glsl"
#include "../../shaders/constants.glsl"
#include "../../shaders/waterVapour.glsl"

in vec2 vUv;

// Input uniforms
uniform float initAtmospherePressure;   // Initial dry atmospheric pressure (Pa)
uniform float initPrecipitableWater;    // Initial precipitable water in atmosphere (mm)
uniform float surfaceGravity;           // Surface gravity (m/s²)
uniform float solarFlux;                // Initial solar flux at top of atmosphere (W/m²)

// Multiple render targets
layout(location = 0) out vec4 outSurfaceState;     // RGBA = [temperature, -, -, albedo]
layout(location = 1) out vec4 outAtmosphereState;  // RGBA = [temperature, pressure, precipitableWater, albedo]
layout(location = 2) out vec4 outHydrologyState;   // RGBA = [waterDepth, iceThickness, salinity, -]

void main() {
  // Sample terrain data
  float elevation = getElevation(vUv);

  // Fill areas below sea level with water
  float waterDepth = max(0.0, -elevation);
  float iceThickness = 0.0;

  // Calculate effective albedo based on surface material
  // Same logic as getAlbedo in surfaceThermal.glsl
  float hasWater = step(0.001, waterDepth);
  float hasIce = step(0.001, iceThickness);

  float albedo = MATERIAL_ROCK_ALBEDO_VISIBLE;
  albedo = mix(albedo, MATERIAL_WATER_ALBEDO_VISIBLE, hasWater);
  albedo = mix(albedo, MATERIAL_ICE_ALBEDO_VISIBLE, hasIce);

  // Set the pre-generated water to be saline
  float salinity = mix(0.0, 35.0, hasWater);

  // Estimate the greenhouse effect temperature
  // Naiive use of the Stephen-Boltzmann law would estimate Earth (with an albedo of 0.3) as being 255K
  // So we'll approximate the greenhouse effect as every 3000 Pa of pressure adding 1K to the temperature
  // This would result in Earth (with a surface pressure of 101,325 Pa) being 288K
  float estimatedGreenhouseTemperature = initAtmospherePressure / 3000.0;

  // Then estimate the initial temperature based on the Stephan-Boltzmann law
  // and take the estimated greenhouse effect temperature into account
  float estimatedTemperature =
    max(COSMIC_BACKGROUND_TEMP, // Minimum temperature is the cosmic background temperature
        pow((solarFlux * (1.0 - albedo)) / (4.0 * STEFAN_BOLTZMANN_CONST), 0.25) +
        estimatedGreenhouseTemperature);

  // Initialise surface state
  // RGBA = [temperature, -, -, albedo]
  outSurfaceState = vec4(estimatedTemperature, 0.0, 0.0, albedo);

  // Initialise atmosphere state
  // RGBA = [temperature, pressure, precipitableWater, albedo]
  // Atmosphere starts with no albedo (no cloud cover initially)
  // Total pressure = dry pressure + water vapor partial pressure (Dalton's Law)
  float waterVapourPressure = calculateWaterVapourPressure(initPrecipitableWater, surfaceGravity);
  float totalPressure = initAtmospherePressure + waterVapourPressure;
  outAtmosphereState = vec4(
    estimatedTemperature,
    totalPressure,
    initPrecipitableWater,
    0.0  // No cloud albedo initially
  );

  // Initialise hydrology state
  // RGBA = [waterDepth, iceThickness, -, salinity]
  outHydrologyState = vec4(waterDepth, iceThickness, 0.0, salinity);
}

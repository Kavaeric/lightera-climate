/**
 * Pass 0: Initialisation of climate simulation data textures.
 */

precision highp float;

#include "../../shaders/constants.glsl"
#include "../../shaders/waterVapour.glsl"
#include "../../shaders/generated/atmosphereLayerAccessors.glsl"

in vec2 vUv;

// Input uniforms
uniform sampler2D terrainData;          // Terrain elevation texture
uniform float initSurfacePressure;      // Initial dry surface pressure (Pa)
uniform float initPrecipitableWater;    // Total column water (mm)
uniform float surfaceGravity;           // m/s²
uniform float solarFlux;                // W/m²

// Minimal terrain accessor (don't include full textureAccessors.glsl to avoid unused uniforms)
float getElevation(vec2 uv) {
  return texture(terrainData, uv).r;
}

// Multiple render targets (8 outputs)
layout(location = 0) out vec4 outSurfaceState;     // Surface: temp, -, -, albedo
layout(location = 1) out vec4 outHydrologyState;   // Hydrology: water, ice, -, salinity
layout(location = 2) out vec4 outLayer0Thermo;     // Layer 0: temp, pressure, humidity, cloud
layout(location = 3) out vec4 outLayer1Thermo;     // Layer 1: temp, pressure, humidity, cloud
layout(location = 4) out vec4 outLayer2Thermo;     // Layer 2: temp, pressure, humidity, cloud
layout(location = 5) out vec4 outLayer0Dynamics;   // Layer 0: windU, windV, omega, -
layout(location = 6) out vec4 outLayer1Dynamics;   // Layer 1: windU, windV, omega, -
layout(location = 7) out vec4 outLayer2Dynamics;   // Layer 2: windU, windV, omega, -

void main() {
  // === SURFACE AND HYDROLOGY ===

  float elevation = getElevation(vUv);

  // Fill areas below sea level with water
  float waterDepth = max(0.0, -elevation);
  float iceThickness = 0.0;

  // Calculate effective albedo
  float hasWater = step(0.001, waterDepth);
  float hasIce = step(0.001, iceThickness);

  float albedo = MATERIAL_ROCK_ALBEDO_VISIBLE;
  albedo = mix(albedo, MATERIAL_WATER_ALBEDO_VISIBLE, hasWater);
  albedo = mix(albedo, MATERIAL_ICE_ALBEDO_VISIBLE, hasIce);

  // Salinity for ocean water
  float salinity = mix(0.0, 35.0, hasWater);

  // Estimate greenhouse effect
  // This is a rough estimate based on the Earth's greenhouse effect; the value here
  // results in an initialised surface temperature of about 288K (15°C).
  float estimatedGreenhouseTemperature = initSurfacePressure / 4800.0;

  // Initial surface temperature from Stefan-Boltzmann + greenhouse
  float surfaceTemperature =
    max(COSMIC_BACKGROUND_TEMP,
        pow((solarFlux * (1.0 - albedo)) / (4.0 * STEFAN_BOLTZMANN_CONST), 0.25) +
        estimatedGreenhouseTemperature);

  // === MULTI-LAYER INITIALISATION ===

  // All layers get the same temperature (no lapse rate)
  float layerTemperature = surfaceTemperature;

  // All layers get equal share of pressure
  float layerPressure = initSurfacePressure / 3.0;

  // Calculate actual layer masses from pressure differences
  // Use pressure fractions from schema
  float layer0PressureBottom = LAYER_0_PRESSURE_BOTTOM * initSurfacePressure;
  float layer0PressureTop = LAYER_0_PRESSURE_TOP * initSurfacePressure;
  float layer1PressureBottom = LAYER_1_PRESSURE_BOTTOM * initSurfacePressure;
  float layer1PressureTop = LAYER_1_PRESSURE_TOP * initSurfacePressure;
  float layer2PressureBottom = LAYER_2_PRESSURE_BOTTOM * initSurfacePressure;
  float layer2PressureTop = LAYER_2_PRESSURE_TOP * initSurfacePressure;

  float layer0Mass = (layer0PressureBottom - layer0PressureTop) / surfaceGravity; // kg/m²
  float layer1Mass = (layer1PressureBottom - layer1PressureTop) / surfaceGravity; // kg/m²
  float layer2Mass = (layer2PressureBottom - layer2PressureTop) / surfaceGravity; // kg/m²
  float totalMass = layer0Mass + layer1Mass + layer2Mass;

  // Distribute total precipitable water proportional to layer mass
  // This ensures column-integrated value matches input exactly
  float layer0Humidity = (initPrecipitableWater * layer0Mass / totalMass) / layer0Mass; // kg/kg
  float layer1Humidity = (initPrecipitableWater * layer1Mass / totalMass) / layer1Mass; // kg/kg
  float layer2Humidity = (initPrecipitableWater * layer2Mass / totalMass) / layer2Mass; // kg/kg

  // No clouds initially
  float layerCloud = 0.0;

  // No winds initially
  float windU = 0.0;
  float windV = 0.0;
  float omega = 0.0;

  // === OUTPUT ===

  // Surface state (unchanged)
  outSurfaceState = vec4(surfaceTemperature, 0.0, 0.0, albedo);

  // Hydrology state (unchanged)
  outHydrologyState = vec4(waterDepth, iceThickness, 0.0, salinity);

  // All 3 layers get identical values
  outLayer0Thermo = packLayer0Thermo(layerTemperature, layerPressure, layer0Humidity, layerCloud);
  outLayer1Thermo = packLayer1Thermo(layerTemperature, layerPressure, layer1Humidity, layerCloud);
  outLayer2Thermo = packLayer2Thermo(layerTemperature, layerPressure, layer2Humidity, layerCloud);

  // All 3 layers have zero dynamics
  outLayer0Dynamics = packLayer0Dynamics(windU, windV, omega);
  outLayer1Dynamics = packLayer1Dynamics(windU, windV, omega);
  outLayer2Dynamics = packLayer2Dynamics(windU, windV, omega);
}

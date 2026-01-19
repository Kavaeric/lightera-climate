/**
 * Pass 1: Radiative transfer through multiple atmospheric layers.
 *
 * Implements two-stream approximation for radiative transfer through 3 atmospheric layers:
 * - Layer 0: Boundary layer (0-2km)
 * - Layer 1: Troposphere (2-10km)
 * - Layer 2: Stratosphere (10-50km)
 *
 * SHORTWAVE (Solar):
 * - Downward sweep from TOA to surface.
 * - Each layer absorbs based on cloud fraction and water content.
 * - Surface absorbs remainder after albedo reflection.
 *
 * LONGWAVE (Thermal):
 * - Surface emits upward (Stefan-Boltzmann).
 * - Each layer absorbs and re-emits (Kirchhoff's law).
 * - Two-stream: upward and downward fluxes at each layer boundary.
 * - Back-radiation from all layers creates greenhouse effect.
 */

precision highp float;

#include "../../../rendering/shaders/utility/textureAccessors.glsl"
#include "../../shaders/constants.glsl"
#include "../../shaders/kDistribution.glsl"
#include "../../shaders/waterVapour.glsl"
#include "../../shaders/surfaceThermal.glsl"
#include "../../shaders/generated/atmosphereLayerAccessors.glsl"

in vec2 vUv;

// === ORBITAL PARAMETERS (for shortwave) ===
uniform float axialTilt;          // degrees
uniform float yearProgress;       // 0-1
uniform float subsolarLon;        // degrees
uniform float solarFlux;          // W/m²

// === PHYSICS PARAMETERS ===
uniform float dt;                 // seconds
uniform float surfacePressure;    // Pa
uniform float surfaceGravity;     // m/s²

// === PER-LAYER HEAT CAPACITIES ===
// Pre-calculated in TypeScript based on layer mass
uniform float layer0HeatCapacity; // J/(m²·K)
uniform float layer1HeatCapacity;
uniform float layer2HeatCapacity;

// === OUTPUTS (MRT - Multiple Render Targets) ===
layout(location = 0) out vec4 outSurfaceState;    // Surface temperature + albedo
layout(location = 1) out vec4 outLayer0Thermo;    // Layer 0: temp, pressure, humidity, cloud
layout(location = 2) out vec4 outLayer1Thermo;    // Layer 1: temp, pressure, humidity, cloud
layout(location = 3) out vec4 outLayer2Thermo;    // Layer 2: temp, pressure, humidity, cloud
layout(location = 4) out vec4 outAuxiliary;       // Diagnostic: TOA flux, surface net, etc.

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

float deg2rad(float deg) {
  return deg * PI / 180.0;
}

float calculateSubsolarLatitude(float tilt, float progress) {
  float orbitAngle = progress * 2.0 * PI;
  return tilt * sin(orbitAngle);
}

/**
 * Calculate layer emissivity from humidity and cloud fraction.
 * Higher humidity and cloud cover = higher emissivity (more absorption).
 */
float calculateLayerEmissivity(float humidity, float cloudFraction, float pressure) {
  // Base emissivity from water vapour (humidity in kg/kg)
  // Approximate: more humid = more opaque to IR
  float h2oEffect = clamp(humidity * 100.0, 0.0, 0.5); // Cap at 0.5

  // Cloud contribution (clouds are nearly black body in IR)
  float cloudEffect = cloudFraction * 0.9;

  // Pressure scaling (thicker layers absorb more)
  float pressureScale = pressure / surfacePressure;

  // Combined emissivity (not exceeding 1)
  return clamp(h2oEffect + cloudEffect * pressureScale, 0.0, 0.95);
}

/**
 * Calculate shortwave absorption by a layer.
 * Clouds absorb some solar radiation; clear sky transmits fully.
 */
float calculateLayerSWAbsorption(float cloudFraction) {
  return cloudFraction * 0.1;
}

/**
 * Calculate shortwave reflection by a layer (cloud albedo).
 */
float calculateLayerSWReflection(float cloudFraction) {
  // Cloud albedo effect
  return cloudFraction * 0.5; // Clouds reflect up to 50% when fully covered
}

// =============================================================================
// MAIN
// =============================================================================

void main() {
  // Read cell position
  vec2 cellLatLon = getCellLatLon(vUv);

  // === READ CURRENT SURFACE STATE ===
  vec4 surfaceState = texture(surfaceData, vUv);
  float surfaceTemperature = surfaceState.r;
  float surfaceAlbedo = surfaceState.a;

  // Read hydrology for surface properties
  vec4 hydrologyState = texture(hydrologyData, vUv);
  float waterDepth = hydrologyState.r;
  float iceThickness = hydrologyState.g;

  // === READ LAYER STATES ===
  Layer0ThermoState layer0 = getLayer0ThermoState(vUv);
  Layer1ThermoState layer1 = getLayer1ThermoState(vUv);
  Layer2ThermoState layer2 = getLayer2ThermoState(vUv);

  // ==========================================================================
  // SHORTWAVE CALCULATION (Downward sweep: TOA → Surface)
  // ==========================================================================

  // Calculate subsolar point
  float subsolarLat = calculateSubsolarLatitude(axialTilt, yearProgress);
  float subsolar_lat_rad = deg2rad(subsolarLat);
  float subsolar_lon_rad = deg2rad(subsolarLon);
  float lat_rad = deg2rad(cellLatLon.x);
  float lon_rad = deg2rad(cellLatLon.y);

  // Cosine of solar zenith angle
  float cosZenith = sin(lat_rad) * sin(subsolar_lat_rad) +
                    cos(lat_rad) * cos(subsolar_lat_rad) * cos(lon_rad - subsolar_lon_rad);

  // TOA solar flux (zero if sun below horizon)
  float toaFlux = solarFlux * max(0.0, cosZenith);

  // Downward sweep through layers
  float swDown = toaFlux;
  float swAbsorbed2 = 0.0, swAbsorbed1 = 0.0, swAbsorbed0 = 0.0;

  // Layer 2 (stratosphere) - mostly transparent
  {
    float reflection = calculateLayerSWReflection(layer2.cloudFraction);
    float absorption = calculateLayerSWAbsorption(layer2.cloudFraction);
    swAbsorbed2 = swDown * absorption;
    swDown = swDown * (1.0 - reflection - absorption);
  }

  // Layer 1 (troposphere) - weather layer, most clouds
  {
    float reflection = calculateLayerSWReflection(layer1.cloudFraction);
    float absorption = calculateLayerSWAbsorption(layer1.cloudFraction);
    swAbsorbed1 = swDown * absorption;
    swDown = swDown * (1.0 - reflection - absorption);
  }

  // Layer 0 (boundary layer) - surface interaction
  {
    float reflection = calculateLayerSWReflection(layer0.cloudFraction);
    float absorption = calculateLayerSWAbsorption(layer0.cloudFraction);
    swAbsorbed0 = swDown * absorption;
    swDown = swDown * (1.0 - reflection - absorption);
  }

  // Surface absorption
  float surfaceIncident = swDown * (1.0 - surfaceAlbedo);
  float surfaceHeatCapacity = getSurfaceHeatCapacity(waterDepth, iceThickness);
  float surfaceTempAfterSW = surfaceTemperature + (surfaceIncident * dt) / surfaceHeatCapacity;

  // ==========================================================================
  // LONGWAVE CALCULATION (Two-stream approximation)
  // ==========================================================================

  // Calculate layer emissivities
  float eps0 = calculateLayerEmissivity(layer0.humidity, layer0.cloudFraction, layer0.pressure);
  float eps1 = calculateLayerEmissivity(layer1.humidity, layer1.cloudFraction, layer1.pressure);
  float eps2 = calculateLayerEmissivity(layer2.humidity, layer2.cloudFraction, layer2.pressure);

  // Transmissivities (1 - emissivity for grey atmosphere)
  float tau0 = 1.0 - eps0;
  float tau1 = 1.0 - eps1;
  float tau2 = 1.0 - eps2;

  // Stefan-Boltzmann emissions (ε σ T⁴)
  float surfaceEmissivity = getSurfaceEmissivity(waterDepth, iceThickness);
  float tSurf2 = surfaceTempAfterSW * surfaceTempAfterSW;
  float surfaceEmission = surfaceEmissivity * STEFAN_BOLTZMANN_CONST * (tSurf2 * tSurf2);

  float t0_2 = layer0.temperature * layer0.temperature;
  float emit0 = eps0 * STEFAN_BOLTZMANN_CONST * (t0_2 * t0_2);

  float t1_2 = layer1.temperature * layer1.temperature;
  float emit1 = eps1 * STEFAN_BOLTZMANN_CONST * (t1_2 * t1_2);

  float t2_2 = layer2.temperature * layer2.temperature;
  float emit2 = eps2 * STEFAN_BOLTZMANN_CONST * (t2_2 * t2_2);

  // --- UPWARD SWEEP (Surface → Space) ---
  // Each layer absorbs part of upwelling flux and emits upward

  // Upward flux leaving surface
  float lwUp0 = surfaceEmission;

  // Through layer 0
  float absorbedByL0_up = lwUp0 * eps0;
  float lwUp1 = lwUp0 * tau0 + emit0;

  // Through layer 1
  float absorbedByL1_up = lwUp1 * eps1;
  float lwUp2 = lwUp1 * tau1 + emit1;

  // Through layer 2
  float absorbedByL2_up = lwUp2 * eps2;
  float lwToSpace = lwUp2 * tau2 + emit2;

  // --- DOWNWARD SWEEP (Space → Surface) ---
  // Start with zero incoming from space (no cosmic background in IR)
  float lwDown2 = 0.0;

  // Through layer 2 (downward)
  float lwDown1 = lwDown2 * tau2 + emit2;

  // Through layer 1 (downward)
  float absorbedByL1_down = lwDown1 * eps1;
  float lwDown0 = lwDown1 * tau1 + emit1;

  // Through layer 0 (downward)
  float absorbedByL0_down = lwDown0 * eps0;
  float lwToSurface = lwDown0 * tau0 + emit0;

  // ==========================================================================
  // NET ENERGY BUDGETS
  // ==========================================================================

  // Surface: gains back-radiation, loses emission
  float surfaceNetLW = lwToSurface - surfaceEmission;
  float surfaceNetPower = surfaceNetLW; // SW already applied above

  // Layer 0: absorbs from both directions, emits in both directions
  float layer0Absorbed = absorbedByL0_up + absorbedByL0_down + swAbsorbed0;
  float layer0Emitted = 2.0 * emit0; // Emits up and down
  float layer0NetPower = layer0Absorbed - layer0Emitted;

  // Layer 1: similar
  float layer1Absorbed = absorbedByL1_up + absorbedByL1_down + swAbsorbed1;
  float layer1Emitted = 2.0 * emit1;
  float layer1NetPower = layer1Absorbed - layer1Emitted;

  // Layer 2: similar
  float layer2Absorbed = absorbedByL2_up + swAbsorbed2; // No downward from space
  float layer2Emitted = 2.0 * emit2;
  float layer2NetPower = layer2Absorbed - layer2Emitted;

  // ==========================================================================
  // TEMPERATURE UPDATES
  // ==========================================================================

  // Surface temperature update
  float newSurfaceTemperature = surfaceTempAfterSW + (surfaceNetPower * dt) / surfaceHeatCapacity;

  // Layer temperature updates
  float newLayer0Temp = layer0.temperature + (layer0NetPower * dt) / layer0HeatCapacity;
  float newLayer1Temp = layer1.temperature + (layer1NetPower * dt) / layer1HeatCapacity;
  float newLayer2Temp = layer2.temperature + (layer2NetPower * dt) / layer2HeatCapacity;

  // Prevent unrealistic temperatures
  newSurfaceTemperature = clamp(newSurfaceTemperature, 100.0, 500.0);
  newLayer0Temp = clamp(newLayer0Temp, 100.0, 400.0);
  newLayer1Temp = clamp(newLayer1Temp, 100.0, 350.0);
  newLayer2Temp = clamp(newLayer2Temp, 100.0, 320.0);

  // ==========================================================================
  // OUTPUT
  // ==========================================================================

  // Surface state
  outSurfaceState = packSurfaceData(newSurfaceTemperature, surfaceAlbedo);

  // Layer 0 thermo (pass through pressure, humidity, cloud unchanged)
  outLayer0Thermo = packLayer0Thermo(
    newLayer0Temp,
    layer0.pressure,
    layer0.humidity,
    layer0.cloudFraction
  );

  // Layer 1 thermo
  outLayer1Thermo = packLayer1Thermo(
    newLayer1Temp,
    layer1.pressure,
    layer1.humidity,
    layer1.cloudFraction
  );

  // Layer 2 thermo
  outLayer2Thermo = packLayer2Thermo(
    newLayer2Temp,
    layer2.pressure,
    layer2.humidity,
    layer2.cloudFraction
  );

  // Auxiliary diagnostics
  outAuxiliary = vec4(toaFlux, surfaceNetPower, lwToSpace, 0.0);
}

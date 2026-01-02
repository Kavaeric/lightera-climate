/**
 * Pass 1: Basic radiation and greenhouse effect pass
 *
 * SHORTWAVE:
 * - Calculates solar flux at top of atmosphere based on orbital geometry.
 * - Calculates surface heating after atmospheric and surface albedo reflection.
 *
 * LONGWAVE:
 * - Surface emits IR radiation (Stefan-Boltzmann).
 * - Atmosphere absorbs part of surface emission.
 * - Atmosphere re-emits based on Kirchhoff's law (emissivity = absorptivity).
 * - Back-radiation creates the greenhouse effect.
 */

precision highp float;

#include "../../../rendering/shaders/utility/textureAccessors.glsl"
#include "../../shaders/constants.glsl"
#include "../../shaders/kDistribution.glsl"
#include "../../shaders/waterVapour.glsl"
#include "../../shaders/surfaceThermal.glsl"

in vec2 vUv;

// === ORBITAL PARAMETERS (for shortwave) ===
uniform float axialTilt;          // degrees - planet's axial tilt
uniform float yearProgress;       // 0-1 - current position in orbit
uniform float subsolarLon;         // degrees - current subsolar longitude (changes with planet rotation)
uniform float solarFlux;            // W/m² - solar constant at top of atmosphere

// === PHYSICS PARAMETERS ===
uniform float dt;  // Timestep in seconds

// === ATMOSPHERIC PROPERTIES (for longwave) ===
uniform float surfacePressure;  // Pa
uniform float surfaceGravity;   // m/s²
uniform float meanMolecularMass;  // kg/molecule
uniform float atmosphereHeatCapacity;  // J/(m²·K)

// Note: dryTransmissionTexture, dryTransmissionTempMin, and dryTransmissionTempMax
// are declared in kDistribution.glsl (included above)

// === OUTPUTS (MRT - Multiple Render Targets) ===
layout(location = 0) out vec4 outSurfaceState;   // Updated surface state (temperature and albedo)
layout(location = 1) out vec4 outAtmosphereState;   // Updated atmosphere state (temperature, pressure, precipitableWater, albedo)
layout(location = 2) out vec4 outSolarFlux;         // [Auxiliary] Solar flux at TOA - for visualisation

/**
 * Convert degrees to radians
 */
float deg2rad(float deg) {
	return deg * PI / 180.0;
}

/**
 * Calculate subsolar point latitude based on orbital position and axial tilt.
 *
 * The subsolar point is always at the equator (0°) during equinoxes.
 * During the year, the subsolar latitude oscillates due to axial tilt:
 * - At vernal/autumnal equinox (yearProgress = 0.0 or 0.5): subsolar_lat = 0°
 * - At summer solstice (yearProgress = 0.25): subsolar_lat = +axialTilt
 * - At winter solstice (yearProgress = 0.75): subsolar_lat = -axialTilt
 */
float calculateSubsolarLatitude(float tilt, float progress) {
	// Sun's latitude oscillates from -tilt to +tilt
	float orbitAngle = progress * 2.0 * PI;
	return tilt * sin(orbitAngle);
}

void main() {
	// Read cell position
	vec2 cellLatLon = getCellLatLon(vUv);

	// === READ CURRENT STATE ===
	vec4 surfaceState = texture(surfaceData, vUv);
	float surfaceTemperature = surfaceState.r;
	float surfaceAlbedo = surfaceState.a;

	vec4 atmosphereState = texture(atmosphereData, vUv);
	float atmosphereTemperature = atmosphereState.r;
	float atmospherePressure = atmosphereState.g;
	float precipitableWater_mm = atmosphereState.b;
	float atmosphereAlbedo = atmosphereState.a;

	// Read hydrology state to determine surface type
	vec4 hydrologyState = texture(hydrologyData, vUv);
	float waterDepth = hydrologyState.r;
	float iceThickness = hydrologyState.g;

	// === SHORTWAVE CALCULATION ===

	// Calculate subsolar point based on orbital position, axial tilt, and planet rotation
	float subsolarLat = calculateSubsolarLatitude(axialTilt, yearProgress);

	// Precompute subsolar radian conversions
	float subsolar_lat_rad = deg2rad(subsolarLat);
	float subsolar_lon_rad = deg2rad(subsolarLon);

	// Calculate incoming solar flux at top of atmosphere for this cell
	// Convert cell lat/lon to radians
	float lat_rad = deg2rad(cellLatLon.x);
	float lon_rad = deg2rad(cellLatLon.y);

	// Calculate angle between surface normal and sun direction
	// Using spherical dot product: cos(angle) = sin(lat1)*sin(lat2) + cos(lat1)*cos(lat2)*cos(lon2-lon1)
	float cosAngle = sin(lat_rad) * sin(subsolar_lat_rad) +
	                 cos(lat_rad) * cos(subsolar_lat_rad) * cos(lon_rad - subsolar_lon_rad);

	// Flux = solarFlux * max(0, cosAngle)
	// If cosAngle < 0, the sun is below the horizon
	float toaFlux = solarFlux * max(0.0, cosAngle);

	// The amount of energy that reaches the surface is the solar flux
	// less the amount of energy reflected by the atmosphere (albedo)
	// less the amount of energy reflected by the surface (visible light albedo)
	float surfaceIncident = toaFlux * (1.0 - atmosphereAlbedo) * (1.0 - surfaceAlbedo);

	// Calculate energy absorbed per unit area (W/m² * s = J/m²)
	float energyAbsorbed = surfaceIncident * dt;

	// Calculate temperature change from solar heating
	// Heat capacity depends on surface type (rock vs water/ice)
	// ΔT = Energy / HeatCapacity = (J/m²) / (J/(m²·K)) = K
	float surfaceHeatCapacity = getSurfaceHeatCapacity(waterDepth, iceThickness);
	float shortwaveTemperatureChange = energyAbsorbed / surfaceHeatCapacity;

	// Apply shortwave heating to surface temperature
	float surfaceTemperatureAfterShortwave = surfaceTemperature + shortwaveTemperatureChange;

	// === LONGWAVE CALCULATION ===

	// Derive dry pressure from total pressure (Dalton's Law)
	// Water vapor adds to atmospheric pressure, doesn't dilute other gases
	float dryPressure_Pa = calculateDryPressure(
		atmospherePressure,
		precipitableWater_mm,
		surfaceGravity
	);

	// Calculate dry gas column density from DRY pressure
	// This ensures adding water vapor doesn't dilute the dry gases
	float dryColumn_cm2 = calculateColumnDensity(
		dryPressure_Pa,
		surfaceGravity,
		meanMolecularMass
	);

	// Calculate H2O column density directly from precipitable water mass
	// Avoids molar fraction approach which caused dilution
	float h2oColumnDensity = calculateH2OColumnDensity(precipitableWater_mm);

	// === RADIATIVE TRANSFER (HYBRID APPROACH) ===
	//
	// Uses pre-computed dry gas transmission + per-cell H2O calculation.
	// Transmission must be calculated at the temperature of the emitting body,
	// because absorption cross-sections are temperature-dependent (via k-distribution).

	// Calculate transmission at surface temperature (for surface emission)
	float transmissionSurface = calculateAtmosphericTransmission(
		surfaceTemperatureAfterShortwave,
		h2oColumnDensity
	);

	// Calculate transmission at atmosphere temperature (for atmosphere emission)
	float transmissionAtmosphere = calculateAtmosphericTransmission(
		atmosphereTemperature,
		h2oColumnDensity
	);
	float atmosphereEmissivity = 1.0 - transmissionAtmosphere;

	// === LONGWAVE RADIATION FLUXES ===
	//
	// Both surface and atmosphere emit as grey bodies (emissivity < 1.0).
	// Surface emissivity depends on surface type (rock ≈ 0.90, water ≈ 0.96).
	// Atmosphere emissivity equals absorptivity by Kirchhoff's law.

	// Surface emission (Stefan-Boltzmann law)
	// Power per unit area: P = ε * σ * T^4 (W/m²)
	// Doing manual power calculation to avoid using pow() function for performance
	float surfaceEmissivity = getSurfaceEmissivity(waterDepth, iceThickness);
	float tempSurfaceSq = surfaceTemperatureAfterShortwave * surfaceTemperatureAfterShortwave;
	float surfaceEmission = surfaceEmissivity * STEFAN_BOLTZMANN_CONST * (tempSurfaceSq * tempSurfaceSq);

	// Atmosphere emission (Kirchhoff's law: emits according to absorptivity)
	// In thin layer model: atmosphere emits εσT_a^4 per unit area in EACH direction
	// Doing manual power calculation to avoid using pow() function for performance
	float tempAtmosphereSq = atmosphereTemperature * atmosphereTemperature;
	float atmosphereEmissionPerDirection = atmosphereEmissivity * STEFAN_BOLTZMANN_CONST * (tempAtmosphereSq * tempAtmosphereSq);

	// === ENERGY FLOWS ===
	// 
	// Four radiative pathways connect surface, atmosphere, and space.
	// 
	// THIN ATMOSPHERE MODEL: The atmosphere is treated as a single layer with
	// two sides (facing space and facing surface). The atmosphere emits
	// εσT_a^4 per unit area in each direction (upward and downward).

	// Surface → Space (transmitted through atmosphere)
	float surfaceToSpace = surfaceEmission * transmissionSurface;

	// Surface → Atmosphere (absorbed by atmosphere)
	float surfaceToAtmosphere = surfaceEmission * (1.0 - transmissionSurface);

	// Atmosphere → Space (upward emission)
	float atmosphereToSpace = atmosphereEmissionPerDirection;

	// Atmosphere → Surface (downward emission - greenhouse effect)
	float atmosphereToSurface = atmosphereEmissionPerDirection;

	// === NET ENERGY BUDGETS ===
	// 
	// All fluxes are in power per unit area (W/m²). To calculate energy changes,
	// we multiply by dt to get energy per unit area (J/m²).
	// 
	// Net power determines whether each component heats or cools.
	// Positive = net energy gain (heating), negative = net energy loss (cooling).

	// Surface net power per unit area: loses emission, gains back-radiation from atmosphere
	float surfaceNetPowerPerArea = -surfaceEmission + atmosphereToSurface;

	// Atmosphere net power per unit area: gains from surface absorption, loses from emission
	// Total emission loss = 2εσT_a^4 (upward + downward)
	float atmosphereNetPowerPerArea = surfaceToAtmosphere - (atmosphereToSpace + atmosphereToSurface);

	// === TEMPERATURE CHANGES ===
	//
	// Convert power per unit area to temperature change:
	// ΔT = (P/A × dt) / (C/A) = P × dt / C
	//
	// This is a first-order Euler integration. For stability, dt should be
	// small compared to the thermal relaxation timescale.

	// Surface temperature update (already includes shortwave heating)
	float newSurfaceTemperature = surfaceTemperatureAfterShortwave +
		(surfaceNetPowerPerArea * dt) / surfaceHeatCapacity;

	// Atmosphere temperature update
	// Adjust heat capacity for water vapor content (H2O has higher specific heat than dry air)
	float adjustedAtmosphereHeatCapacity = adjustHeatCapacityForWaterVapour(atmosphereHeatCapacity, precipitableWater_mm);
	float newAtmosphereTemperature = atmosphereTemperature +
		(atmosphereNetPowerPerArea * dt) / adjustedAtmosphereHeatCapacity;

	// === OUTPUT ===

	// Output 0: RGBA = [surfaceTemperature, reserved, reserved, albedo]
	outSurfaceState = packSurfaceData(newSurfaceTemperature, surfaceAlbedo);

	// Output 1: RGBA = [atmosphereTemperature, pressure, precipitableWater, albedo]
	// Note: pressure and precipitableWater_mm are passed through unchanged (no dynamics yet)
	outAtmosphereState = packAtmosphereData(newAtmosphereTemperature, atmospherePressure, precipitableWater_mm, atmosphereAlbedo);

	// Output 2 [Auxiliary]: RGBA = [solar flux at TOA (W/m²), reserved, reserved, reserved]
	outSolarFlux = vec4(toaFlux, 0.0, 0.0, 0.0);
}

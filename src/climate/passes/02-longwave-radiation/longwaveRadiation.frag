/**
 * Pass 3: Longwave radiation (greenhouse effect)
 *
 * The idealised greenhouse model assumes a thin layer atmosphere that emits from
 * two sides: one side facing the surface and one side facing space.
 *
 * The ground emits energy as outgoing longwave (IR) radiation, which is then
 * absorbed partially by the atmosphere, with a portion of this energy escaping
 * directly to space.
 *
 * The atmosphere then heats up and re-emits across its two surfaces, with some energy
 * escaping out to space, and some returning back to the surface. This returning energy
 * is the primary driver in what is known as the greenhouse effect, where various gases
 * trap heat in the planet's atmosphere.
 *
 * Currently, this atmosphere model assumes that, aside from water vapour (humidity),
 * the atmosphere is homogenous in its composition and doesn't change over time.
 */

precision highp float;

#include "../../../rendering/shaders/utility/textureAccessors.glsl"
#include "../../shaders/constants.glsl"
#include "../../shaders/kDistribution.glsl"
#include "../../shaders/surfaceThermal.glsl"

in vec2 vUv;

// Input uniforms
uniform float dt;  // Timestep in seconds

// Atmospheric property uniforms
uniform float surfacePressure;  // Pa
uniform float surfaceGravity;   // m/s²

// Molecular masses (kg/molecule)
uniform float meanMolecularMass;

// Heat capacity (precomputed from composition)
uniform float atmosphereHeatCapacity;  // J/(m²·K)

// Note: Gas concentrations for dry gases (CO2, CH4, N2O, O3) are now baked into
// the pre-computed dryTransmissionTexture. Only H2O needs per-cell calculation.

// Output: Updated surface and atmosphere states (MRT)
layout(location = 0) out vec4 outSurfaceState;
layout(location = 1) out vec4 outAtmosphereState;

void main() {
	// Read surface and atmosphere state (combined texture reads for efficiency)
	vec4 surfaceState = texture(surfaceData, vUv);
	float surfaceTemperature = surfaceState.r;
	float surfaceAlbedo = surfaceState.a;

	vec4 atmosphereState = texture(atmosphereData, vUv);
	float atmosphereTemperature = atmosphereState.r;
	float atmospherePressure = atmosphereState.g;
	float precipitableWater_mm = atmosphereState.b;
	float atmosphereAlbedo = atmosphereState.a;

	// Read hydrology state to determine surface type
	float waterDepth = getWaterDepth(vUv);
	float iceThickness = getIceThickness(vUv);

	// === ATMOSPHERIC COLUMN PROPERTIES ===

	// Calculate total atmospheric column density from pressure and gravity
	float totalColumn_cm2 = calculateColumnDensity(
		atmospherePressure,
		surfaceGravity,
		meanMolecularMass
	);

	// Convert precipitable water to H2O molar fraction
	// Formula: x_h2o = pw × g × (M_air/M_h2o) / (P × 1000)
	// Where:
	//   pw = precipitable water in mm (= kg/m²)
	//   g = surface gravity (m/s²)
	//   M_air/M_h2o ≈ 29/18 ≈ 1.611 (ratio of mean air to water molecular mass)
	//   P = surface pressure (Pa)
	//   1000 converts mm to m
	const float MOLAR_MASS_RATIO = 1.611; // M_air / M_h2o
	float humidity = precipitableWater_mm * surfaceGravity * MOLAR_MASS_RATIO / (atmospherePressure * 1000.0);

	// Calculate H2O column density for per-cell transmission calculation
	float h2oColumnDensity = totalColumn_cm2 * humidity;

	// === RADIATIVE TRANSFER (HYBRID APPROACH) ===
	//
	// Uses pre-computed dry gas transmission + per-cell H2O calculation.
	// This is for better runtime performance.
	//
	// Transmission must be calculated at the temperature of the emitting body,
	// because absorption cross-sections are temperature-dependent (via k-distribution).
	// The k-distribution method uses blackbody-weighted transmission, so the Planck
	// spectrum at the emitter's temperature determines which wavelengths dominate.

	// Calculate transmission at surface temperature (for surface emission)
	// This determines how much surface radiation escapes to space vs. is absorbed
	float transmissionSurface = calculateAtmosphericTransmission(
		surfaceTemperature,
		h2oColumnDensity
	);

	// Calculate transmission at atmosphere temperature (for atmosphere emission)
	// By Kirchhoff's law: emissivity = absorptivity = 1 - transmission
	// The atmosphere can only emit at wavelengths where it absorbs
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
	float surfaceEmissivity = getSurfaceEmissivity(waterDepth, iceThickness);
	float surfaceEmission = surfaceEmissivity * STEFAN_BOLTZMANN_CONST * pow(surfaceTemperature, 4.0);

	// Atmosphere emission (Kirchhoff's law: emits according to absorptivity)
	// A good absorber is a good emitter at the same wavelengths
	// In thin layer model: atmosphere emits εσT_a^4 per unit area in EACH direction
	// (upward and downward), so total emission = 2εσT_a^4
	float atmosphereEmissionPerDirection = atmosphereEmissivity * STEFAN_BOLTZMANN_CONST * pow(atmosphereTemperature, 4.0);

	// === ENERGY FLOWS ===
	// 
	// Four radiative pathways connect surface, atmosphere, and space.
	// 
	// THIN ATMOSPHERE MODEL: The atmosphere is treated as a single layer with
	// two sides (facing space and facing surface). The atmosphere emits
	// εσT_a^4 per unit area in each direction (upward and downward).
	// 
	// Total atmospheric emission = 2εσT_a^4 (εσT_a^4 upward + εσT_a^4 downward)

	// Surface → Space (transmitted through atmosphere)
	// Some surface radiation escapes directly to space
	float surfaceToSpace = surfaceEmission * transmissionSurface;

	// Surface → Atmosphere (absorbed by atmosphere)
	// Greenhouse gases absorb the remainder, heating the atmosphere
	float surfaceToAtmosphere = surfaceEmission * (1.0 - transmissionSurface);

	// Atmosphere → Space (upward emission)
	// Atmospheric emission cools the planet by radiating to space
	// In thin layer model: P_up = εσT_a^4 (per unit area)
	float atmosphereToSpace = atmosphereEmissionPerDirection;

	// Atmosphere → Surface (downward emission - greenhouse effect)
	// Back-radiation warms the surface, creating the greenhouse effect
	// In thin layer model: P_down = εσT_a^4 (per unit area)
	float atmosphereToSurface = atmosphereEmissionPerDirection;

	// === NET ENERGY BUDGETS ===
	// 
	// All fluxes are in power per unit area (W/m²). To calculate energy changes,
	// we multiply by cell area to get total power (W), then multiply by dt to get
	// total energy (J). This accounts for the fact that cells have different areas.
	// 
	// Net power determines whether each component heats or cools.
	// Positive = net energy gain (heating), negative = net energy loss (cooling).
	// 
	// The greenhouse effect manifests as: surface loses less energy than it emits
	// because it receives back-radiation from the atmosphere.

	// Surface net power per unit area: loses emission, gains back-radiation from atmosphere
	float surfaceNetPowerPerArea = -surfaceEmission + atmosphereToSurface;

	// Atmosphere net power per unit area: gains from surface absorption, loses from emission
	// The atmosphere acts as an intermediary: it absorbs surface radiation and
	// re-emits it both upward (cooling) and downward (greenhouse effect)
	// Total emission loss = 2εσT_a^4 (upward + downward)
	float atmosphereNetPowerPerArea = surfaceToAtmosphere - (atmosphereToSpace + atmosphereToSurface);

	// === TEMPERATURE CHANGES ===
	//
	// Convert power per unit area to temperature change:
	// ΔT = (P/A × dt) / (C/A) = P × dt / C
	//
	// Note: cellArea cancels out in the calculation, so we operate directly
	// on power per unit area and heat capacity per unit area.
	//
	// This is a first-order Euler integration. For stability, dt should be
	// small compared to the thermal relaxation timescale.

	// Surface temperature update
	// Heat capacity depends on surface type (rock vs water/ice)
	float surfaceHeatCapacity = getSurfaceHeatCapacity(waterDepth, iceThickness);
	float newSurfaceTemperature = surfaceTemperature +
		(surfaceNetPowerPerArea * dt) / surfaceHeatCapacity; // K

	// Atmosphere temperature update
	float newAtmosphereTemperature = atmosphereTemperature +
		(atmosphereNetPowerPerArea * dt) / atmosphereHeatCapacity; // K

	// === OUTPUT ===

	// Update surface state: RGBA = [surfaceTemperature, reserved, reserved, albedo]
	outSurfaceState = packSurfaceData(newSurfaceTemperature, surfaceAlbedo);

	// Update atmosphere state: RGBA = [atmosphereTemperature, pressure, precipitableWater, albedo]
	// Note: pressure and precipitableWater_mm are passed through unchanged (no dynamics yet)
	outAtmosphereState = packAtmosphereData(newAtmosphereTemperature, atmospherePressure, precipitableWater_mm, atmosphereAlbedo);
}

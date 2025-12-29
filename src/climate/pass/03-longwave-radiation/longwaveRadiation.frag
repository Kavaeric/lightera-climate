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
 */

precision highp float;

#include "../../../shaders/textureAccessors.glsl"
#include "../../constants.glsl"
#include "../../../shaders/kDistribution.glsl"

in vec2 vUv;

// Input uniforms
uniform float dt;  // Timestep in seconds

// Atmospheric property uniforms
uniform float surfacePressure;  // Pa
uniform float surfaceGravity;   // m/s²

// Gas concentrations (molar fractions)
uniform float co2Concentration;
uniform float ch4Concentration;
uniform float n2oConcentration;
uniform float o3Concentration;
uniform float o2Concentration;
uniform float n2Concentration;

// Molecular masses (kg/molecule)
uniform float meanMolecularMass;

// Heat capacity (precomputed from composition)
uniform float atmosphereHeatCapacity;  // J/(m²·K)

// Output: Updated surface and atmosphere states (MRT)
layout(location = 0) out vec4 outSurfaceState;
layout(location = 1) out vec4 outAtmosphereState;

void main() {
	// Read cell position
	vec2 cellLatLon = getCellLatLon(vUv);

	// Read cell area
	float cellArea = getCellArea(vUv);

	// Read surface temperature and albedo
	float surfaceTemperature = getSurfaceTemperature(vUv);
	float surfaceAlbedo = getSurfaceAlbedo(vUv);

	// Read atmosphere temperature and albedo
	float atmosphereTemperature = getAtmosphereTemperature(vUv);
	float atmosphereAlbedo = getAtmosphereAlbedo(vUv);

	// === ATMOSPHERIC COLUMN PROPERTIES ===

	// Calculate total atmospheric column density from pressure and gravity
	float totalColumn_cm2 = calculateColumnDensity(
		surfacePressure,
		surfaceGravity,
		meanMolecularMass
	);

	// Read humidity from atmosphere texture (blue channel)
	// TODO: Currently humidity is not dynamically calculated, set to 0
	float humidity = 0.0;

	// Calculate column densities for all gases
	// Order: [CO2, H2O, CH4, N2O, O3, O2, N2]
	// TODO: possibly extract everything but humidity as we're assuming everything but humidity
	//       is constant and homogenous throughout the atmosphere.
	float columnDensities[7];
	columnDensities[0] = totalColumn_cm2 * co2Concentration;
	columnDensities[1] = totalColumn_cm2 * humidity;
	columnDensities[2] = totalColumn_cm2 * ch4Concentration;
	columnDensities[3] = totalColumn_cm2 * n2oConcentration;
	columnDensities[4] = totalColumn_cm2 * o3Concentration;
	columnDensities[5] = totalColumn_cm2 * o2Concentration;
	columnDensities[6] = totalColumn_cm2 * n2Concentration;

	// === RADIATIVE TRANSFER ===
	// 
	// Transmission must be calculated at the temperature of the emitting body,
	// because absorption cross-sections are temperature-dependent (via k-distribution).
	// The k-distribution method uses blackbody-weighted transmission, so the Planck
	// spectrum at the emitter's temperature determines which wavelengths dominate.

	// Calculate transmission at surface temperature (for surface emission)
	// This determines how much surface radiation escapes to space vs. is absorbed
	float transmissionSurface = calculateMultiGasTransmission(
		surfaceTemperature,
		columnDensities
	);

	// Calculate transmission at atmosphere temperature (for atmosphere emission)
	// By Kirchhoff's law: emissivity = absorptivity = 1 - transmission
	// The atmosphere can only emit at wavelengths where it absorbs
	float transmissionAtmosphere = calculateMultiGasTransmission(
		atmosphereTemperature,
		columnDensities
	);
	float atmosphereEmissivity = 1.0 - transmissionAtmosphere;

	// === LONGWAVE RADIATION FLUXES ===
	// 
	// Both surface and atmosphere emit as grey bodies (emissivity < 1.0).
	// Surface emissivity is a material property (rock ≈ 0.90).
	// Atmosphere emissivity equals absorptivity by Kirchhoff's law.

	// Surface emission (Stefan-Boltzmann law)
	// Power per unit area: P = ε * σ * T^4 (W/m²)
	float surfaceEmission = MATERIAL_ROCK_EMISSIVITY * STEFAN_BOLTZMANN_CONST * pow(surfaceTemperature, 4.0);

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
	// εσT_a^4 per unit area in EACH direction (upward and downward), following
	// the standard idealised greenhouse model formulation.
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
	// we must multiply by cell area to get total power (W), then by dt to get
	// total energy (J). This accounts for the fact that cells have different areas.
	// 
	// Net power determines whether each component heats or cools.
	// Positive = net energy gain (heating), negative = net energy loss (cooling).
	// 
	// The greenhouse effect manifests as: surface loses less energy than it emits
	// because it receives back-radiation from the atmosphere.

	// Surface net power per unit area: loses emission, gains back-radiation from atmosphere
	// Without greenhouse effect: net = -surfaceEmission (always cooling)
	// With greenhouse effect: net = -surfaceEmission + back-radiation (less cooling)
	float surfaceNetPowerPerArea = -surfaceEmission + atmosphereToSurface;

	// Atmosphere net power per unit area: gains from surface absorption, loses from emission
	// The atmosphere acts as an intermediary: it absorbs surface radiation and
	// re-emits it both upward (cooling) and downward (greenhouse effect)
	// Total emission loss = 2εσT_a^4 (upward + downward)
	float atmosphereNetPowerPerArea = surfaceToAtmosphere - (atmosphereToSpace + atmosphereToSurface);

	// === TEMPERATURE CHANGES ===
	// 
	// Convert power per unit area to total energy, then to temperature change:
	// Total power = power per area × cell area (W)
	// Total energy = total power × dt (J)
	// Total heat capacity = heat capacity per area × cell area (J/K)
	// Temperature change = total energy / total heat capacity (K)
	// 
	// This is a first-order Euler integration. For stability, dt should be
	// small compared to the thermal relaxation timescale.

	// Surface temperature update
	// cellArea cancels out, but keeping for clarity and future material variation support.
	float newSurfaceTemperature = surfaceTemperature +
		(surfaceNetPowerPerArea * cellArea * dt) / (MATERIAL_ROCK_HEAT_CAPACITY_PER_AREA * cellArea); // K

	// Atmosphere temperature update
	// cellArea cancels out, but keeping for clarity and future material variation support.
	float newAtmosphereTemperature = atmosphereTemperature +
		(atmosphereNetPowerPerArea * cellArea * dt) / (atmosphereHeatCapacity * cellArea); // K

	// === OUTPUT ===

	// Update surface state: RGBA = [surfaceTemperature, albedo, reserved, reserved]
	outSurfaceState = packSurfaceData(newSurfaceTemperature, surfaceAlbedo);

	// Update atmosphere state: RGBA = [atmosphereTemperature, reserved, reserved, albedo]
	outAtmosphereState = packAtmosphereData(newAtmosphereTemperature, atmosphereAlbedo);
}

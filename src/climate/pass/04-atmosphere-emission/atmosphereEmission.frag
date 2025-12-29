precision highp float;

#include "../../../shaders/textureAccessors.glsl"
#include "../../constants.glsl"
#include "../../../shaders/kDistribution.glsl"

in vec2 vUv;

// Input uniforms
uniform float dt;  // Timestep in seconds

// Atmospheric property uniforms (same as Pass 3 for Kirchhoff's law)
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

	// === KIRCHHOFF'S LAW: EMISSIVITY = ABSORPTIVITY ===

	// Calculate atmospheric column density and gas properties
	// (same calculation as Pass 3 to ensure consistency)
	float totalColumn_cm2 = calculateColumnDensity(
		surfacePressure,
		surfaceGravity,
		meanMolecularMass
	);

	// Calculate column densities for all gases
	// Order: [CO2, H2O, CH4, N2O, O3, O2, N2]
	float columnDensities[7];
	columnDensities[0] = totalColumn_cm2 * co2Concentration;
	columnDensities[1] = totalColumn_cm2 * 0.0;  // H2O: TODO - use humidity
	columnDensities[2] = totalColumn_cm2 * ch4Concentration;
	columnDensities[3] = totalColumn_cm2 * n2oConcentration;
	columnDensities[4] = totalColumn_cm2 * o3Concentration;
	columnDensities[5] = totalColumn_cm2 * o2Concentration;
	columnDensities[6] = totalColumn_cm2 * n2Concentration;

	// Calculate transmission at atmosphere temperature (for emission calculation)
	// By Kirchhoff's law: emissivity = absorptivity = 1 - transmission
	float transmission = calculateMultiGasTransmission(
		atmosphereTemperature,
		columnDensities
	);
	float emissivity = 1.0 - transmission;

	// === ATMOSPHERIC EMISSION ===

	// Calculate atmospheric emission (Stefan-Boltzmann law with Kirchhoff's emissivity)
	// Power per unit area: P = ε * σ * T^4 (W/m²)
	// The atmosphere emits according to its absorptivity (Kirchhoff's law)
	float powerEmitted = emissivity * STEFAN_BOLTZMANN_CONST * pow(atmosphereTemperature, 4.0);

	// === UPWARD RADIATION (to space) ===
	// Half of emitted power goes upward
	float powerToSpace = powerEmitted * 0.5;

	// === DOWNWARD RADIATION (to surface - greenhouse effect) ===
	// Half of emitted power goes downward to surface
	float powerToSurface = powerEmitted * 0.5;

	// === ATMOSPHERE ENERGY BUDGET ===

	// Atmosphere loses energy to both space and to the surface
	float energyLostAtmosphere = (powerToSpace + powerToSurface) * dt;

	// Calculate temperature change of atmosphere (negative = cooling)
	// ΔT = -Energy / HeatCapacity = -(J/m²) / (J/(m²·K)) = -K
	float temperatureChangeAtmosphere = -energyLostAtmosphere / atmosphereHeatCapacity;

	// Calculate new atmosphere temperature
	float newAtmosphereTemperature = atmosphereTemperature + temperatureChangeAtmosphere;

	// === SURFACE ENERGY BUDGET ===

	// Surface gains energy from atmospheric downward radiation (greenhouse effect)
	float energyGainedSurface = powerToSurface * dt;

	// Calculate temperature change from radiative heating
	// ΔT = Energy / HeatCapacity = (J/m²) / (J/(m²·K)) = K
	float temperatureChangeSurface = energyGainedSurface / MATERIAL_ROCK_HEAT_CAPACITY_PER_AREA;

	// Calculate new surface temperature
	float newSurfaceTemperature = surfaceTemperature + temperatureChangeSurface;

	// === OUTPUT ===

	// Update surface state: RGBA = [surfaceTemperature, albedo, reserved, reserved]
	outSurfaceState = packSurfaceData(newSurfaceTemperature, surfaceAlbedo);

	// Update atmosphere state: RGBA = [atmosphereTemperature, reserved, reserved, albedo]
	outAtmosphereState = packAtmosphereData(newAtmosphereTemperature, atmosphereAlbedo);
}
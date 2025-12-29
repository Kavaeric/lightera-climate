precision highp float;

#include "../../../shaders/textureAccessors.glsl"
#include "../../constants.glsl"
#include "../../../shaders/kDistribution.glsl"

in vec2 vUv;

// Input uniforms
uniform float dt;  // Timestep in seconds

// Atmospheric property uniforms
uniform float surfacePressure;      // Pa
uniform float surfaceGravity;       // m/s²
uniform float co2Concentration;     // molar fraction
uniform float co2MolecularMass;     // kg/molecule

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

	// === ATMOSPHERIC RADIATIVE TRANSFER ===

	// Calculate total atmospheric column density from pressure and gravity
	// This gives the total number of molecules per unit area
	float totalColumn_cm2 = calculateColumnDensity(
		surfacePressure,
		surfaceGravity,
		co2MolecularMass
	);

	// Calculate CO2 column density (total column × molar fraction)
	float co2Column_cm2 = totalColumn_cm2 * co2Concentration;

	// Calculate blackbody-weighted transmission coefficient
	// This integrates transmission over the thermal emission spectrum
	// Using the correlated-k method to handle spectral variation within bins
	float transmission = calculateBlackbodyWeightedTransmission(
		surfaceTemperature,
		co2Column_cm2
	);

	// === SURFACE ENERGY BUDGET ===

	// Calculate surface emission (Stefan-Boltzmann law)
	// Power per unit area: P = ε * σ * T^4 (W/m²)
	float powerEmitted = MATERIAL_ROCK_EMISSIVITY * STEFAN_BOLTZMANN_CONST * pow(surfaceTemperature, 4.0);

	// Split emitted energy: transmitted to space vs absorbed by atmosphere
	float powerToSpace = powerEmitted * transmission;
	float powerAbsorbed = powerEmitted * (1.0 - transmission);

	// Surface loses all emitted energy (both to space and atmosphere)
	float energyLost = powerEmitted * dt;

	// Calculate temperature change from radiative cooling
	// ΔT = -Energy / HeatCapacity = -(J/m²) / (J/(m²·K)) = -K
	float temperatureChange = -energyLost / MATERIAL_ROCK_HEAT_CAPACITY_PER_AREA;

	// Calculate new surface temperature
	float newSurfaceTemperature = surfaceTemperature + temperatureChange;

	// === ATMOSPHERE ENERGY BUDGET ===

	// Atmosphere gains absorbed energy from surface emission
	float energyGainedAtmosphere = powerAbsorbed * dt;

	// Calculate temperature change of atmosphere
	// ΔT = Energy / HeatCapacity = (J/m²) / (J/(m²·K)) = K
	float temperatureChangeAtmosphere = energyGainedAtmosphere / ATMOSPHERE_HEAT_CAPACITY_PER_AREA;

	// Calculate new atmosphere temperature
	float newAtmosphereTemperature = atmosphereTemperature + temperatureChangeAtmosphere;

	// === OUTPUT ===

	// Update surface state: RGBA = [surfaceTemperature, albedo, reserved, reserved]
	outSurfaceState = packSurfaceData(newSurfaceTemperature, surfaceAlbedo);

	// Update atmosphere state: RGBA = [atmosphereTemperature, reserved, reserved, albedo]
	outAtmosphereState = packAtmosphereData(newAtmosphereTemperature, atmosphereAlbedo);
}
precision highp float;

#include "../../../shaders/textureAccessors.glsl"
#include "../../constants.glsl"

varying vec2 vUv;

// Input uniforms
uniform float dt;  // Timestep in seconds

void main() {
	// Read cell position
	vec2 cellLatLon = getCellLatLon(vUv);

	// Read cell area
	float cellArea = getCellArea(vUv);

	// Read surface temperature and albedo
	float surfaceTemperature = getSurfaceTemperature(vUv);
	float surfaceAlbedo = getSurfaceAlbedo(vUv);

	// Calculate surface emission (Stefan-Boltzmann law)
	// Power per unit area: P = ε * σ * T^4 (W/m²)
	float powerEmitted = MATERIAL_ROCK_EMISSIVITY * STEFAN_BOLTZMANN_CONST * pow(surfaceTemperature, 4.0);
	
	// Calculate energy lost per unit area over timestep (J/m²)
	float energyLost = powerEmitted * dt;
	
	// Calculate temperature change from radiative cooling
	// ΔT = -Energy / HeatCapacity = -(J/m²) / (J/(m²·K)) = -K
	float temperatureChange = -energyLost / MATERIAL_ROCK_HEAT_CAPACITY_PER_AREA;
	
	// Calculate new surface temperature
	float newSurfaceTemperature = surfaceTemperature + temperatureChange;
	
	// Update the texture: RGBA = [surfaceTemperature, albedo, reserved, reserved]
	gl_FragColor = packSurfaceData(newSurfaceTemperature, surfaceAlbedo);

	// Calculate thermal energy absorbed by the atmosphere (vs transmitted)
	// Reference experiment/hitranLineExperiment.tsx for equivalent implementation
	// in Javascript
	// Atmospheric composition and characteristics will need to be calculated based on config
	// Can probably assume that atmo is homogenous and even in composition, but water/humidity
	// is more variable

	// Update the atmospheric temperature based on the thermal energy absorbed
	
	// The next shader will handle atmospheric emission to space and back to the surface
}
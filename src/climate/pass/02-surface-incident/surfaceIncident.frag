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

	// Read solar flux
	float solarFlux = getSolarFlux(vUv);

	// Read atmosphere albedo
	float atmosphereAlbedo = getAtmosphereAlbedo(vUv);

	// Read surface albedo
	float surfaceAlbedo = getSurfaceAlbedo(vUv);

	// Read current surface temperature
	float surfaceTemperature = getSurfaceTemperature(vUv);

	// The amount of energy that reaches the surface is the solar flux
	// less the amount of energy reflected by the atmosphere (albedo)
	// less the amount of energy reflected by the surface (visible light albedo)
	float surfaceIncident = solarFlux * (1.0 - atmosphereAlbedo) * (1.0 - surfaceAlbedo);

	// Calculate energy absorbed per unit area (W/m² * s = J/m²)
	float energyAbsorbed = surfaceIncident * dt;

	// Calculate temperature change from solar heating
	// ΔT = Energy / HeatCapacity = (J/m²) / (J/(m²·K)) = K
	float temperatureChange = energyAbsorbed / MATERIAL_ROCK_HEAT_CAPACITY_PER_AREA;

	// Calculate new surface temperature
	float newSurfaceTemperature = surfaceTemperature + temperatureChange;

	// Output: RGBA = [surfaceTemperature, albedo, reserved, reserved]
	gl_FragColor = vec4(newSurfaceTemperature, surfaceAlbedo, 0.0, 0.0);
}

/**
 * Pass 3: Hydrology
 *
 * Handles water cycle dynamics including:
 * - Ice/water phase transitions (freezing and melting)
 * - Evaporation from water surfaces (future)
 * - Precipitation from atmosphere (future)
 *
 * Phase change assumptions:
 * - 1m of water freezes to 1m of ice (and vice versa)
 * - Uses 50m scale depth consistent with thermal calculations
 * - Latent heat not currently modelled
 */

precision highp float;

#include "../../../shaders/textureAccessors.glsl"
#include "../../constants.glsl"

in vec2 vUv;

// Input uniforms
uniform float dt;  // Timestep in seconds

// Output: Updated hydrology state + auxiliary water state
layout(location = 0) out vec4 outHydrologyState;
layout(location = 1) out vec4 outAuxiliary;

// Approximation of vaporisation temperature of water as a function of pressure
// Calibrated to yield T = 375.15 K at P = 101325 Pa
//
// When P = 611.73, T = 273.19 K (vs reference triple point, T = 273.16 K)
// When P = 1 000 000 Pa, T = 453.897 (reference: T = 452.15 K)
// When P = 22 064 000 Pa, T = 640.677 (vs reference critical point, T ≈ 647)
//
// Works pretty well for pressures up to 1 MPa, but I guess it can work up
// to the critical point or so. At that point the freezing point starts to drop and
// the stuff starts to behave weirdly. Ever heard of "ice III"?
float vaporisationPoint(float pressure) {
	return (-4965.11 + 23.519 * log(pressure))/(-24.0385 + log(pressure));
}

// Calculates the melting point of water as a function of salinity.
// For every PSU of salinity, the melting point is reduced by 0.054 K.
float meltingPoint(float salinity) {
	return 273.15 - (0.054 * salinity);
}

// Phase change rate constant
// Controls how fast ice/water transitions occur
// Higher values = faster phase change
const float PHASE_CHANGE_RATE = 0.1; // m/s per K temperature difference

void main() {
	// Read current hydrology state
	vec4 hydrologyState = texture(hydrologyData, vUv);
	float waterDepth = hydrologyState.r;
	float iceThickness = hydrologyState.g;
	float salinity = hydrologyState.a;

	vec4 atmosphereState = texture(atmosphereData, vUv);
	float atmospherePressure = atmosphereState.g;

	vec4 surfaceState = texture(surfaceData, vUv);
	float surfaceTemperature = surfaceState.r;

	vec4 currentAuxiliary = texture(auxiliaryData, vUv);
	float solarFlux = currentAuxiliary.r;

	// Calculate phase transition temperatures
	float freezingPoint = meltingPoint(salinity);
	float boilingPoint = vaporisationPoint(atmospherePressure);

	// === PHASE CHANGE DYNAMICS ===
	//
	// Phase change rate is proportional to temperature difference from melting point.
	// Positive deltaT = above melting → ice melts to water
	// Negative deltaT = below melting → water freezes to ice

	float deltaT = surfaceTemperature - freezingPoint;

	// Calculate phase change amount for this timestep
	// Rate scales with temperature difference (faster change when further from equilibrium)
	float phaseChangeAmount = PHASE_CHANGE_RATE * deltaT * dt;

	// Apply phase change
	float newWaterDepth = waterDepth;
	float newIceThickness = iceThickness;

	if (deltaT > 0.0) {
		// Above melting point: ice melts to water
		// Limit melting to available ice
		float meltAmount = min(phaseChangeAmount, iceThickness);
		newIceThickness = iceThickness - meltAmount;
		newWaterDepth = waterDepth + meltAmount;
	} else {
		// Below melting point: water freezes to ice
		// Limit freezing to available water (phaseChangeAmount is negative, so negate it)
		float freezeAmount = min(-phaseChangeAmount, waterDepth);
		newWaterDepth = waterDepth - freezeAmount;
		newIceThickness = iceThickness + freezeAmount;
	}

	// Ensure non-negative values
	newWaterDepth = max(0.0, newWaterDepth);
	newIceThickness = max(0.0, newIceThickness);

	// === WATER STATE FOR VISUALISATION ===
	// Determine water state based on temperature thresholds
	// 0.0 = solid (frozen), 0.5 = liquid, 1.0 = vapour (above boiling)
	float isAboveBoilingPoint = step(boilingPoint, surfaceTemperature);
	float isAboveMeltingPoint = step(freezingPoint, surfaceTemperature) * (1.0 - isAboveBoilingPoint);
	float waterState = isAboveMeltingPoint * 0.5 + isAboveBoilingPoint;

	// Output: RGBA = [waterDepth, iceThickness, unused, salinity]
	outHydrologyState = packHydrologyData(newWaterDepth, newIceThickness, salinity);

	// Output auxiliary: RGBA = [solarFlux (preserved), waterState, unused, unused]
	outAuxiliary = packAuxiliaryData(solarFlux, waterState);
}

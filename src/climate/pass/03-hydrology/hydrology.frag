/**
 * Pass 3: Hydrology
 *
 * Handles water cycle dynamics including:
 * - Ice/water phase transitions (freezing and melting)
 * - Latent heat effects on surface temperature
 * - Evaporation from water surfaces (future)
 * - Precipitation from atmosphere (future)
 *
 * Phase change assumptions:
 * - 1m of water freezes to 1m of ice (and vice versa)
 * - Uses 50m scale depth consistent with thermal calculations
 * - Latent heat absorbed during melting cools the surface
 * - Latent heat released during freezing warms the surface
 */

precision highp float;

#include "../../../shaders/textureAccessors.glsl"
#include "../../constants.glsl"
#include "../../../shaders/surfaceThermal.glsl"

in vec2 vUv;

// Input uniforms
uniform float dt;  // Timestep in seconds

// Output: Updated hydrology state + auxiliary water state + surface state
layout(location = 0) out vec4 outHydrologyState;
layout(location = 1) out vec4 outAuxiliary;
layout(location = 2) out vec4 outSurfaceState;

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

/**
 * Calculate phase change rate based on surface heat flux.
 *
 * Phase change occurs at the surface interface, limited by how fast heat
 * can transfer across the boundary. The melt/freeze rate is:
 *
 *   rate = h × ΔT / (ρ × L_f)   [m/s]
 *
 * Where:
 *   h = heat transfer coefficient (W/(m²·K))
 *   ΔT = temperature difference from melting point (K)
 *   ρ = density (kg/m³)
 *   L_f = latent heat of fusion (J/kg)
 *
 * For ice/water interface with natural convection, h ≈ 50-500 W/(m²·K).
 * Using a moderate value that gives reasonable melt rates:
 *   At h = 100 W/(m²·K), ΔT = 1K:
 *   rate = 100 / (917 × 334000) ≈ 3.3×10⁻⁷ m/s ≈ 0.028 m/day ≈ 10.3 m/year
 *
 * This is independent of ice thickness - only the surface melts.
 *
 * ASSUMPTION: Ice is always on top of water (floating). Phase change only
 * occurs at the ice-atmosphere interface (top surface), driven by air/surface
 * temperature. Basal melting from warm water underneath is not modelled.
 */
const float PHASE_CHANGE_HEAT_TRANSFER_COEFF = 100.0; // W/(m²·K)

float calculatePhaseChangeRate(float deltaT) {
	// Heat flux at interface: Q = h × ΔT (W/m²)
	// Melt rate: Q / (ρ_ice × L_f) (m/s)
	float heatFlux = PHASE_CHANGE_HEAT_TRANSFER_COEFF * deltaT;
	return heatFlux / (MATERIAL_ICE_DENSITY * MATERIAL_ICE_LATENT_HEAT_FUSION);
}

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
	float surfaceAlbedo = surfaceState.a;

	vec4 currentAuxiliary = texture(auxiliaryData, vUv);
	float solarFlux = currentAuxiliary.r;

	// Calculate phase transition temperatures
	float freezingPoint = meltingPoint(salinity);
	float boilingPoint = vaporisationPoint(atmospherePressure);

	// === PHASE CHANGE DYNAMICS ===
	//
	// Phase change is driven by excess thermal energy beyond the melting point.
	// The rate is determined by the thermal energy budget and latent heat of fusion.
	// Positive deltaT = above melting → ice melts to water
	// Negative deltaT = below melting → water freezes to ice

	float deltaT = surfaceTemperature - freezingPoint;

	// Calculate phase change amount for this timestep
	// Rate is in m/s, independent of ice/water depth (surface-limited process)
	float phaseChangeAmount = calculatePhaseChangeRate(deltaT) * dt;

	// Apply phase change and track actual amount changed
	float newWaterDepth = waterDepth;
	float newIceThickness = iceThickness;
	float actualPhaseChange = 0.0; // Positive = melting, negative = freezing

	if (deltaT > 0.0) {
		// Above melting point: ice melts to water
		// Limited by available ice
		float meltAmount = min(phaseChangeAmount, iceThickness);
		newIceThickness = iceThickness - meltAmount;
		newWaterDepth = waterDepth + meltAmount;
		actualPhaseChange = meltAmount;
	} else {
		// Below melting point: water freezes to ice
		// phaseChangeAmount is negative, so negate it
		// Limited by available water
		float freezeAmount = min(-phaseChangeAmount, waterDepth);
		newWaterDepth = waterDepth - freezeAmount;
		newIceThickness = iceThickness + freezeAmount;
		actualPhaseChange = -freezeAmount;
	}

	// Ensure non-negative values
	newWaterDepth = max(0.0, newWaterDepth);
	newIceThickness = max(0.0, newIceThickness);

	// === LATENT HEAT CORRECTION ===
	//
	// Phase change absorbs or releases energy, affecting surface temperature:
	// - Melting (ice → water): Absorbs latent heat, keeping the surface cooler
	// - Freezing (water → ice): Releases latent heat, keeping the surface warmer
	//
	// Calculate temperature change due to latent heat absorption/release
	//
	// Energy involved: E = ρ × depth_change × L_f  (J/m²)
	// Temperature change: ΔT = -E / C  (K)
	//   where C = heat capacity per unit area (J/(m²·K))
	//
	// Sign convention: actualPhaseChange > 0 for melting (absorbs heat, cools surface)
	//                  actualPhaseChange < 0 for freezing (releases heat, warms surface)

	float latentHeatEnergy = actualPhaseChange * MATERIAL_ICE_DENSITY * MATERIAL_ICE_LATENT_HEAT_FUSION;
	float heatCapacity = getSurfaceHeatCapacity(newWaterDepth, newIceThickness);
	float latentHeatTemperatureChange = -latentHeatEnergy / heatCapacity;

	// Apply latent heat correction to surface temperature
	float newSurfaceTemperature = surfaceTemperature + latentHeatTemperatureChange;

	// === WATER STATE FOR VISUALISATION ===
	// Determine water state based on temperature thresholds
	// 0.0 = solid (frozen), 0.5 = liquid, 1.0 = vapour (above boiling)
	float isAboveBoilingPoint = step(boilingPoint, newSurfaceTemperature);
	float isAboveMeltingPoint = step(freezingPoint, newSurfaceTemperature) * (1.0 - isAboveBoilingPoint);
	float waterState = isAboveMeltingPoint * 0.5 + isAboveBoilingPoint;

	// Output 0: RGBA = [waterDepth, iceThickness, unused, salinity]
	outHydrologyState = packHydrologyData(newWaterDepth, newIceThickness, salinity);

	// Output 1 (auxiliary): RGBA = [solarFlux (preserved), waterState, unused, unused]
	outAuxiliary = packAuxiliaryData(solarFlux, waterState);

	// Output 2 (surface state): RGBA = [temperature, unused, unused, albedo]
	outSurfaceState = packSurfaceData(newSurfaceTemperature, surfaceAlbedo);
}

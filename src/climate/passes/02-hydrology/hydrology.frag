/**
 * Pass 3: Hydrology
 *
 * Handles water cycle dynamics including:
 * - Ice/water phase transitions (freezing and melting)
 * - Water vaporisation at temperatures above boiling point
 * - Latent heat effects on surface temperature
 * - Atmospheric water vapor updates (vaporised water added to atmosphere)
 * - Precipitation from atmosphere (future)
 *
 * Phase change assumptions:
 * - 1m of water freezes to 1m of ice (and vice versa)
 * - Uses 50m scale depth consistent with thermal calculations
 * - Latent heat absorbed during melting cools the surface
 * - Latent heat released during freezing warms the surface
 * - Latent heat absorbed during vaporisation cools the surface
 *
 * Water vapor physics:
 * - Vaporised water is added to atmospheric precipitable water
 * - Water vapor adds partial pressure to total atmospheric pressure (Dalton's Law)
 * - P_H2O = precipitableWater_mm × surfaceGravity
 */

precision highp float;

#include "../../../rendering/shaders/utility/textureAccessors.glsl"
#include "../../shaders/constants.glsl"
#include "../../shaders/waterVapor.glsl"
#include "../../shaders/surfaceThermal.glsl"

in vec2 vUv;

// Input uniforms
uniform float dt;  // Timestep in seconds
uniform float surfaceGravity;  // m/s² - for water vapor pressure calculations

// Output: Updated hydrology state + auxiliary water state + surface state + atmosphere state
layout(location = 0) out vec4 outHydrologyState;
layout(location = 1) out vec4 outAuxiliary;
layout(location = 2) out vec4 outSurfaceState;
layout(location = 3) out vec4 outAtmosphereState;

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
float getVaporisationPoint(float pressure) {
	// Small wins
	float logP = log(pressure);
	return (-4965.11 + 23.519 * logP) / (-24.0385 + logP);
}

// Calculates the melting point of water as a function of salinity.
// For every PSU of salinity, the melting point is reduced by 0.054 K.
float getMeltingPoint(float salinity) {
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

/**
 * Calculate vaporisation rate based on surface heat flux.
 *
 * Vaporisation occurs when temperature exceeds the boiling point, driven by
 * excess thermal energy. The vaporisation rate is:
 *
 *   rate = h × ΔT / (ρ × L_v)   [m/s]
 *
 * Where:
 *   h = heat transfer coefficient (W/(m²·K))
 *   ΔT = temperature difference from boiling point (K)
 *   ρ = density of water (kg/m³)
 *   L_v = latent heat of vaporisation (J/kg)
 *
 * For water/atmosphere interface with natural convection, similar heat transfer
 * coefficients apply. Using the same coefficient as phase change:
 *   At h = 100 W/(m²·K), ΔT = 1K:
 *   rate = 100 / (1000 × 2260000) ≈ 4.4×10⁻⁸ m/s ≈ 0.0038 m/day ≈ 1.4 m/year
 *
 * This is independent of water depth; only the surface vaporises.
 */
float calculateVaporisationRate(float deltaT) {
	// Heat flux at interface: Q = h × ΔT (W/m²)
	// Vaporisation rate: Q / (ρ_water × L_v) (m/s)
	float heatFlux = PHASE_CHANGE_HEAT_TRANSFER_COEFF * deltaT;
	return heatFlux / (MATERIAL_WATER_DENSITY * MATERIAL_WATER_LATENT_HEAT_VAPORISATION);
}

void main() {
	// Read current hydrology state
	vec4 hydrologyState = texture(hydrologyData, vUv);
	float waterDepth = hydrologyState.r;
	float iceThickness = hydrologyState.g;
	float salinity = hydrologyState.a;

	vec4 atmosphereState = texture(atmosphereData, vUv);
	float atmosphereTemperature = atmosphereState.r;
	float atmospherePressure = atmosphereState.g;
	float precipitableWater_mm = atmosphereState.b;
	float atmosphereAlbedo = atmosphereState.a;

	vec4 surfaceState = texture(surfaceData, vUv);
	float surfaceTemperature = surfaceState.r;
	float surfaceAlbedo = surfaceState.a;

	vec4 currentAuxiliary = texture(auxiliaryData, vUv);
	float solarFlux = currentAuxiliary.r;

	// Calculate phase transition temperatures
	float meltingPoint = getMeltingPoint(salinity);
	float boilingPoint = getVaporisationPoint(atmospherePressure);

	// === PHASE CHANGE DYNAMICS ===
	//
	// Phase change is driven by excess thermal energy beyond the melting point.
	// The rate is determined by the thermal energy budget and latent heat of fusion.
	// Positive deltaT = above melting → ice melts to water
	// Negative deltaT = below melting → water freezes to ice

	float deltaT = surfaceTemperature - meltingPoint;

	// Calculate phase change amount for this timestep
	// Rate is in m/s, independent of ice/water depth (surface-limited process)
	float phaseChangeAmount = calculatePhaseChangeRate(deltaT) * dt;

	// Apply phase change and track actual amount changed
	float newWaterDepth = waterDepth;
	float newIceThickness = iceThickness;
	float actualPhaseChange = 0.0; // Positive = melting, negative = freezing

	// Branchless phase change logic: 
	// Use deltaT sign to control melt/freeze. When deltaT>0, only melt; when deltaT<=0, only freeze.
	float meltAmount = min(max(phaseChangeAmount, 0.0), iceThickness); // Only positive if melting
	float freezeAmount = min(max(-phaseChangeAmount, 0.0), waterDepth); // Only positive if freezing

	newIceThickness = iceThickness - meltAmount + freezeAmount;
	newWaterDepth = waterDepth + meltAmount - freezeAmount;
	actualPhaseChange = meltAmount - freezeAmount; // Positive for melting, negative for freezing

	// Ensure non-negative values
	newWaterDepth = max(0.0, newWaterDepth);
	newIceThickness = max(0.0, newIceThickness);

	// === VAPORISATION DYNAMICS ===
	//
	// When temperature exceeds the boiling point, water vaporises.
	// Vaporised water is added to the atmosphere as water vapor, which:
	// - Increases precipitable water (mm)
	// - Increases total atmospheric pressure (Dalton's Law)
	//
	// Vaporisation only occurs when:
	// 1. Temperature is above boiling point
	// 2. There is liquid water present (not just ice)
	// 3. Ice has melted (ice floats on water, so vaporisation occurs from water surface)

	float deltaT_vaporisation = surfaceTemperature - boilingPoint;
	float vaporisationAmount = 0.0;

	// Vaporisation only occurs if above boiling and water present
	float vaporiseCond = step(0.0, deltaT_vaporisation) * step(0.0, newWaterDepth); // 1.0 if both true else 0.0
	float vaporisationRate = calculateVaporisationRate(deltaT_vaporisation) * vaporiseCond;
	float potentialVaporisation = vaporisationRate * dt;

	// Limit by available water, only if vaporisation is happening
	vaporisationAmount = min(potentialVaporisation, newWaterDepth) * vaporiseCond;
	newWaterDepth = newWaterDepth - vaporisationAmount;

	// Ensure non-negative values after vaporisation
	newWaterDepth = max(0.0, newWaterDepth);

	// === ATMOSPHERIC WATER VAPOR UPDATE ===
	//
	// Add vaporised water to atmosphere using Dalton's Law:
	// P_total = P_dry + P_H2O
	//
	// Water vapor partial pressure: P_H2O = precipitableWater_mm × g
	// (1mm precipitable water = 1 kg/m², and P = m × g)

	// Convert vaporised water depth to precipitable water increase
	float precipitableWaterIncrease = waterDepthToPrecipitableWater(vaporisationAmount);
	float newPrecipitableWater = precipitableWater_mm + precipitableWaterIncrease;

	// Update total pressure: derive dry pressure, then add new water vapor pressure
	float dryPressure = calculateDryPressure(atmospherePressure, precipitableWater_mm, surfaceGravity);
	float newAtmospherePressure = dryPressure + calculateWaterVaporPressure(newPrecipitableWater, surfaceGravity);

	// === LATENT HEAT CORRECTIONS ===
	//
	// Phase change absorbs or releases energy, affecting surface temperature:
	// - Melting (ice → water): Absorbs latent heat and keeps the surface cooler.
	// - Freezing (water → ice): Releases latent heat and keeps the surface warmer.
	// - Vaporisation (water → vapour): Absorbs latent heat and keeps the surface cooler.
	//
	// The net effect is that when water is undergoing a phase change, the surface temperature
	// seems to hover in temperature for a bit.
	//
	// Calculate temperature change due to latent heat absorption/release
	//
	// Energy involved: E = ρ × depth_change × L  (J/m²)
	// Temperature change: ΔT = -E / C  (K)
	//   where C = heat capacity per unit area (J/(m²·K))
	//
	// Sign convention: actualPhaseChange > 0 for melting (absorbs heat, cools surface)
	//                  actualPhaseChange < 0 for freezing (releases heat, warms surface)
	//                  vaporisationAmount > 0 for vaporisation (absorbs heat, cools surface)

	float fusionLatentHeatEnergy = actualPhaseChange * MATERIAL_ICE_DENSITY * MATERIAL_ICE_LATENT_HEAT_FUSION;
	float vaporisationLatentHeatEnergy = vaporisationAmount * MATERIAL_WATER_DENSITY * MATERIAL_WATER_LATENT_HEAT_VAPORISATION;
	float totalLatentHeatEnergy = fusionLatentHeatEnergy + vaporisationLatentHeatEnergy;
	
	float heatCapacity = getSurfaceHeatCapacity(newWaterDepth, newIceThickness);
	float latentHeatTemperatureChange = -totalLatentHeatEnergy / heatCapacity;

	// Apply latent heat correction to surface temperature
	float newSurfaceTemperature = surfaceTemperature + latentHeatTemperatureChange;

	// Where there's no water nor ice, the salinity value should be cleared, otherwise preserve the value
	// Use a small epsilon to check if both are effectively zero (branchless)
	float hasWaterOrIce = step(1e-6, newWaterDepth) + step(1e-6, newIceThickness);
	float newSalinity = salinity * min(hasWaterOrIce, 1.0);

	// === SURFACE ALBEDO UPDATE ===
	// Calculate new albedo based on updated hydrology state
	// Ice and water have different albedos than bare rock
	float newSurfaceAlbedo = getAlbedo(newWaterDepth, newIceThickness, MATERIAL_ROCK_ALBEDO_VISIBLE);

	// === WATER STATE FOR VISUALISATION ===
	// Determine water state based on temperature thresholds
	// 0.0 = solid (frozen), 0.5 = liquid, 1.0 = vapour (above boiling)
	float isAboveBoilingPoint = step(boilingPoint, newSurfaceTemperature);
	float isAboveMeltingPoint = step(meltingPoint, newSurfaceTemperature) * (1.0 - isAboveBoilingPoint);
	float waterState = isAboveMeltingPoint * 0.5 + isAboveBoilingPoint;

	// Output 0: RGBA = [waterDepth, iceThickness, unused, salinity]
	outHydrologyState = packHydrologyData(newWaterDepth, newIceThickness, newSalinity);

	// Output 1 (auxiliary): RGBA = [solarFlux (preserved), waterState, unused, unused]
	outAuxiliary = packAuxiliaryData(solarFlux, waterState);

	// Output 2 (surface state): RGBA = [temperature, unused, unused, albedo]
	outSurfaceState = packSurfaceData(newSurfaceTemperature, newSurfaceAlbedo);

	// Output 3 (atmosphere state): RGBA = [temperature, pressure, precipitableWater, albedo]
	// Atmosphere temperature unchanged by hydrology (radiation handles that)
	// Pressure and precipitableWater updated by vaporisation
	outAtmosphereState = packAtmosphereData(atmosphereTemperature, newAtmospherePressure, newPrecipitableWater, atmosphereAlbedo);
}

/**
 * Surface thermal properties utility
 *
 * Provides thermal property calculations that account for surface type:
 * - Bare rock/ground
 * - Water (liquid)
 * - Ice (frozen water)
 *
 * Ice has distinct thermal properties from liquid water:
 * - Lower specific heat (~2090 J/(kg·K) vs 4180 J/(kg·K))
 * - Higher albedo (~0.60 vs 0.06) - ice reflects more sunlight
 * - Slightly higher emissivity (~0.98 vs 0.96)
 *
 * When both water and ice are present, ice floats on top and dominates
 * the surface optical properties (albedo, emissivity), while thermal
 * capacity is a weighted blend based on relative depths.
 */

#ifndef SURFACE_THERMAL_GLSL
#define SURFACE_THERMAL_GLSL

/**
 * Calculates the effective surface heat capacity based on water/ice coverage.
 *
 * The heat capacity is calculated as a weighted average based on the relative
 * amounts of rock, water, and ice. When ice is on top of water, both contribute
 * to the effective thermal mass.
 *
 * @param waterDepth   Water depth in metres (from hydrology texture R channel)
 * @param iceThickness Ice thickness in metres (from hydrology texture G channel)
 * @return Heat capacity per unit area in J/(m²·K)
 */
float getSurfaceHeatCapacity(float waterDepth, float iceThickness) {
	float totalHydrology = waterDepth + iceThickness;
	float hasWaterOrIce = step(0.001, totalHydrology);

	// When hydrology is present, blend between water and ice properties
	// based on their relative proportions
	float iceFraction = iceThickness / max(totalHydrology, 0.001);

	float hydrologyHeatCapacity = mix(
		MATERIAL_WATER_HEAT_CAPACITY_PER_AREA,
		MATERIAL_ICE_HEAT_CAPACITY_PER_AREA,
		iceFraction
	);

	// Mix between rock and hydrology heat capacity
	return mix(
		MATERIAL_ROCK_HEAT_CAPACITY_PER_AREA,
		hydrologyHeatCapacity,
		hasWaterOrIce
	);
}

/**
 * Calculates effective surface emissivity based on water/ice coverage.
 *
 * Ice floats on top of water, so when ice is present it dominates the
 * surface emissivity. Only when ice is absent does liquid water's
 * emissivity apply.
 *
 * @param waterDepth   Water depth in metres
 * @param iceThickness Ice thickness in metres
 * @return Emissivity (0-1)
 */
float getSurfaceEmissivity(float waterDepth, float iceThickness) {
	float hasWater = step(0.001, waterDepth);
	float hasIce = step(0.001, iceThickness);

	// Ice on top dominates, otherwise water, otherwise rock
	// Ice takes priority since it floats on water
	float emissivity = MATERIAL_ROCK_EMISSIVITY;
	emissivity = mix(emissivity, MATERIAL_WATER_EMISSIVITY, hasWater);
	emissivity = mix(emissivity, MATERIAL_ICE_EMISSIVITY, hasIce);

	return emissivity;
}

/**
 * Calculates effective surface albedo based on water/ice coverage.
 *
 * Ice floats on top of water, so when ice is present it dominates the
 * surface albedo. This has significant climate implications - ice-covered
 * regions reflect much more sunlight than open water.
 *
 * @param waterDepth   Water depth in metres
 * @param iceThickness Ice thickness in metres
 * @param baseAlbedo   Base albedo of underlying terrain
 * @return Effective visible albedo (0-1)
 */
float getEffectiveAlbedo(float waterDepth, float iceThickness, float baseAlbedo) {
	float hasWater = step(0.001, waterDepth);
	float hasIce = step(0.001, iceThickness);

	// Start with base terrain albedo
	float albedo = baseAlbedo;

	// Water overwrites terrain albedo
	albedo = mix(albedo, MATERIAL_WATER_ALBEDO_VISIBLE, hasWater);

	// Ice on top overwrites water albedo (ice floats)
	albedo = mix(albedo, MATERIAL_ICE_ALBEDO_VISIBLE, hasIce);

	return albedo;
}

/**
 * Calculates effective surface thermal conductivity based on water/ice coverage.
 *
 * Thermal conductivity determines how well heat conducts through the material.
 * Ice has higher thermal conductivity than water, and both are higher than rock.
 * When ice is present, it dominates since it's on top.
 *
 * @param waterDepth   Water depth in metres
 * @param iceThickness Ice thickness in metres
 * @return Thermal conductivity in W/(m·K)
 */
float getSurfaceThermalConductivity(float waterDepth, float iceThickness) {
	float hasWater = step(0.001, waterDepth);
	float hasIce = step(0.001, iceThickness);

	// Start with rock thermal conductivity
	float thermalConductivity = MATERIAL_ROCK_THERMAL_CONDUCTIVITY;

	// Water overwrites rock
	thermalConductivity = mix(thermalConductivity, MATERIAL_WATER_THERMAL_CONDUCTIVITY, hasWater);

	// Ice on top overwrites water (ice floats)
	thermalConductivity = mix(thermalConductivity, MATERIAL_ICE_THERMAL_CONDUCTIVITY, hasIce);

	return thermalConductivity;
}

#endif // SURFACE_THERMAL_GLSL

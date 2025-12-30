/**
 * Surface thermal properties utility
 *
 * Provides heat capacity calculations that account for surface type:
 * - Bare rock/ground
 * - Water (liquid)
 * - Ice
 *
 * Currently, water and ice are treated as having the same thermal properties.
 */

#ifndef SURFACE_THERMAL_GLSL
#define SURFACE_THERMAL_GLSL

/**
 * Calculates the effective surface heat capacity based on water/ice coverage.
 *
 * When water or ice is present, the surface takes on water's thermal properties.
 * Otherwise, bare rock properties are used.
 *
 * @param waterDepth   Water depth in metres (from hydrology texture R channel)
 * @param iceThickness Ice thickness in metres (from hydrology texture G channel)
 * @return Heat capacity per unit area in J/(m²·K)
 */
float getSurfaceHeatCapacity(float waterDepth, float iceThickness) {
	// If any water or ice is present, use water thermal properties
	float hasWaterOrIce = step(0.001, waterDepth + iceThickness);

	// Mix between rock and water heat capacity based on presence of water/ice
	return mix(
		MATERIAL_ROCK_HEAT_CAPACITY_PER_AREA,
		MATERIAL_WATER_HEAT_CAPACITY_PER_AREA,
		hasWaterOrIce
	);
}

/**
 * Calculates effective surface emissivity based on water/ice coverage.
 *
 * @param waterDepth   Water depth in metres
 * @param iceThickness Ice thickness in metres
 * @return Emissivity (0-1)
 */
float getSurfaceEmissivity(float waterDepth, float iceThickness) {
	float hasWaterOrIce = step(0.001, waterDepth + iceThickness);

	return mix(
		MATERIAL_ROCK_EMISSIVITY,
		MATERIAL_WATER_EMISSIVITY,
		hasWaterOrIce
	);
}

#endif // SURFACE_THERMAL_GLSL

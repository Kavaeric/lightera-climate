/**
 * Water vapour utility functions
 *
 * Shared by radiation and hydrology passes for consistent handling of:
 * - Water vapour partial pressure
 * - Dry vs total pressure separation
 * - H2O column density calculations
 * - Heat capacity adjustments
 *
 * Physics basis:
 * - Dalton's Law: P_total = P_dry + P_H2O
 * - Water vapour adds to atmospheric pressure, doesn't dilute other gases
 * - 1mm precipitable water = 1 kg/m² of water mass
 */

// Water vapour molar mass
const float H2O_MOLAR_MASS = 18.01528e-3; // kg/mol

// Water vapour specific heat at constant pressure
const float H2O_SPECIFIC_HEAT = 1996.0; // J/(kg·K)

// Avogadro's number (also in kDistribution.glsl, but needed here for standalone use)
const float AVOGADRO = 6.02214076e23; // molecules/mol

/**
 * Calculates water vapour partial pressure from precipitable water.
 *
 * P_H2O = precipitableWater_mm × g
 *
 * Derivation:
 *   1mm precipitable water = 1 kg/m² of water mass
 *   Hydrostatic: P = m × g where m is mass per unit area
 *
 * Example (Earth):
 *   25mm × 9.81 m/s² = 245 Pa (~0.24% of 101325 Pa)
 *
 * @param precipitableWater_mm Column water vapour in mm (= kg/m²)
 * @param gravity_m_s2 Surface gravity in m/s²
 * @return Water vapour partial pressure in Pa
 */
float calculateWaterVapourPressure(float precipitableWater_mm, float gravity_m_s2) {
	return precipitableWater_mm * gravity_m_s2;
}

/**
 * Calculates dry pressure from total pressure.
 *
 * P_dry = P_total - P_H2O
 *
 * Used to derive dry air pressure for calculating dry gas column densities.
 * Ensures dry gas amounts remain constant regardless of water vapour content.
 *
 * @param totalPressure_Pa Total atmospheric pressure in Pa
 * @param precipitableWater_mm Column water vapour in mm
 * @param gravity_m_s2 Surface gravity in m/s²
 * @return Dry air pressure in Pa (clamped to >= 0)
 */
float calculateDryPressure(float totalPressure_Pa, float precipitableWater_mm, float gravity_m_s2) {
	return max(0.0, totalPressure_Pa - calculateWaterVapourPressure(precipitableWater_mm, gravity_m_s2));
}

/**
 * Calculates H2O column density directly from precipitable water mass.
 *
 * This avoids the dilution problem by not treating H2O as a molar fraction
 * of the total atmosphere. Instead, we calculate H2O molecules directly
 * from the mass of water vapour.
 *
 * N_H2O = mass / molecular_mass
 *       = (pw_mm kg/m²) / (M_H2O / Avogadro)
 *       = (pw_mm × Avogadro) / M_H2O
 *
 * @param precipitableWater_mm Column water vapour in mm (= kg/m²)
 * @return H2O column density in molecules/cm²
 */
float calculateH2OColumnDensity(float precipitableWater_mm) {
	float molecularMass_kg = H2O_MOLAR_MASS / AVOGADRO; // kg/molecule
	float massPerArea_kg_m2 = precipitableWater_mm; // 1mm = 1 kg/m²
	float molecules_per_m2 = massPerArea_kg_m2 / molecularMass_kg;
	return molecules_per_m2 / SQUARE_METRES_TO_SQUARE_CM;
}

/**
 * Converts water depth (m) to precipitable water (mm).
 *
 * Used when vaporising liquid water to add to atmospheric water vapour.
 *
 * 1m water × 1000 kg/m³ density = 1000 kg/m² = 1000mm precipitable water
 *
 * @param waterDepth_m Depth of liquid water in metres
 * @return Equivalent precipitable water in mm
 */
float waterDepthToPrecipitableWater(float waterDepth_m) {
	return waterDepth_m * 1000.0;
}

/**
 * Adjusts atmosphere heat capacity for water vapour content.
 *
 * Water vapour has higher specific heat (~2.0 kJ/(kg·K)) than dry air (~1.0 kJ/(kg·K)).
 * This function adds the water vapour contribution to the dry atmosphere heat capacity.
 *
 * C_total = C_dry + (pw_mm × c_p_h2o)
 *
 * Units: J/(m²·K) + (kg/m² × J/(kg·K)) = J/(m²·K)
 *
 * Example (Earth):
 *   Dry atmosphere: ~1.03×10⁷ J/(m²·K)
 *   25mm water vapour: 25 × 1996 = 49,900 J/(m²·K) (~0.5% increase)
 *
 * @param dryHeatCapacity Dry atmosphere heat capacity in J/(m²·K)
 * @param precipitableWater_mm Column water vapour in mm (= kg/m²)
 * @return Total atmosphere heat capacity in J/(m²·K)
 */
float adjustHeatCapacityForWaterVapour(float dryHeatCapacity, float precipitableWater_mm) {
	return dryHeatCapacity + precipitableWater_mm * H2O_SPECIFIC_HEAT;
}

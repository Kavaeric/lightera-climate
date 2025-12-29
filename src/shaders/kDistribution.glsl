/**
 * Correlated-k distribution method for atmospheric radiative transfer
 *
 * Implements the correlated-k method to calculate atmospheric transmission
 * using pre-computed k-distributions from HITRAN line-by-line data.
 *
 * HYBRID APPROACH (Optimised):
 * - Dry gases (CO2, CH4, N2O, O3): Pre-computed 1D lookup by temperature
 * - Water vapour (H2O): Per-cell calculation with full 128-bin resolution
 *
 * This reduces texture fetches from ~1800 to ~385 per transmission calculation
 * while supporting spatially-varying humidity.
 *
 * The correlated-k method correctly handles spectral variation within wavelength
 * bins, avoiding Jensen's inequality: exp(-avg(σ)N) ≠ avg(exp(-σN))
 *
 * For each wavelength bin:
 *   T_bin = Σ w_i × exp(-k_i × N)
 *
 * where:
 *   - k_i are absorption cross-sections (cm²/molecule)
 *   - w_i are spectral weights (sum to 1.0)
 *   - N is column density (molecules/cm²)
 *
 * Reference: src/experiment/physics.ts lines 111-236
 *
 * Note: This file expects constants from constants.glsl and planck.glsl to be
 * already included by the parent shader (to avoid duplicate definitions).
 */

precision highp float;

// Note: Constants like SQUARE_METRES_TO_SQUARE_CM and Planck constants
// are expected to be defined by the including shader via constants.glsl

// === FULL RESOLUTION CONFIGURATION ===
// Wavelength bins (128 bins, log-spaced from 1 to 70 μm)
// Ensure these match the actual values in the various offline generated data files (/script/ directory).
const int NUM_WAVELENGTH_BINS = 128;
const int NUM_K_VALUES_PER_BIN = 4;


// Pre-computed Planck constants for performance
// Numerator: 2πhc² (W·m²)
const float PLANCK_NUMERATOR = 2.0 * PI * PLANCK_CONST * SPEED_OF_LIGHT * SPEED_OF_LIGHT;

// Exponent factor: hc/k (m·K)
const float PLANCK_EXPONENT_FACTOR = PLANCK_CONST * SPEED_OF_LIGHT / BOLTZMANN_CONST;

// Unit conversion: π × 1e-6 for converting to W/(m²·μm)
const float PLANCK_UNIT_CONVERSION = PI * 1e-6;

/**
 * Calculate spectral exitance using Planck's law
 *
 * M_λ(λ, T) = (2πhc² / λ⁵) / (e^(hc/λkT) - 1)
 *
 * Optimised version with pre-computed constants.
 *
 * @param wavelength_um Wavelength in micrometres (μm)
 * @param temperature_K Temperature in Kelvin (K)
 * @return Spectral exitance in W/(m²·μm)
 */
float planckSpectralExitance(float wavelength_um, float temperature_K) {
	// Convert wavelength from μm to m
	float wavelength_m = wavelength_um * 1e-6;

	// Calculate denominator: λ⁵ × (e^(hc/λkT) - 1)
	float wavelength5 = pow(wavelength_m, 5.0);
	float exponent = PLANCK_EXPONENT_FACTOR / (wavelength_m * temperature_K);
	float denominator = wavelength5 * (exp(exponent) - 1.0);

	// Spectral radiance: B_λ = numerator / denominator (W/(m²·sr·m))
	float spectralRadiance = PLANCK_NUMERATOR / denominator;

	// Convert to spectral exitance and apply unit conversion
	return spectralRadiance * PLANCK_UNIT_CONVERSION; // W/(m²·μm)
}

// Multi-gas k-distribution texture uniform (set in material)
// Texture layout: 128×7, RGBA = [k0, k1, k2, k3]
// Rows: 0=CO2, 1=H2O, 2=CH4, 3=N2O, 4=O3, 5=O2, 6=N2
uniform sampler2D multiGasKDistributionTexture;

// Gas indices (match texture row layout)
const int GAS_CO2 = 0;
const int GAS_H2O = 1;
const int GAS_CH4 = 2;
const int GAS_N2O = 3;
const int GAS_O3 = 4;
const int GAS_O2 = 5;
const int GAS_N2 = 6;
const int NUM_GASES = 7;

// Wavelength + binWidth texture uniform (set in material)
// Texture layout: 128×1, RG = [wavelength (μm), binWidth (μm)]
uniform sampler2D wavelengthBinWidthTexture;

// Planck lookup texture uniform (optional - for performance)
// Texture layout: 128 (wavelengths) × 1000 (temperatures), R = spectral exitance in W/(m²·μm)
uniform sampler2D planckLookupTexture;
uniform float planckTempMin; // Minimum temperature in lookup table (K)
uniform float planckTempMax; // Maximum temperature in lookup table (K)

// === HYBRID TRANSMISSION TEXTURES ===

// Dry transmission lookup texture (pre-computed for CO2, CH4, N2O, O3)
// Texture layout: 1000×1, R = transmission coefficient [0,1]
// Indexed by temperature (1-1000K)
uniform sampler2D dryTransmissionTexture;
uniform float dryTransmissionTempMin;
uniform float dryTransmissionTempMax;


/**
 * Get Planck spectral exitance from lookup table (optimised version)
 *
 * Uses pre-computed values with linear interpolation for temperature.
 * ~20x faster than computing Planck function directly.
 *
 * @param wavelength_um Wavelength in micrometres (μm)
 * @param temperature_K Temperature in Kelvin (K)
 * @return Spectral exitance in W/(m²·μm)
 */
float planckSpectralExitanceLookup(float wavelength_um, float temperature_K, int binIndex) {
	// Clamp temperature to lookup table range
	float temp = clamp(temperature_K, planckTempMin, planckTempMax);

	// Calculate texture v coordinate (temperature)
	float v = (temp - planckTempMin) / (planckTempMax - planckTempMin);

	// Calculate texture u coordinate (wavelength bin)
	float u = (float(binIndex) + 0.5) / float(NUM_WAVELENGTH_BINS);

	// Sample pre-computed Planck value with linear interpolation
	return texture(planckLookupTexture, vec2(u, v)).r;
}

/**
 * Calculate atmospheric column density from surface pressure and gravity
 *
 * Uses hydrostatic equilibrium: N_total = (P / g) / m_mean
 *
 * @param pressure_Pa Surface pressure in Pascals
 * @param gravity_m_s2 Surface gravity in m/s²
 * @param meanMolecularMass_kg Mean molecular mass in kg/molecule
 * @return Column density in molecules/cm²
 */
float calculateColumnDensity(float pressure_Pa, float gravity_m_s2, float meanMolecularMass_kg) {
	// Calculate total column in molecules/m²
	// N = (P / g) / m_mean
	// Units: (Pa / (m/s²)) / kg = (kg/(m·s²) / (m/s²)) / kg = molecules/m²
	float totalColumn_m2 = pressure_Pa / gravity_m_s2 / meanMolecularMass_kg;

	// Convert to molecules/cm²
	return totalColumn_m2 / SQUARE_METRES_TO_SQUARE_CM;
}

// Pre-computed k-distribution weight (all weights are equal)
const float K_WEIGHT = 0.25; // 1.0 / 4.0

/**
 * Calculates transmission for a single wavelength bin for a specific gas.
 *
 * T_bin = Σ w_i × exp(-k_i × N)
 *
 * Uses GPU vectors for better performance.
 *
 * @param binIndex Wavelength bin index (0-127)
 * @param gasIndex Gas index (0-6, see GAS_* constants)
 * @param columnDensity_cm2 Gas column density in molecules/cm²
 * @return Transmission coefficient [0,1]
 */
float calculateBinTransmission(int binIndex, int gasIndex, float columnDensity_cm2) {
	// Read k-values from multi-gas texture
	// u = wavelength bin, v = gas index
	float u = (float(binIndex) + 0.5) / float(NUM_WAVELENGTH_BINS);
	float v = (float(gasIndex) + 0.5) / float(NUM_GASES);
	vec4 kValues = texture(multiGasKDistributionTexture, vec2(u, v));

	// Calculate optical depths as vector operation: τ = k × N
	vec4 opticalDepths = kValues * columnDensity_cm2;

	// Calculate all 4 transmissions: T_i = exp(-τ_i)
	vec4 transmissions = exp(-opticalDepths);

	// Weight-averaged transmission using dot product
	return dot(transmissions, vec4(K_WEIGHT));
}

/**
 * Calculate blackbody-weighted transmission coefficient for multiple gases
 *
 * Integrates transmission over wavelength bins weighted by Planck spectrum.
 * Combines transmission from all gases multiplicatively (Beer's law).
 *
 * For multiple gases: T_total(λ) = T_gas1(λ) × T_gas2(λ) × ... × T_gasN(λ)
 *
 * T_eff = (∫ T_total(λ) B(λ,T) dλ) / (∫ B(λ,T) dλ)
 *
 * @param temperature_K Blackbody temperature in Kelvin
 * @param columnDensities Array of column densities for each gas (molecules/cm²)
 *        Order: [CO2, H2O, CH4, N2O, O3, O2, N2]
 * @return Effective transmission coefficient [0,1]
 */
float calculateMultiGasTransmission(
	float temperature_K,
	float columnDensities[NUM_GASES]
) {
	float totalFlux = 0.0;
	float transmittedFlux = 0.0;

	// Integrate over wavelength bins
	for (int i = 0; i < NUM_WAVELENGTH_BINS - 1; i++) {
		// Read wavelength and binWidth
		float u = (float(i) + 0.5) / float(NUM_WAVELENGTH_BINS);
		vec2 wavelengthData = texture(wavelengthBinWidthTexture, vec2(u, 0.5)).rg;
		float wavelength_um = wavelengthData.r;
		float binWidth = wavelengthData.g;

		// Get Planck spectral exitance from lookup table
		float spectralExitance = planckSpectralExitanceLookup(wavelength_um, temperature_K, i);
		float binFlux = spectralExitance * binWidth;

		// Calculate combined transmission for all gases (multiplicative)
		// T_total = T_CO2 × T_H2O × T_CH4 × T_N2O × T_O3 × T_O2 × T_N2
		float transmission = 1.0;
		for (int gasIdx = 0; gasIdx < NUM_GASES; gasIdx++) {
			float gasTransmission = calculateBinTransmission(i, gasIdx, columnDensities[gasIdx]);
			transmission *= gasTransmission;
		}

		// Accumulate weighted fluxes
		totalFlux += binFlux;
		transmittedFlux += binFlux * transmission;
	}

	// Return fraction transmitted
	return transmittedFlux / totalFlux;
}

// =============================================================================
// HYBRID TRANSMISSION FUNCTIONS (OPTIMISED)
// =============================================================================

/**
 * Look up pre-computed dry gas transmission from texture
 *
 * Returns the blackbody-weighted transmission for dry gases (CO2, CH4, N2O, O3)
 * at the specified temperature. This replaces ~500 texture fetches with 1.
 *
 * @param temperature_K Temperature in Kelvin
 * @return Dry gas transmission coefficient [0,1]
 */
float getDryTransmission(float temperature_K) {
	// Clamp temperature to lookup table range
	float temp = clamp(temperature_K, dryTransmissionTempMin, dryTransmissionTempMax);

	// Calculate texture u coordinate (temperature)
	float u = (temp - dryTransmissionTempMin) / (dryTransmissionTempMax - dryTransmissionTempMin);

	// Sample with linear interpolation
	return texture(dryTransmissionTexture, vec2(u, 0.5)).r;
}

/**
 * Calculate blackbody-weighted H2O transmission using full resolution
 *
 * Uses all 128 wavelength bins for accurate spectral integration.
 *
 * @param temperature_K Blackbody temperature in Kelvin
 * @param h2oColumnDensity H2O column density in molecules/cm²
 * @return H2O transmission coefficient [0,1]
 */
float calculateH2OTransmission(float temperature_K, float h2oColumnDensity) {
	// Early exit if no water vapour
	if (h2oColumnDensity <= 0.0) {
		return 1.0;
	}

	float totalFlux = 0.0;
	float transmittedFlux = 0.0;

	// Integrate over all wavelength bins
	for (int i = 0; i < NUM_WAVELENGTH_BINS - 1; i++) {
		// Read wavelength and binWidth
		float u = (float(i) + 0.5) / float(NUM_WAVELENGTH_BINS);
		vec2 wavelengthData = texture(wavelengthBinWidthTexture, vec2(u, 0.5)).rg;
		float binWidth = wavelengthData.g;

		// Get Planck spectral exitance from lookup table
		float spectralExitance = planckSpectralExitanceLookup(wavelengthData.r, temperature_K, i);
		float binFlux = spectralExitance * binWidth;

		// Calculate H2O transmission for this bin
		float h2oTransmission = calculateBinTransmission(i, GAS_H2O, h2oColumnDensity);

		// Accumulate weighted fluxes
		totalFlux += binFlux;
		transmittedFlux += binFlux * h2oTransmission;
	}

	// Return fraction transmitted
	return totalFlux > 0.0 ? transmittedFlux / totalFlux : 1.0;
}

/**
 * Calculate total atmospheric transmission using hybrid approach
 *
 * HYBRID METHOD:
 * - Dry gases (CO2, CH4, N2O, O3): Single texture lookup (pre-computed)
 * - Water vapour (H2O): Per-cell calculation with full 128-bin resolution
 *
 * Total transmission = T_dry × T_H2O (Beer's law, multiplicative)
 *
 * Performance: ~385 texture fetches vs ~1800 for full 7-gas calculation
 * (~79% reduction while supporting per-cell humidity variation)
 *
 * @param temperature_K Blackbody temperature in Kelvin
 * @param h2oColumnDensity H2O column density in molecules/cm²
 * @return Total transmission coefficient [0,1]
 */
float calculateHybridTransmission(float temperature_K, float h2oColumnDensity) {
	// Get pre-computed dry gas transmission (1 texture fetch)
	float dryTransmission = getDryTransmission(temperature_K);

	// Calculate H2O transmission per-cell (~384 texture fetches: 128 bins × 3 textures)
	float h2oTransmission = calculateH2OTransmission(temperature_K, h2oColumnDensity);

	// Combine multiplicatively (Beer's law)
	return dryTransmission * h2oTransmission;
}

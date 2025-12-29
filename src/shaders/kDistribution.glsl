/**
 * Correlated-k distribution method for atmospheric radiative transfer
 *
 * Implements the correlated-k method to calculate atmospheric transmission
 * using pre-computed k-distributions from HITRAN line-by-line data.
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

// Note: Constants like SQUARE_METERS_TO_SQUARE_CM and Planck constants
// are expected to be defined by the including shader via constants.glsl

// Wavelength bins (128 bins, log-spaced from 1 to 70 μm)
const int NUM_WAVELENGTH_BINS = 128;
const int NUM_K_VALUES_PER_BIN = 4;

/**
 * Calculate spectral exitance using Planck's law
 *
 * M_λ(λ, T) = (2πhc² / λ⁵) / (e^(hc/λkT) - 1)
 *
 * @param wavelength_um Wavelength in micrometers (μm)
 * @param temperature_K Temperature in Kelvin (K)
 * @return Spectral exitance in W/(m²·μm)
 */
float planckSpectralExitance(float wavelength_um, float temperature_K) {
	// Convert wavelength from μm to m
	float wavelength_m = wavelength_um * 1e-6;

	// Calculate numerator: 2πhc²
	float numerator = 2.0 * PI * PLANCK_CONST * SPEED_OF_LIGHT * SPEED_OF_LIGHT;

	// Calculate denominator: λ⁵ × (e^(hc/λkT) - 1)
	float wavelength5 = pow(wavelength_m, 5.0);
	float exponent = (PLANCK_CONST * SPEED_OF_LIGHT) / (wavelength_m * BOLTZMANN_CONST * temperature_K);
	float denominator = wavelength5 * (exp(exponent) - 1.0);

	// Spectral radiance: B_λ = numerator / denominator (W/(m²·sr·m))
	float spectralRadiance = numerator / denominator;

	// Convert to spectral exitance: M_λ = π × B_λ (W/(m²·m))
	// Then convert from per-meter to per-micrometer: multiply by 1e-6
	return spectralRadiance * PI * 1e-6; // W/(m²·μm)
}

// K-distribution texture uniform (set in material)
// Texture layout: 128×1, RGBA = [k0, k1, k2, k3]
uniform sampler2D kDistributionTexture;

// Wavelength texture uniform (set in material)
// Texture layout: 128×1, R = wavelength in μm
uniform sampler2D wavelengthTexture;

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
	return totalColumn_m2 / SQUARE_METERS_TO_SQUARE_CM;
}

/**
 * Calculate transmission for a single wavelength bin using k-distribution
 *
 * T_bin = Σ w_i × exp(-k_i × N)
 *
 * @param binIndex Wavelength bin index (0-127)
 * @param columnDensity_cm2 Gas column density in molecules/cm²
 * @return Transmission coefficient [0,1]
 */
float calculateBinTransmission(int binIndex, float columnDensity_cm2) {
	// Read k-values from texture
	// Texture coordinate: u = (binIndex + 0.5) / 128, v = 0.5
	float u = (float(binIndex) + 0.5) / float(NUM_WAVELENGTH_BINS);
	vec4 kValues = texture(kDistributionTexture, vec2(u, 0.5));

	// All weights are equal (0.25) for our k-distribution
	float weight = 1.0 / float(NUM_K_VALUES_PER_BIN);

	// Calculate weighted transmission: Σ w_i × exp(-k_i × N)
	// Optical depth: τ = k × N
	// Transmission: T = exp(-τ)
	float transmission = 0.0;
	transmission += weight * exp(-kValues.r * columnDensity_cm2);
	transmission += weight * exp(-kValues.g * columnDensity_cm2);
	transmission += weight * exp(-kValues.b * columnDensity_cm2);
	transmission += weight * exp(-kValues.a * columnDensity_cm2);

	return transmission;
}

/**
 * Calculate blackbody-weighted transmission coefficient
 *
 * Integrates transmission over wavelength bins weighted by Planck spectrum.
 * This gives the fraction of thermal radiation that escapes to space.
 *
 * T_eff = (∫ T(λ) B(λ,T) dλ) / (∫ B(λ,T) dλ)
 *
 * where B(λ,T) is the Planck function (spectral exitance).
 *
 * @param temperature_K Blackbody temperature in Kelvin
 * @param columnDensity_cm2 Gas column density in molecules/cm²
 * @return Effective transmission coefficient [0,1]
 */
float calculateBlackbodyWeightedTransmission(
	float temperature_K,
	float columnDensity_cm2
) {
	float totalFlux = 0.0;
	float transmittedFlux = 0.0;

	// Integrate over wavelength bins using trapezoidal rule
	for (int i = 0; i < NUM_WAVELENGTH_BINS - 1; i++) {
		// Read wavelength bin center
		float u = (float(i) + 0.5) / float(NUM_WAVELENGTH_BINS);
		float wavelength_um = texture(wavelengthTexture, vec2(u, 0.5)).r;

		// Read next wavelength for bin width
		float u_next = (float(i + 1) + 0.5) / float(NUM_WAVELENGTH_BINS);
		float wavelength_next = texture(wavelengthTexture, vec2(u_next, 0.5)).r;
		float binWidth = wavelength_next - wavelength_um;

		// Calculate Planck spectral exitance at bin center
		float spectralExitance = planckSpectralExitance(wavelength_um, temperature_K);
		float binFlux = spectralExitance * binWidth;

		// Calculate transmission for this bin
		float transmission = calculateBinTransmission(i, columnDensity_cm2);

		// Accumulate weighted fluxes
		totalFlux += binFlux;
		transmittedFlux += binFlux * transmission;
	}

	// Return fraction transmitted
	return transmittedFlux / totalFlux;
}

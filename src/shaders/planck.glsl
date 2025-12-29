/**
 * Planck's law for blackbody radiation
 *
 * Calculates the spectral exitance (power per unit area per unit wavelength)
 * emitted by a blackbody at a given temperature.
 *
 * Reference: src/experiment/physics.ts lines 32-42
 *
 * Note: This file expects PLANCK_CONST, SPEED_OF_LIGHT, BOLTZMANN_CONST, and PI
 * to be defined by the including file (typically from constants.glsl)
 */

precision highp float;

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

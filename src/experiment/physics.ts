/**
 * Physical constants and functions for atmospheric calculations
 */

export const PHYSICS_CONSTANTS = {
	// Fundamental constants
	AVOGADRO: 6.02214076e23,        // molecules/mol
	PLANCK: 6.62607015e-34,         // J·s
	SPEED_OF_LIGHT: 299792458,      // m/s
	BOLTZMANN: 1.380649e-23,        // J/K
	STEFAN_BOLTZMANN: 5.670374419e-8, // W/(m²·K⁴)
} as const;

/**
 * Planck's law for blackbody radiation - spectral exitance
 * Returns spectral exitance in W/(m²·μm)
 */
export const planckSpectralExitance = (wavelength_um: number, temperature_K: number): number => {
	const { PLANCK: h, SPEED_OF_LIGHT: c, BOLTZMANN: k } = PHYSICS_CONSTANTS;

	const wavelength_m = wavelength_um * 1e-6;

	const numerator = 2 * h * c * c;
	const denominator = Math.pow(wavelength_m, 5) * (Math.exp((h * c) / (wavelength_m * k * temperature_K)) - 1);
	const spectralRadiance = numerator / denominator;

	return (spectralRadiance * Math.PI) * 1e-6; // W/(m²·μm)
};

/**
 * Physical constants and functions for atmospheric calculations
 */

import type { GasConfig } from './gases';
import type { AtmosphereConfig } from './atmosphere';
import type { HitranCrossSectionSpectrum } from './hitranCrossSections';

export const PHYSICS_CONSTANTS = {
	// Fundamental constants
	AVOGADRO: 6.02214076e23,        // molecules/mol
	PLANCK: 6.62607015e-34,         // J·s
	SPEED_OF_LIGHT: 299792458,      // m/s
	BOLTZMANN: 1.380649e-23,        // J/K
	STEFAN_BOLTZMANN: 5.670374419e-8, // W/(m²·K⁴)
} as const;

// =============================================================================
// BLACKBODY RADIATION
// =============================================================================

/**
 * Planck's law for blackbody radiation for spectral exitance
 *
 * Calculates the spectral exitance (power per unit area per unit wavelength)
 * emitted by a blackbody at a given temperature.
 *
 * @param wavelength_um - Wavelength in micrometres
 * @param temperature_K - Temperature in Kelvin
 * @returns Spectral exitance in W/(m²·μm)
 */
export const planckSpectralExitance = (wavelength_um: number, temperature_K: number): number => {
	const { PLANCK: h, SPEED_OF_LIGHT: c, BOLTZMANN: k } = PHYSICS_CONSTANTS;

	const wavelength_m = wavelength_um * 1e-6;

	const numerator = 2 * h * c * c;
	const denominator = Math.pow(wavelength_m, 5) * (Math.exp((h * c) / (wavelength_m * k * temperature_K)) - 1);
	const spectralRadiance = numerator / denominator;

	return (spectralRadiance * Math.PI) * 1e-6; // W/(m²·μm)
};

// =============================================================================
// ATMOSPHERIC COLUMN DENSITY
// =============================================================================

/**
 * Calculates the total atmospheric column density from surface pressure and gravity.
 *
 * Uses hydrostatic equilibrium: the total mass of atmosphere per unit area
 * is P/g. Converting to molecules gives N = (P/g) / m_mean.
 *
 * @param atmosphere - Atmosphere configuration
 * @returns Column density in molecules/cm²
 */
export const calculateTotalColumnDensity = (atmosphere: AtmosphereConfig): number => {
	// N_total = (P / g) × (1 / m_mean)
	// Units: (Pa / (m/s²)) × (1 / kg) = molecules/m²
	const totalColumn_m2 =
		atmosphere.surfacePressure_Pa /
		atmosphere.surfaceGravity_m_s2 /
		atmosphere.meanMolecularMass_kg;

	// Convert to molecules/cm²
	return totalColumn_m2 / 1e4; // 1 m² = 10⁴ cm²
};

/**
 * Calculates the column density for a specific gas.
 *
 * @param atmosphere - Atmosphere configuration
 * @param concentration - Molar fraction of the gas (e.g., 412e-6 for 412 ppm)
 * @returns Column density in molecules/cm²
 */
export const calculateGasColumnDensity = (
	atmosphere: AtmosphereConfig,
	concentration: number
): number => {
	return calculateTotalColumnDensity(atmosphere) * concentration;
};

// =============================================================================
// CORRELATED-K RADIATIVE TRANSFER
// =============================================================================

/**
 * Result of atmospheric transmission calculation
 */
export interface TransmissionSpectrum {
	wavelengths: number[];    // Wavelength bin centers in μm
	transmission: number[];   // Transmission coefficient [0,1] per bin
}

/**
 * Calculates atmospheric transmission through a single gas using correlated-k method.
 *
 * For each wavelength bin:
 *   1. Get k-distribution (absorption coefficients + weights)
 *   2. Calculate optical depth τ_i = k_i × N for each k-value
 *   3. Calculate transmission T_i = exp(-τ_i) for each k-value
 *   4. Weight-average: T_bin = Σ w_i × T_i
 *
 * This correctly handles sub-bin spectral variation, avoiding Jensen's inequality
 * error: exp(-⟨σ⟩N) ≠ ⟨exp(-σN)⟩
 *
 * @param spectrum - k-distribution spectrum for the gas
 * @param columnDensity_cm2 - Column density in molecules/cm²
 * @returns Transmission coefficient [0,1] for each wavelength bin
 */
export const calculateGasTransmission = (
	spectrum: HitranCrossSectionSpectrum,
	columnDensity_cm2: number
): number[] => {
	const numBins = spectrum.wavelengths.length;
	const transmission = new Array(numBins);

	for (let i = 0; i < numBins; i++) {
		const kDist = spectrum.kDistributions[i];

		// Calculate weighted transmission: T_bin = Σ w_i × exp(-k_i × N)
		let transmissionBin = 0;
		for (let j = 0; j < kDist.kValues.length; j++) {
			const k = kDist.kValues[j];
			const weight = kDist.weights[j];
			const tau = k * columnDensity_cm2;
			transmissionBin += weight * Math.exp(-tau);
		}

		transmission[i] = transmissionBin;
	}

	return transmission;
};

/**
 * Calculates atmospheric transmission through a gas mixture.
 *
 * Combines transmission from multiple gases multiplicatively, using the
 * correlated-k method for each gas to handle spectral variation within bins.
 *
 * For each wavelength bin:
 *   T_total = ∏ T_gas
 *
 * where each T_gas is calculated using correlated-k averaging.
 *
 * @param spectra - k-distribution spectra for all gases (keyed by gas name)
 * @param gases - Gas configurations (names and concentrations)
 * @param atmosphere - Atmosphere configuration (pressure, gravity, composition)
 * @returns Wavelengths and transmission spectrum
 */
export const calculateMixtureTransmission = (
	spectra: Record<string, HitranCrossSectionSpectrum>,
	gases: GasConfig[],
	atmosphere: AtmosphereConfig
): TransmissionSpectrum => {
	// Use first available gas's wavelength grid as reference
	const refGas = Object.keys(spectra)[0];
	if (!refGas) {
		throw new Error('No spectral data provided');
	}

	const refWavelengths = spectra[refGas].wavelengths;
	const numBins = refWavelengths.length;

	// Initialise total transmission (start at 1 = fully transparent)
	const totalTransmission = new Array(numBins).fill(1.0);

	// Calculate total atmospheric column
	const totalColumn_cm2 = calculateTotalColumnDensity(atmosphere);

	// Process each gas
	for (const { gas, concentration } of gases) {
		const spectrum = spectra[gas];
		if (!spectrum) {
			// Gas not in spectral database - treat as transparent
			continue;
		}

		// Calculate column density for this gas
		const gasColumn_cm2 = totalColumn_cm2 * concentration;

		// Calculate transmission using correlated-k method
		const gasTransmission = calculateGasTransmission(spectrum, gasColumn_cm2);

		// Multiply into total (transmissions combine multiplicatively)
		for (let i = 0; i < numBins; i++) {
			totalTransmission[i] *= gasTransmission[i];
		}
	}

	return {
		wavelengths: refWavelengths,
		transmission: totalTransmission
	};
};

/**
 * Calculates blackbody-weighted transmission coefficient.
 *
 * Integrates the transmission spectrum weighted by blackbody emission
 * to get a single effective transmission coefficient.
 *
 * T_eff = (∫ T(λ) B(λ,T) dλ) / (∫ B(λ,T) dλ)
 *
 * where B(λ,T) is the Planck function.
 *
 * @param wavelengths - Wavelength bin centers in μm
 * @param transmission - Transmission coefficients [0,1]
 * @param temperature_K - Blackbody temperature in Kelvin
 * @returns Effective transmission coefficient [0,1]
 */
export const calculateBlackbodyWeightedTransmission = (
	wavelengths: number[],
	transmission: number[],
	temperature_K: number
): number => {
	let totalFlux = 0;
	let transmittedFlux = 0;

	// Trapezoidal integration over wavelength bins
	for (let i = 0; i < wavelengths.length - 1; i++) {
		const λ1 = wavelengths[i];
		const λ2 = wavelengths[i + 1];
		const dλ = λ2 - λ1;

		// Use bin center for exitance calculation
		const exitance = planckSpectralExitance(λ1, temperature_K);
		const flux = exitance * dλ;

		totalFlux += flux;
		transmittedFlux += flux * transmission[i];
	}

	return transmittedFlux / totalFlux;
};

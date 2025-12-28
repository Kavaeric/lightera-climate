/**
 * Atmosphere configuration and presets
 */

import type { GasConfig } from './gases';
import { calculateMeanMolecularMass } from './gases';

export interface AtmosphereConfig {
	surfacePressure_Pa: number;      // Surface pressure in Pascals
	surfaceGravity_m_s2: number;     // Surface gravity in m/s²
	meanMolecularMass_kg: number;    // Mean molecular mass in kg/molecule
	composition: GasConfig[];        // Gas composition
}

/**
 * Earth-like atmospheric composition
 * Gases without HITRAN cross-section data (e.g., Ar) are automatically treated as fully transparent
 */
export const EARTH_ATMOSPHERE_COMPOSITION: GasConfig[] = [
	// Major components
	{ gas: 'n2', concentration: 0.7808 },       // 78.08%
	{ gas: 'o2', concentration: 0.2095 },       // 20.95%
	{ gas: 'ar', concentration: 0.0093 },       // 0.93%
	// Greenhouse gases
	{ gas: 'co2', concentration: 412e-6 },      // 412 ppm
	{ gas: 'h2o', concentration: 0.015 },       // ~1.5% (varies 0-3%)
	{ gas: 'ch4', concentration: 1.9e-6 },      // 1.9 ppm
	{ gas: 'n2o', concentration: 0.33e-6 },     // 0.33 ppm
	{ gas: 'o3', concentration: 0.3e-6 },       // 0.3 ppm average
];

/**
 * Create an atmosphere configuration from composition
 */
export const createAtmosphere = (
	composition: GasConfig[],
	surfacePressure_Pa: number,
	surfaceGravity_m_s2: number
): AtmosphereConfig => ({
	surfacePressure_Pa,
	surfaceGravity_m_s2,
	meanMolecularMass_kg: calculateMeanMolecularMass(composition),
	composition,
});

/**
 * Create an Earth-like atmosphere configuration
 */
export const createEarthAtmosphere = (
	composition: GasConfig[] = EARTH_ATMOSPHERE_COMPOSITION
): AtmosphereConfig => createAtmosphere(composition, 101325, 9.81);

/**
 * Default Earth atmosphere
 */
export const EARTH_ATMOSPHERE = createEarthAtmosphere();

// =============================================================================
// MARS
// =============================================================================

/**
 * Mars atmospheric composition
 * Thin CO2-dominated atmosphere
 */
export const MARS_ATMOSPHERE_COMPOSITION: GasConfig[] = [
	{ gas: 'co2', concentration: 0.951 },      // 95.1%
	{ gas: 'n2', concentration: 0.0275 },        // 2.85%
	{ gas: 'ar', concentration: 0.020 },        // 2.0%
	{ gas: 'o2', concentration: 0.0013 },       // 0.13%
	{ gas: 'co', concentration: 0.0002 },       // 0.02%
	{ gas: 'h2o', concentration: 0.0002 },      // 0.02% (variable, can be higher)
];

/**
 * Create a Mars atmosphere configuration
 */
export const createMarsAtmosphere = (
	composition: GasConfig[] = MARS_ATMOSPHERE_COMPOSITION
): AtmosphereConfig => createAtmosphere(
	composition,
	610,      // ~610 Pa (0.6% of Earth's)
	3.72076   // Mars surface gravity m/s²
);

/**
 * Default Mars atmosphere
 */
export const MARS_ATMOSPHERE = createMarsAtmosphere();

// =============================================================================
// VENUS
// =============================================================================

/**
 * Venus atmospheric composition
 * Extremely dense CO2 atmosphere with sulfuric acid clouds
 */
export const VENUS_ATMOSPHERE_COMPOSITION: GasConfig[] = [
	{ gas: 'co2', concentration: 0.965 },       // 96.5%
	{ gas: 'n2', concentration: 0.035 },        // 3.5%
	{ gas: 'so2', concentration: 150e-6 },      // ~150 ppm
	{ gas: 'ar', concentration: 70e-6 },        // ~70 ppm
	{ gas: 'h2o', concentration: 20e-6 },       // ~20 ppm (very dry)
	{ gas: 'co', concentration: 17e-6 },        // ~17 ppm
	{ gas: 'hcl', concentration: 5e-7 },        // ~0.5 ppm
	{ gas: 'hfl', concentration: 5e-9 },        // ~5 ppb
];

/**
 * Create a Venus atmosphere configuration
 */
export const createVenusAtmosphere = (
	composition: GasConfig[] = VENUS_ATMOSPHERE_COMPOSITION
): AtmosphereConfig => createAtmosphere(
	composition,
	9200000,    // ~92 bar (9.2 MPa) - 90x Earth's pressure
	8.87      // Venus surface gravity m/s²
);

/**
 * Default Venus atmosphere
 */
export const VENUS_ATMOSPHERE = createVenusAtmosphere();

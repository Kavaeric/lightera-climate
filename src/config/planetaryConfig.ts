/**
 * Planetary configuration
 * These parameters define the basic physical characteristics of the planet
 */

/**
 * Universal physical constants
 * These are fundamental constants that do not change between simulations
 */
export const PHYSICS_CONSTANTS = {
  // Cosmic microwave background temperature
  COSMIC_BACKGROUND_TEMP: 2.7, // K
} as const;

export interface PlanetaryConfig {
  // Planet radius
  radius: number; // metres

  // Planet mass
  mass: number; // kg

  // Surface gravity (can be derived from mass and radius, but stored for convenience)
  surfaceGravity: number; // m/s²

  // Atmospheric properties (optional, for atmospheric radiative transfer)
  surfacePressure?: number; // Pa (Pascals)

  // Gas concentrations (molar fractions, dimensionless)
  // Note: Water vapour (H2O) is variable per-cell and read from humidity texture
  co2Concentration?: number; // e.g., 412e-6 for 412 ppm
  ch4Concentration?: number; // e.g., 1.9e-6 for 1.9 ppm
  n2oConcentration?: number; // e.g., 0.33e-6 for 330 ppb
  o3Concentration?: number; // e.g., 0.04e-6 for 40 ppb (stratospheric average)
  o2Concentration?: number; // e.g., 0.2095 for 20.95%
  n2Concentration?: number; // e.g., 0.7809 for 78.09%
  arConcentration?: number; // e.g., 0.0093 for 0.93%
  coConcentration?: number; // e.g., 100e-9 for 100 ppb (carbon monoxide)
  so2Concentration?: number; // e.g., 150e-6 for 150 ppm (sulfur dioxide, Venus)
  hclConcentration?: number; // e.g., 0.5e-6 for 0.5 ppm (hydrogen chloride)
  hfConcentration?: number; // e.g., 5e-9 for 5 ppb (hydrogen fluoride)
}

/**
 * Earth planetary configuration
 */
export const PLANETARY_CONFIG_EARTH: PlanetaryConfig = {
  radius: 6371000, // 6,371 km
  mass: 5.972e24, // kg
  surfaceGravity: 9.81, // m/s²
  surfacePressure: 101325, // Pa (1 atm)

  co2Concentration: 420e-6, // 420 ppm
  ch4Concentration: 1.9e-6, // 1.9 ppm
  n2oConcentration: 0.335e-6, // 335 ppb
  o3Concentration: 0.04e-6, // ~40 ppb (column average)
  o2Concentration: 0.2095, // 20.95%
  n2Concentration: 0.7809, // 78.09%
  arConcentration: 0.0093, // 0.93%
  coConcentration: 100e-9, // ~100 ppb (tropospheric average)
  // SO2, HCl, HF negligible on Earth
};

/**
 * Mars planetary configuration
 */
export const PLANETARY_CONFIG_MARS: PlanetaryConfig = {
  radius: 3389500, // 3,389.5 km
  mass: 6.4171e23, // kg
  surfaceGravity: 3.71, // m/s²
  surfacePressure: 636, // Pa (~0.6% of Earth, varies 400-870 Pa)

  co2Concentration: 0.951, // 95.1%
  n2Concentration: 0.0275, // 2.75%
  arConcentration: 0.02, // 2.0%
  o2Concentration: 0.0013, // 0.13%
  coConcentration: 0.0007, // 700 ppm
  // H2O varies, typically 0.02%
};

/**
 * Venus planetary configuration
 */
export const PLANETARY_CONFIG_VENUS: PlanetaryConfig = {
  radius: 6051800, // 6,051.8 km
  mass: 4.8675e24, // kg
  surfaceGravity: 8.87, // m/s²
  surfacePressure: 9.2e6, // Pa (~92 atm)

  co2Concentration: 0.965, // 96.5%
  n2Concentration: 0.035, // 3.5%
  so2Concentration: 150e-6, // 150 ppm
  arConcentration: 70e-6, // 70 ppm
  coConcentration: 17e-6, // 17 ppm
  hclConcentration: 0.5e-6, // 0.5 ppm
  hfConcentration: 5e-9, // 5 ppb
  // H2O ~20 ppm (highly variable)
};

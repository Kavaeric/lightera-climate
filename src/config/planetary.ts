/**
 * Planetary configuration
 * These parameters define the basic physical characteristics of the planet
 */

export interface PlanetaryConfig {
  // Planet radius
  radius: number // metres

  // Planet mass
  mass: number // kg

  // Surface gravity (can be derived from mass and radius, but stored for convenience)
  surfaceGravity: number // m/s²

  // Atmospheric properties (optional, for atmospheric radiative transfer)
  surfacePressure?: number // Pa (Pascals)

  // Gas concentrations (molar fractions, dimensionless)
  // Note: Water vapour (H2O) is variable per-cell and read from humidity texture
  co2Concentration?: number // e.g., 412e-6 for 412 ppm
  ch4Concentration?: number // e.g., 1.9e-6 for 1.9 ppm
  n2oConcentration?: number // e.g., 0.33e-6 for 330 ppb
  o3Concentration?: number  // e.g., 0.04e-6 for 40 ppb (stratospheric average)
  o2Concentration?: number  // e.g., 0.2095 for 20.95%
  n2Concentration?: number  // e.g., 0.7809 for 78.09%
  arConcentration?: number  // e.g., 0.0093 for 0.93%
  coConcentration?: number  // e.g., 100e-9 for 100 ppb (carbon monoxide)
  so2Concentration?: number // e.g., 150e-6 for 150 ppm (sulfur dioxide, Venus)
  hclConcentration?: number // e.g., 0.5e-6 for 0.5 ppm (hydrogen chloride)
  hfConcentration?: number  // e.g., 5e-9 for 5 ppb (hydrogen fluoride)
}

/**
 * Calculates surface gravity from mass and radius using Newton's law of gravitation.
 * g = GM / r²
 */
export function calculateSurfaceGravity(mass: number, radius: number): number {
  const G = 6.67430e-11 // Gravitational constant (m³/(kg·s²))
  return (G * mass) / (radius * radius)
}

/**
 * Gas properties for atmospheric calculations
 * Molar masses in kg/mol, specific heats at constant pressure in J/(kg·K)
 */
const GAS_PROPERTIES = {
  N2:  { molarMass: 28.0134e-3,  cp: 1040 },  // Nitrogen
  O2:  { molarMass: 31.9988e-3,  cp: 918 },   // Oxygen
  CO2: { molarMass: 44.0095e-3,  cp: 844 },   // Carbon dioxide
  CH4: { molarMass: 16.0425e-3,  cp: 2226 },  // Methane
  N2O: { molarMass: 44.0128e-3,  cp: 880 },   // Nitrous oxide
  O3:  { molarMass: 47.9982e-3,  cp: 819 },   // Ozone
  Ar:  { molarMass: 39.948e-3,   cp: 520 },   // Argon
  CO:  { molarMass: 28.0101e-3,  cp: 1040 },  // Carbon monoxide
  SO2: { molarMass: 64.066e-3,   cp: 640 },   // Sulfur dioxide
  HCl: { molarMass: 36.461e-3,   cp: 799 },   // Hydrogen chloride
  HF:  { molarMass: 20.0063e-3,  cp: 1455 },  // Hydrogen fluoride
} as const

const AVOGADRO = 6.02214076e23 // molecules/mol

/**
 * Calculates mean molecular mass from atmospheric composition.
 * Returns mass in kg/molecule
 */
export function calculateMeanMolecularMass(config: PlanetaryConfig): number {
  // Weighted average molar mass (kg/mol)
  const meanMolarMass =
    (config.n2Concentration ?? 0) * GAS_PROPERTIES.N2.molarMass +
    (config.o2Concentration ?? 0) * GAS_PROPERTIES.O2.molarMass +
    (config.co2Concentration ?? 0) * GAS_PROPERTIES.CO2.molarMass +
    (config.ch4Concentration ?? 0) * GAS_PROPERTIES.CH4.molarMass +
    (config.n2oConcentration ?? 0) * GAS_PROPERTIES.N2O.molarMass +
    (config.o3Concentration ?? 0) * GAS_PROPERTIES.O3.molarMass +
    (config.arConcentration ?? 0) * GAS_PROPERTIES.Ar.molarMass +
    (config.coConcentration ?? 0) * GAS_PROPERTIES.CO.molarMass +
    (config.so2Concentration ?? 0) * GAS_PROPERTIES.SO2.molarMass +
    (config.hclConcentration ?? 0) * GAS_PROPERTIES.HCl.molarMass +
    (config.hfConcentration ?? 0) * GAS_PROPERTIES.HF.molarMass

  if (meanMolarMass === 0) {
    throw new Error('[calculateMeanMolecularMass] No gas concentrations specified in planetary config')
  }

  // Convert to kg/molecule
  return meanMolarMass / AVOGADRO
}

/**
 * Calculates atmospheric specific heat at constant pressure from composition.
 * Returns c_p in J/(kg·K)
 *
 * Uses mass-weighted average of component specific heats
 */
export function calculateAtmosphereSpecificHeat(config: PlanetaryConfig): number {
  // Calculate mass contributions from molar fractions
  // mass_i = mole_fraction_i × molar_mass_i
  const masses = {
    n2: (config.n2Concentration ?? 0) * GAS_PROPERTIES.N2.molarMass,
    o2: (config.o2Concentration ?? 0) * GAS_PROPERTIES.O2.molarMass,
    co2: (config.co2Concentration ?? 0) * GAS_PROPERTIES.CO2.molarMass,
    ch4: (config.ch4Concentration ?? 0) * GAS_PROPERTIES.CH4.molarMass,
    n2o: (config.n2oConcentration ?? 0) * GAS_PROPERTIES.N2O.molarMass,
    o3: (config.o3Concentration ?? 0) * GAS_PROPERTIES.O3.molarMass,
    ar: (config.arConcentration ?? 0) * GAS_PROPERTIES.Ar.molarMass,
    co: (config.coConcentration ?? 0) * GAS_PROPERTIES.CO.molarMass,
    so2: (config.so2Concentration ?? 0) * GAS_PROPERTIES.SO2.molarMass,
    hcl: (config.hclConcentration ?? 0) * GAS_PROPERTIES.HCl.molarMass,
    hf: (config.hfConcentration ?? 0) * GAS_PROPERTIES.HF.molarMass,
  }

  const totalMass = masses.n2 + masses.o2 + masses.co2 + masses.ch4 + masses.n2o + masses.o3 + masses.ar +
    masses.co + masses.so2 + masses.hcl + masses.hf

  if (totalMass === 0) {
    throw new Error('[calculateAtmosphereSpecificHeat] No gas concentrations specified in planetary config')
  }

  // Mass-weighted specific heat
  const cp =
    (masses.n2 / totalMass) * GAS_PROPERTIES.N2.cp +
    (masses.o2 / totalMass) * GAS_PROPERTIES.O2.cp +
    (masses.co2 / totalMass) * GAS_PROPERTIES.CO2.cp +
    (masses.ch4 / totalMass) * GAS_PROPERTIES.CH4.cp +
    (masses.n2o / totalMass) * GAS_PROPERTIES.N2O.cp +
    (masses.o3 / totalMass) * GAS_PROPERTIES.O3.cp +
    (masses.ar / totalMass) * GAS_PROPERTIES.Ar.cp +
    (masses.co / totalMass) * GAS_PROPERTIES.CO.cp +
    (masses.so2 / totalMass) * GAS_PROPERTIES.SO2.cp +
    (masses.hcl / totalMass) * GAS_PROPERTIES.HCl.cp +
    (masses.hf / totalMass) * GAS_PROPERTIES.HF.cp

  return cp
}

/**
 * Calculates atmospheric heat capacity per unit area from planetary config.
 * C = (P / g) × c_p
 *
 * Where:
 *   P = surface pressure (Pa)
 *   g = surface gravity (m/s²)
 *   c_p = specific heat at constant pressure (J/(kg·K))
 *
 * Returns heat capacity in J/(m²·K)
 */
export function calculateAtmosphereHeatCapacity(config: PlanetaryConfig): number {
  if (config.surfacePressure === undefined) {
    throw new Error('[calculateAtmosphereHeatCapacity] surfacePressure not specified in planetary config')
  }

  const cp = calculateAtmosphereSpecificHeat(config)

  // Mass per unit area = P / g (kg/m²)
  const massPerArea = config.surfacePressure / config.surfaceGravity

  // Heat capacity per unit area = mass × specific heat
  return massPerArea * cp
}

/**
 * Earth planetary configuration
 */
export const PLANETARY_CONFIG_EARTH: PlanetaryConfig = {
  radius: 6371000, // 6,371 km
  mass: 5.972e24, // kg
  surfaceGravity: 9.81, // m/s²
  surfacePressure: 101325, // Pa (1 atm)

  co2Concentration: 420e-6,   // 420 ppm
  ch4Concentration: 1.9e-6,   // 1.9 ppm
  n2oConcentration: 0.335e-6, // 335 ppb
  o3Concentration: 0.04e-6,   // ~40 ppb (column average)
  o2Concentration: 0.2095,    // 20.95%
  n2Concentration: 0.7809,    // 78.09%
  arConcentration: 0.0093,    // 0.93%
  coConcentration: 100e-9,    // ~100 ppb (tropospheric average)
  // SO2, HCl, HF negligible on Earth
}

/**
 * Mars planetary configuration
 */
export const PLANETARY_CONFIG_MARS: PlanetaryConfig = {
  radius: 3389500, // 3,389.5 km
  mass: 6.4171e23, // kg
  surfaceGravity: 3.71, // m/s²
  surfacePressure: 636, // Pa (~0.6% of Earth, varies 400-870 Pa)

  co2Concentration: 0.951,     // 95.1%
  n2Concentration: 0.0275,     // 2.75%
  arConcentration: 0.02,       // 2.0%
  o2Concentration: 0.0013,     // 0.13%
  coConcentration: 0.0007,     // 700 ppm
  // H2O varies, typically 0.02%
}

/**
 * Venus planetary configuration
 */
export const PLANETARY_CONFIG_VENUS: PlanetaryConfig = {
  radius: 6051800, // 6,051.8 km
  mass: 4.8675e24, // kg
  surfaceGravity: 8.87, // m/s²
  surfacePressure: 9.2e6, // Pa (~92 atm)

  co2Concentration: 0.965,     // 96.5%
  n2Concentration: 0.035,      // 3.5%
  so2Concentration: 150e-6,    // 150 ppm
  arConcentration: 70e-6,      // 70 ppm
  coConcentration: 17e-6,      // 17 ppm
  hclConcentration: 0.5e-6,    // 0.5 ppm
  hfConcentration: 5e-9,       // 5 ppb
  // H2O ~20 ppm (highly variable)
}

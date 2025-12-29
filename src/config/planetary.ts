/**
 * Planetary configuration - user-configurable planetary properties
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
  // Note: Water vapor (H2O) is variable per-cell and read from humidity texture
  co2Concentration?: number // e.g., 412e-6 for 412 ppm
  ch4Concentration?: number // e.g., 1.9e-6 for 1.9 ppm
  n2oConcentration?: number // e.g., 0.33e-6 for 330 ppb
  o3Concentration?: number  // e.g., 0.04e-6 for 40 ppb (stratospheric average)
  o2Concentration?: number  // e.g., 0.2095 for 20.95%
  n2Concentration?: number  // e.g., 0.7809 for 78.09%
}

/**
 * Calculate surface gravity from mass and radius
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
  Ar:  { molarMass: 39.948e-3,   cp: 520 },   // Argon (for completeness)
} as const

const AVOGADRO = 6.02214076e23 // molecules/mol

/**
 * Calculate mean molecular mass from atmospheric composition
 * Returns mass in kg/molecule
 */
export function calculateMeanMolecularMass(config: PlanetaryConfig): number {
  const n2 = config.n2Concentration ?? 0.7809
  const o2 = config.o2Concentration ?? 0.2095
  const co2 = config.co2Concentration ?? 420e-6
  const ch4 = config.ch4Concentration ?? 1.9e-6
  const n2o = config.n2oConcentration ?? 0.335e-6
  const o3 = config.o3Concentration ?? 0.04e-6

  // Argon makes up most of the remainder (~0.93%)
  const ar = Math.max(0, 1 - n2 - o2 - co2 - ch4 - n2o - o3)

  // Weighted average molar mass (kg/mol)
  const meanMolarMass =
    n2 * GAS_PROPERTIES.N2.molarMass +
    o2 * GAS_PROPERTIES.O2.molarMass +
    co2 * GAS_PROPERTIES.CO2.molarMass +
    ch4 * GAS_PROPERTIES.CH4.molarMass +
    n2o * GAS_PROPERTIES.N2O.molarMass +
    o3 * GAS_PROPERTIES.O3.molarMass +
    ar * GAS_PROPERTIES.Ar.molarMass

  // Convert to kg/molecule
  return meanMolarMass / AVOGADRO
}

/**
 * Calculate atmospheric specific heat at constant pressure from composition
 * Returns c_p in J/(kg·K)
 *
 * Uses mass-weighted average of component specific heats
 */
export function calculateAtmosphereSpecificHeat(config: PlanetaryConfig): number {
  const n2 = config.n2Concentration ?? 0.7809
  const o2 = config.o2Concentration ?? 0.2095
  const co2 = config.co2Concentration ?? 420e-6
  const ch4 = config.ch4Concentration ?? 1.9e-6
  const n2o = config.n2oConcentration ?? 0.335e-6
  const o3 = config.o3Concentration ?? 0.04e-6
  const ar = Math.max(0, 1 - n2 - o2 - co2 - ch4 - n2o - o3)

  // First calculate mass fractions from molar fractions
  // mass_i = mole_fraction_i × molar_mass_i
  const masses = {
    n2: n2 * GAS_PROPERTIES.N2.molarMass,
    o2: o2 * GAS_PROPERTIES.O2.molarMass,
    co2: co2 * GAS_PROPERTIES.CO2.molarMass,
    ch4: ch4 * GAS_PROPERTIES.CH4.molarMass,
    n2o: n2o * GAS_PROPERTIES.N2O.molarMass,
    o3: o3 * GAS_PROPERTIES.O3.molarMass,
    ar: ar * GAS_PROPERTIES.Ar.molarMass,
  }

  const totalMass = masses.n2 + masses.o2 + masses.co2 + masses.ch4 + masses.n2o + masses.o3 + masses.ar

  // Mass-weighted specific heat
  const cp =
    (masses.n2 / totalMass) * GAS_PROPERTIES.N2.cp +
    (masses.o2 / totalMass) * GAS_PROPERTIES.O2.cp +
    (masses.co2 / totalMass) * GAS_PROPERTIES.CO2.cp +
    (masses.ch4 / totalMass) * GAS_PROPERTIES.CH4.cp +
    (masses.n2o / totalMass) * GAS_PROPERTIES.N2O.cp +
    (masses.o3 / totalMass) * GAS_PROPERTIES.O3.cp +
    (masses.ar / totalMass) * GAS_PROPERTIES.Ar.cp

  return cp
}

/**
 * Calculate atmospheric heat capacity per unit area from planetary config
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
  const pressure = config.surfacePressure ?? 101325
  const gravity = config.surfaceGravity
  const cp = calculateAtmosphereSpecificHeat(config)

  // Mass per unit area = P / g (kg/m²)
  const massPerArea = pressure / gravity

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

  // Current Earth atmospheric composition (2023)
  co2Concentration: 420e-6,   // 420 ppm
  ch4Concentration: 1.9e-6,   // 1.9 ppm
  n2oConcentration: 0.335e-6, // 335 ppb
  o3Concentration: 0.04e-6,   // ~40 ppb (column average)
  o2Concentration: 0.2095,    // 20.95%
  n2Concentration: 0.7809,    // 78.09%
}

/**
 * Mars planetary configuration
 */
export const PLANETARY_CONFIG_MARS: PlanetaryConfig = {
  radius: 3389500, // 3,389.5 km
  mass: 6.4171e23, // kg
  surfaceGravity: 3.71, // m/s²
}

/**
 * Mercury planetary configuration
 */
export const PLANETARY_CONFIG_MERCURY: PlanetaryConfig = {
  radius: 2439700, // 2,439.7 km
  mass: 3.3011e23, // kg
  surfaceGravity: 3.7, // m/s²
}

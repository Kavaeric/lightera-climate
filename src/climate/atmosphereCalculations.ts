/**
 * Atmospheric physics calculations
 * Derived from planetary configuration for use in climate simulation.
 */

import type { PlanetaryConfig } from '../config/planetaryConfig';

/**
 * Gas properties for atmospheric calculations
 * Molar masses in kg/mol, specific heats at constant pressure in J/(kg·K).
 */
const GAS_PROPERTIES = {
  N2: { molarMass: 28.0134e-3, cp: 1040 }, // Nitrogen
  O2: { molarMass: 31.9988e-3, cp: 918 }, // Oxygen
  CO2: { molarMass: 44.0095e-3, cp: 844 }, // Carbon dioxide
  CH4: { molarMass: 16.0425e-3, cp: 2226 }, // Methane
  N2O: { molarMass: 44.0128e-3, cp: 880 }, // Nitrous oxide
  O3: { molarMass: 47.9982e-3, cp: 819 }, // Ozone
  Ar: { molarMass: 39.948e-3, cp: 520 }, // Argon
  CO: { molarMass: 28.0101e-3, cp: 1040 }, // Carbon monoxide
  SO2: { molarMass: 64.066e-3, cp: 640 }, // Sulfur dioxide
  HCl: { molarMass: 36.461e-3, cp: 799 }, // Hydrogen chloride
  HF: { molarMass: 20.0063e-3, cp: 1455 }, // Hydrogen fluoride
} as const;

const AVOGADRO = 6.02214076e23; // molecules/mol

/**
 * Calculates surface gravity from mass and radius using Newton's law of gravitation.
 * g = GM / r²
 */
export function calculateSurfaceGravity(mass: number, radius: number): number {
  const G = 6.6743e-11; // Gravitational constant (m³/(kg·s²))
  return (G * mass) / (radius * radius);
}

/**
 * Calculates mean molecular mass from atmospheric composition.
 * Returns mass in kg/molecule.
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
    (config.hfConcentration ?? 0) * GAS_PROPERTIES.HF.molarMass;

  if (meanMolarMass === 0) {
    throw new Error(
      '[calculateMeanMolecularMass] No gas concentrations specified in planetary config'
    );
  }

  // Convert to kg/molecule
  return meanMolarMass / AVOGADRO;
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
  };

  const totalMass =
    masses.n2 +
    masses.o2 +
    masses.co2 +
    masses.ch4 +
    masses.n2o +
    masses.o3 +
    masses.ar +
    masses.co +
    masses.so2 +
    masses.hcl +
    masses.hf;

  if (totalMass === 0) {
    throw new Error(
      '[calculateAtmosphereSpecificHeat] No gas concentrations specified in planetary config'
    );
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
    (masses.hf / totalMass) * GAS_PROPERTIES.HF.cp;

  return cp;
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
    throw new Error(
      '[calculateAtmosphereHeatCapacity] surfacePressure not specified in planetary config'
    );
  }

  const cp = calculateAtmosphereSpecificHeat(config);

  // Mass per unit area = P / g (kg/m²)
  const massPerArea = config.surfacePressure / config.surfaceGravity;

  // Heat capacity per unit area = mass × specific heat
  return massPerArea * cp;
}

/**
 * Calculates dry adiabatic lapse rate from planetary config.
 * Γ = g / cp
 *
 * Where:
 *   g = surface gravity (m/s²)
 *   cp = specific heat at constant pressure (J/(kg·K))
 *
 * Returns lapse rate in K/m
 *
 * Example values:
 *   Earth: 9.81 / 1004 ≈ 0.00978 K/m (9.8 K/km)
 *   Mars: 3.71 / 744 ≈ 0.00499 K/m (5.0 K/km)
 *   Venus: 8.87 / 844 ≈ 0.0105 K/m (10.5 K/km)
 */
export function calculateDryAdiabaticLapseRate(config: PlanetaryConfig): number {
  const cp = calculateAtmosphereSpecificHeat(config);
  return config.surfaceGravity / cp;
}

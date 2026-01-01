/**
 * Gas properties and molecular data
 */

import { PHYSICS_CONSTANTS } from './physics';

// Molar masses in g/mol
export const MOLAR_MASSES: Record<string, number> = {
  n2: 28.014,
  o2: 31.998,
  ar: 39.948,
  co2: 44.009,
  co: 28.01,
  h2o: 18.015,
  ch4: 16.043,
  n2o: 44.013,
  o3: 47.997,
  so2: 64.066,
  ne: 20.18,
  he: 4.003,
  kr: 83.798,
  h2: 2.016,
  hcl: 36.461,
  hfl: 189.374,
};

export interface GasConfig {
  gas: string;
  concentration: number; // molar fraction (e.g., 412e-6 for 412 ppm)
}

/**
 * Calculate mean molecular mass from gas mixture
 * Returns mass in kg/molecule
 */
export const calculateMeanMolecularMass = (gases: GasConfig[]): number => {
  let totalMass = 0;
  let totalConcentration = 0;

  for (const { gas, concentration } of gases) {
    const molarMass = MOLAR_MASSES[gas];
    if (molarMass === undefined) {
      console.warn(`Unknown molar mass for gas: ${gas}`);
      continue;
    }
    totalMass += concentration * molarMass;
    totalConcentration += concentration;
  }

  // If concentrations don't sum to 1, normalise
  const meanMolarMass_g_mol = totalMass / totalConcentration;

  // Convert g/mol to kg/molecule
  return meanMolarMass_g_mol / 1000 / PHYSICS_CONSTANTS.AVOGADRO;
};

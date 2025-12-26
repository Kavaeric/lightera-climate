/**
 * Physical properties of atmospheric gases
 * These are fundamental constants that do not change between simulations
 */

export interface GasProperties {
  /** Molar mass in kg/mol */
  molarMass: number

  /**
   * Infrared absorption coefficient (placeholder values for now)
   * Units: m²/kg (mass absorption coefficient)
   * Higher values mean more IR absorption (greenhouse effect)
   */
  absorptionCoefficient?: number

  // Future properties to add:
  // - Specific heat capacity
  // - Scattering cross-section
  // - Absorption bands (wavelength-dependent)
}

/**
 * Physical properties for common atmospheric gases
 * Source: NIST, atmospheric physics references
 */
export const GAS_PROPERTIES: Record<string, GasProperties> = {
  N2: {
    molarMass: 0.028014, // kg/mol
    // N2 is essentially transparent to IR (homonuclear diatomic)
  },
  O2: {
    molarMass: 0.031998, // kg/mol
    // O2 is mostly transparent to IR (homonuclear diatomic)
  },
  Ar: {
    molarMass: 0.039948, // kg/mol
    // Ar is transparent to IR (monoatomic)
  },
  CO2: {
    molarMass: 0.04401, // kg/mol
    absorptionCoefficient: 0.015, // Placeholder - strong greenhouse gas
  },
  H2O: {
    molarMass: 0.018015, // kg/mol
    absorptionCoefficient: 0.1, // Placeholder - strongest greenhouse gas
  },
  Ne: {
    molarMass: 0.020180, // kg/mol
  },
  He: {
    molarMass: 0.004003, // kg/mol
  },
  CH4: {
    molarMass: 0.016043, // kg/mol
    absorptionCoefficient: 0.03, // Placeholder - strong greenhouse gas
  },
  Kr: {
    molarMass: 0.083798, // kg/mol
  },
  Xe: {
    molarMass: 0.131293, // kg/mol
  },
  N2O: {
    molarMass: 0.044013, // kg/mol
    absorptionCoefficient: 0.02, // Placeholder - greenhouse gas
  },
} as const

/**
 * Universal gas constant
 * R = 8.314462618 J/(mol·K)
 */
export const GAS_CONSTANT_R = 8.314462618 // J/(mol·K)

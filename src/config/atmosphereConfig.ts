/**
 * Atmosphere configuration - global atmospheric properties
 * 
 * Composition stored as partial pressures (Pascals) for each gas.
 * Total pressure is simply the sum of all partial pressures.
 * This avoids normalization issues when composition changes over time.
 */

export interface AtmosphereConfig {
  // Scale height
  scaleHeight: number // metres

  // Atmospheric composition
  // Each gas stored as partial pressure in Pascals
  // Total pressure = sum of all partial pressures
  composition: {
    [gasName: string]: number // Partial pressure in Pascals
  }
}

/**
 * Calculate total atmospheric pressure from composition
 */
export function getTotalPressure(config: AtmosphereConfig): number {
  return Object.values(config.composition).reduce((sum, pressure) => sum + pressure, 0)
}

/**
 * Get mole fraction of a gas (0-1)
 * Useful for display or calculations requiring fractions
 */
export function getMoleFraction(config: AtmosphereConfig, gasName: string): number {
  const totalPressure = getTotalPressure(config)
  if (totalPressure === 0) return 0
  return config.composition[gasName] / totalPressure
}

/**
 * Default Earth-like atmosphere
 * Sea level pressure ~101,325 Pa
 */
export const DEFAULT_ATMOSPHERE_CONFIG: AtmosphereConfig = {
  scaleHeight: 8500, // metres
  composition: {
    N2: 78084, // 78.084% of 101325 Pa
    O2: 20946, // 20.946% of 101325 Pa
    Ar: 934,   // 0.934% of 101325 Pa
    CO2: 400,  // ~400 ppm = 0.04% of 101325 Pa
    H2O: 0,    // Variable, starts at 0
  },
}

/**
 * Default Mars-like atmosphere
 * Surface pressure ~610 Pa
 * Composition: ~95% CO2, 2.7% N2, 1.6% Ar, traces of O2 and CO
 */
export const DEFAULT_MARS_ATMOSPHERE_CONFIG: AtmosphereConfig = {
  scaleHeight: 11100, // metres (Mars scale height, higher than Earth's due to lower gravity)
  composition: {
    CO2: 580,  // ~95.3% of 610 Pa
    N2: 17,    // ~2.7% of 610 Pa
    Ar: 10,    // ~1.6% of 610 Pa
    O2: 0.13,  // ~0.21% of 610 Pa (trace)
    CO: 0.08,  // ~0.13% of 610 Pa (trace)
    H2O: 0,    // Highly variable, starts at 0
  },
}

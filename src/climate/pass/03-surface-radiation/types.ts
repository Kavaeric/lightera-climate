/**
 * Atmosphere configuration - global atmospheric properties
 */

export interface AtmosphereConfig {
  /**
   * Scale height of the atmosphere in metres
   * The height at which the pressure is 1/e of the surface pressure.
   */
  scaleHeight: number // metres

  /**
   * Atmospheric composition as partial pressures at sea level
   * Units: Pascals (Pa)
   *
   * Partial pressure = mole fraction × total pressure
   * Total pressure = sum of all partial pressures
   *
   * These values can be modified dynamically during simulation
   * (e.g., water vapor precipitating, CO2 dissolving in oceans)
   */
  partialPressures: {
    [gasName: string]: number // Pa
  }
}

/**
 * Default Earth-like atmosphere
 * Total sea level pressure: 101,325 Pa
 *
 * Composition by volume (which equals mole fraction for ideal gases):
 * - N2:  78.08%
 * - O2:  20.95%
 * - Ar:  0.934%
 * - CO2: 415 ppm (0.0415%)
 * - Other trace gases: < 20 ppm each
 *
 * Note: Water vapor is highly variable (0-4%) and typically computed
 * dynamically based on temperature and relative humidity
 */
export const ATMOSPHERE_CONFIG_EARTH: AtmosphereConfig = {
  scaleHeight: 8500, // metres
  partialPressures: {
    N2: 79117,    // Pa (78.08% of 101,325 Pa)
    O2: 21224,    // Pa (20.95%)
    Ar: 946,      // Pa (0.934%)
    CO2: 41.5,    // Pa (415 ppm)
    Ne: 1.82,     // Pa (18 ppm)
    He: 0.52,     // Pa (5.2 ppm)
    CH4: 0.19,    // Pa (1.9 ppm)
    Kr: 0.114,    // Pa (1.14 ppm)
    Xe: 0.009,    // Pa (0.09 ppm)
    N2O: 0.033,   // Pa (0.33 ppm)
    // H2O is variable and typically computed dynamically
  },
}

/**
 * Calculate total atmospheric pressure from partial pressures
 * @param partialPressures - Object mapping gas names to partial pressures in Pa
 * @returns Total pressure in Pa
 */
export function calculateTotalPressure(partialPressures: Record<string, number>): number {
  return Object.values(partialPressures).reduce((sum, p) => sum + p, 0)
}

/**
 * Calculate mole fraction for a gas
 * Mole fraction = partial pressure / total pressure
 *
 * @param gas - Name of the gas
 * @param partialPressures - Object mapping gas names to partial pressures in Pa
 * @returns Mole fraction (0-1)
 */
export function calculateMoleFraction(
  gas: string,
  partialPressures: Record<string, number>
): number {
  const total = calculateTotalPressure(partialPressures)
  const partial = partialPressures[gas] ?? 0
  return total > 0 ? partial / total : 0
}

/**
 * Calculate column density for a gas (useful for radiative transfer calculations)
 *
 * Column density is the total mass of gas per unit area in a vertical column.
 * For an isothermal atmosphere: ρ_column = (P × H) / (g × M)
 *
 * where:
 * - P = partial pressure at surface
 * - H = scale height
 * - g = surface gravity
 * - M = molar mass
 *
 * @param partialPressure - Partial pressure of the gas at surface in Pa
 * @param scaleHeight - Scale height of atmosphere in m
 * @param surfaceGravity - Surface gravity in m/s²
 * @param molarMass - Molar mass of gas in kg/mol
 * @returns Column density in kg/m²
 */
export function calculateColumnDensity(
  partialPressure: number,
  scaleHeight: number,
  surfaceGravity: number,
  molarMass: number
): number {
  // Column density = (P × H) / (g × M)
  return (partialPressure * scaleHeight) / (surfaceGravity * molarMass)
}

/**
 * Convert volume percentage to partial pressure
 * Useful when importing atmospheric data from references that use percentages
 *
 * @param volumePercent - Volume percentage (0-100)
 * @param totalPressure - Total atmospheric pressure in Pa
 * @returns Partial pressure in Pa
 */
export function volumePercentToPartialPressure(
  volumePercent: number,
  totalPressure: number
): number {
  return (volumePercent / 100) * totalPressure
}

/**
 * Convert parts per million (ppm) to partial pressure
 * Useful when importing trace gas concentrations
 *
 * @param ppm - Concentration in parts per million
 * @param totalPressure - Total atmospheric pressure in Pa
 * @returns Partial pressure in Pa
 */
export function ppmToPartialPressure(ppm: number, totalPressure: number): number {
  return (ppm / 1_000_000) * totalPressure
}

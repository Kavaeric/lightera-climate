/**
 * Spectroscopy types for radiative transfer calculations.
 * Consolidated from data/gasAbsorptionData.ts and data/hitranCrossSections.ts
 */

/**
 * Correlated-k distribution for a single spectral bin.
 * Used for accurate radiative transfer that correctly handles spectral variation within bins.
 */
export type KDistribution = {
  kValues: number[]   // Sorted absorption cross-sections (cm²/molecule)
  weights: number[]   // Spectral weights (sum to 1.0)
}

/**
 * Gas absorption spectrum using correlated-k method.
 * Data format:
 *   Spectral bins: 128 log-spaced from 1 to 70 μm
 *   k-values per bin: 4 (captures line + window structure)
 *   Reference temperature: 296 K
 *
 * To calculate transmission:
 *   For each wavelength bin:
 *     T_bin = Σ w_i × exp(-k_i × N)
 *   where N = column density (molecules/cm²).
 *
 * This correctly handles spectral variation within bins, avoiding
 * the Jensen inequality problem: exp(-avg(σ)N) ≠ avg(exp(-σN)).
 */
export type GasAbsorptionSpectrum = {
  wavelengths: number[]            // μm (bin centers)
  kDistributions: KDistribution[]  // One per wavelength bin
}

/**
 * Alias for GasAbsorptionSpectrum (legacy name from HITRAN data processing).
 * @deprecated Use GasAbsorptionSpectrum instead
 */
export type HitranCrossSectionSpectrum = GasAbsorptionSpectrum

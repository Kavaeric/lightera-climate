/**
 * Shared spectral binning configuration
 *
 * Generates wavelength bins used across all preprocessing scripts.
 * This ensures consistency between HITRAN data, Planck lookup, and runtime code.
 *
 * Usage: Import from other scripts via ES modules
 */

// === SPECTRAL BINNING CONFIGURATION ===
export const NUM_BINS = 128;              // Output spectral bins (performance-critical)
export const WAVELENGTH_MIN = 1.0;        // μm
export const WAVELENGTH_MAX = 70.0;       // μm

/**
 * Generate log-spaced bin edges
 * Returns array of length NUM_BINS+1 (bin edges)
 */
export function generateLogBins(min, max, numBins) {
	const logMin = Math.log10(min);
	const logMax = Math.log10(max);
	const step = (logMax - logMin) / numBins;

	const edges = [];
	for (let i = 0; i <= numBins; i++) {
		edges.push(Math.pow(10, logMin + i * step));
	}
	return edges;
}

/**
 * Get bin centers from edges (geometric mean for log-spaced bins)
 */
export function getBinCenters(edges) {
	const centers = [];
	for (let i = 0; i < edges.length - 1; i++) {
		centers.push(Math.sqrt(edges[i] * edges[i + 1]));
	}
	return centers;
}

/**
 * Get wavelength bin centers for the default configuration
 */
export function getWavelengthBins() {
	const edges = generateLogBins(WAVELENGTH_MIN, WAVELENGTH_MAX, NUM_BINS);
	return getBinCenters(edges);
}

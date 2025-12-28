/**
 * Convert HITRAN line-by-line CSV data into correlated-k distributions
 *
 * Input: HITRAN CSV files with columns: nu, sw, elower, gamma_air, n_air, etc.
 * Output: TypeScript file with k-distributions for radiative transfer
 *
 * Physics:
 * - Uses correlated-k method to handle spectral variation within bins
 * - Problem: exp(-avg(σ)N) ≠ avg(exp(-σN)) due to Jensen's inequality
 * - Solution: Store distribution of k-values (cross-sections) per bin
 * - At runtime: T = Σ w_i × exp(-k_i × N) captures line + window structure
 *
 * Method:
 * - Sample at high resolution within each output bin
 * - Sort cross-sections and extract percentiles as k-values
 * - Store k-values + weights for accurate transmission calculation
 *
 * Usage: node scripts/convertHitranToTS.js
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === CONFIGURATION ===
const NUM_BINS = 128;              // Output spectral bins (performance-critical)
const NUM_K_VALUES = 4;            // k-values per bin (higher = more accurate, slower)
const HIGH_RES_MULTIPLIER = 32;    // Internal oversampling factor
const WAVELENGTH_MIN = 1.0;        // μm
const WAVELENGTH_MAX = 70.0;       // μm

// Gases to process (must match directory names in public/hitran-line/)
const GASES = ['ch4', 'co', 'co2', 'h2o', 'n2', 'n2o', 'o2', 'o3', 'so2', 'hcl', 'hfl'];

// === PHYSICS CONSTANTS ===
const WAVENUMBER_TO_WAVELENGTH_CONVERSION = 10000.0; // cm⁻¹ to μm
const LINE_WING_CUTOFF_HALFWIDTHS = 25; // Line shape negligible beyond this

// === HELPER FUNCTIONS ===

/**
 * Generate log-spaced bin edges
 * Returns array of length NUM_BINS+1 (bin edges)
 */
function generateLogBins(min, max, numBins) {
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
function getBinCenters(edges) {
	const centers = [];
	for (let i = 0; i < edges.length - 1; i++) {
		centers.push(Math.sqrt(edges[i] * edges[i + 1]));
	}
	return centers;
}

/**
 * Convert wavenumber (cm⁻¹) to wavelength (μm)
 */
function wavenumberToWavelength(nu_cm) {
	return WAVENUMBER_TO_WAVELENGTH_CONVERSION / nu_cm;
}

/**
 * Process a single HITRAN CSV file using correlated-k method
 * Returns { wavelengths: number[], kDistributions: Array<{kValues: number[], weights: number[]}> }
 */
function processHitranFile(csvPath) {
	console.log(`Processing ${csvPath}...`);

	const csvData = fs.readFileSync(csvPath, 'utf8');
	const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });

	// Output bins (coarse for performance)
	const binEdges = generateLogBins(WAVELENGTH_MIN, WAVELENGTH_MAX, NUM_BINS);
	const wavelengths = getBinCenters(binEdges);

	// High-resolution spectral grid for accurate line shape convolution
	const numHighResBins = NUM_BINS * HIGH_RES_MULTIPLIER;
	const highResBinEdges = generateLogBins(WAVELENGTH_MIN, WAVELENGTH_MAX, numHighResBins);
	const highResBinCenters_wavelength = getBinCenters(highResBinEdges);

	// Convert bin centers to wavenumber space for cross-section calculation
	const highResBinCenters_wavenumber = highResBinCenters_wavelength.map(
		wavelength => WAVENUMBER_TO_WAVELENGTH_CONVERSION / wavelength
	);

	// Initialise cross-section array
	const highResCrossSections = new Array(numHighResBins).fill(0);
	let linesProcessed = 0;
	let linesInRange = 0;

	// Process each HITRAN line with proper line shape
	for (const row of parsed.data) {
		linesProcessed++;

		const lineCenter_wavenumber = parseFloat(row.nu);     // cm⁻¹
		const lineIntensity = parseFloat(row.sw);             // cm⁻¹/(molecule·cm⁻²)
		const halfWidth = parseFloat(row.gamma_air);          // cm⁻¹/atm at 296K

		if (isNaN(lineCenter_wavenumber) || isNaN(lineIntensity) || isNaN(halfWidth)) continue;

		const wavelength = wavenumberToWavelength(lineCenter_wavenumber);

		if (wavelength < WAVELENGTH_MIN || wavelength > WAVELENGTH_MAX) continue;

		linesInRange++;

		// Calculate Lorentzian line shape contribution to cross-section
		// L(ν) = (1/π) × [γ / ((ν - ν₀)² + γ²)]
		// σ(ν) = S × L(ν)
		// where S is line intensity and γ is half-width at half-maximum (HWHM)

		// Only calculate contribution within cutoff distance (beyond this, negligible)
		const cutoffDistance = LINE_WING_CUTOFF_HALFWIDTHS * halfWidth;

		for (let i = 0; i < numHighResBins; i++) {
			const binWavenumber = highResBinCenters_wavenumber[i];
			const distanceFromLineCenter = Math.abs(binWavenumber - lineCenter_wavenumber);

			if (distanceFromLineCenter > cutoffDistance) continue;

			// Lorentzian line shape function
			const lorentzianValue = halfWidth / (Math.PI * (distanceFromLineCenter * distanceFromLineCenter + halfWidth * halfWidth));

			// Add this line's contribution to the bin's cross-section
			highResCrossSections[i] += lineIntensity * lorentzianValue;
		}
	}

	console.log(`  Processed ${linesProcessed} lines, ${linesInRange} in wavelength range`);

	// Build k-distributions from high-res data
	const kDistributions = [];

	for (let i = 0; i < NUM_BINS; i++) {
		// Extract high-res cross-sections that fall within this output bin
		const startIdx = i * HIGH_RES_MULTIPLIER;
		const endIdx = (i + 1) * HIGH_RES_MULTIPLIER;
		const binnedCrossSections = highResCrossSections.slice(startIdx, endIdx);

		// Sort cross-sections
		const sorted = [...binnedCrossSections].sort((a, b) => a - b);

		// Extract k-values at percentiles
		const kValues = [];
		const weights = [];
		for (let k = 0; k < NUM_K_VALUES; k++) {
			// Evenly spaced percentiles
			const percentile = (k + 0.5) / NUM_K_VALUES;
			const idx = Math.floor(percentile * sorted.length);
			kValues.push(sorted[Math.min(idx, sorted.length - 1)]);
			weights.push(1.0 / NUM_K_VALUES);
		}

		kDistributions.push({ kValues, weights });
	}

	const maxCrossSection = Math.max(...highResCrossSections);
	const avgCrossSection = highResCrossSections.reduce((a, b) => a + b, 0) / highResCrossSections.length;
	console.log(`  Max cross-section: ${maxCrossSection.toExponential(3)} cm²/molecule`);
	console.log(`  Avg cross-section: ${avgCrossSection.toExponential(3)} cm²/molecule`);
	console.log(`  k-distributions: ${NUM_BINS} bins × ${NUM_K_VALUES} k-values`);

	return { wavelengths, kDistributions };
}

/**
 * Find the CSV file for a given gas
 */
function findGasCSV(gas) {
	const gasDir = path.join(__dirname, '..', 'public', 'hitran-line', gas);
	const files = fs.readdirSync(gasDir);
	const csvFile = files.find(f => f.endsWith('.csv'));

	if (!csvFile) {
		throw new Error(`No CSV file found for gas: ${gas}`);
	}

	return path.join(gasDir, csvFile);
}

/**
 * Main processing function
 */
function main() {
	console.log('Converting HITRAN line-by-line data to binned cross-sections');
	console.log(`Bins: ${NUM_BINS} log-spaced from ${WAVELENGTH_MIN} to ${WAVELENGTH_MAX} μm\n`);

	const results = {};

	// Process each gas
	for (const gas of GASES) {
		try {
			const csvPath = findGasCSV(gas);
			const data = processHitranFile(csvPath);
			results[gas] = data;
		} catch (error) {
			console.error(`Error processing ${gas}: ${error.message}`);
		}
	}

	// Generate TypeScript output
	let tsContent = '// HITRAN line-by-line data converted to correlated-k distributions\n';
	tsContent += '// Generated by scripts/convertHitranToTS.js\n';
	tsContent += '//\n';
	tsContent += '// Data format: Correlated-k method for accurate radiative transfer\n';
	tsContent += `//   Spectral bins: ${NUM_BINS} log-spaced from ${WAVELENGTH_MIN} to ${WAVELENGTH_MAX} μm\n`;
	tsContent += `//   k-values per bin: ${NUM_K_VALUES} (captures line + window structure)\n`;
	tsContent += '//   Reference temperature: 296 K\n';
	tsContent += '//\n';
	tsContent += '// To calculate transmission:\n';
	tsContent += '//   For each wavelength bin:\n';
	tsContent += '//     T_bin = Σ w_i × exp(-k_i × N)\n';
	tsContent += '//   where N = column density (molecules/cm²)\n';
	tsContent += '//\n';
	tsContent += '// This correctly handles spectral variation within bins, avoiding\n';
	tsContent += '// the Jensen inequality problem: exp(-avg(σ)N) ≠ avg(exp(-σN))\n';
	tsContent += '\n';

	tsContent += 'export type KDistribution = {\n';
	tsContent += '\tkValues: number[];   // Sorted absorption cross-sections (cm²/molecule)\n';
	tsContent += '\tweights: number[];   // Spectral weights (sum to 1.0)\n';
	tsContent += '};\n\n';

	tsContent += 'export type HitranCrossSectionSpectrum = {\n';
	tsContent += '\twavelengths: number[];        // μm (bin centers)\n';
	tsContent += '\tkDistributions: KDistribution[];  // One per wavelength bin\n';
	tsContent += '};\n\n';

	// Write data for each gas
	for (const [gas, data] of Object.entries(results)) {
		const varName = `${gas}CrossSection`;

		tsContent += `export const ${varName}: HitranCrossSectionSpectrum = {\n`;
		tsContent += '\twavelengths: [\n\t\t';
		tsContent += data.wavelengths.map(w => w.toExponential(6)).join(', ');
		tsContent += '\n\t],\n';
		tsContent += '\tkDistributions: [\n';

		for (const kDist of data.kDistributions) {
			tsContent += '\t\t{\n';
			tsContent += '\t\t\tkValues: [';
			tsContent += kDist.kValues.map(k => k.toExponential(6)).join(', ');
			tsContent += '],\n';
			tsContent += '\t\t\tweights: [';
			tsContent += kDist.weights.map(w => w.toFixed(6)).join(', ');
			tsContent += ']\n';
			tsContent += '\t\t},\n';
		}

		tsContent += '\t]\n';
		tsContent += '};\n\n';
	}

	// Write aggregated data structure
	tsContent += 'export const allHitranCrossSections: Record<string, HitranCrossSectionSpectrum> = {\n';
	for (const gas of GASES) {
		tsContent += `\t${gas}: ${gas}CrossSection,\n`;
	}
	tsContent += '};\n';

	// Write output file
	const outputPath = path.join(__dirname, '..', 'src', 'experiment', 'hitranCrossSections.ts');
	fs.writeFileSync(outputPath, tsContent, 'utf8');

	console.log(`\nOutput written to: ${outputPath}`);
	console.log('\nSummary:');
	for (const [gas, data] of Object.entries(results)) {
		// Compute average k-values across all bins
		const allKValues = data.kDistributions.flatMap(kd => kd.kValues);
		const avgK = allKValues.reduce((a, b) => a + b, 0) / allKValues.length;
		const maxK = Math.max(...allKValues);
		console.log(`  ${gas}: avg k=${avgK.toExponential(3)}, max k=${maxK.toExponential(3)} cm²/molecule`);
	}
}

main();

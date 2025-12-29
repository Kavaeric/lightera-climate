/**
 * Process HITRAN line-by-line data into correlated-k distributions
 *
 * Input: HITRAN CSV files with columns: nu, sw, elower, gamma_air, n_air, etc.
 * Output: Gas absorption data (k-distributions) for GPU radiative transfer
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
 * Usage: node scripts/processHitranData.js
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';
import { generateLogBins, getBinCenters, NUM_BINS, WAVELENGTH_MIN, WAVELENGTH_MAX } from './generateSpectralBins.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === CONFIGURATION ===
const NUM_K_VALUES = 4;            // k-values per bin (higher = more accurate, slower)
const HIGH_RES_MULTIPLIER = 32;    // Internal oversampling factor

// Gases to process (must match directory names in public/hitran-line/)
const GASES = ['ch4', 'co', 'co2', 'h2o', 'n2', 'n2o', 'o2', 'o3', 'so2', 'hcl', 'hfl'];

// === PHYSICS CONSTANTS ===
const WAVENUMBER_TO_WAVELENGTH_CONVERSION = 10000.0; // cm⁻¹ to μm
const LINE_WING_CUTOFF_HALFWIDTHS = 25; // Line shape negligible beyond this

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

	// Initialise high-resolution cross-section array (one per high-res bin)
	const highResCrossSections = new Float64Array(numHighResBins);

	// Process each spectral line
	let linesProcessed = 0;
	let linesInRange = 0;
	let maxCrossSection = 0;

	for (const row of parsed.data) {
		linesProcessed++;

		const nu = parseFloat(row.nu);           // Wavenumber (cm⁻¹)
		const sw = parseFloat(row.sw);           // Line intensity (cm⁻¹/(molecule·cm⁻²))
		const gamma_air = parseFloat(row.gamma_air); // Air-broadened half-width (cm⁻¹/atm)

		const lineWavelength = wavenumberToWavelength(nu);

		// Skip lines outside our wavelength range
		if (lineWavelength < WAVELENGTH_MIN || lineWavelength > WAVELENGTH_MAX) {
			continue;
		}

		linesInRange++;

		// Calculate line contribution to each high-resolution bin
		// Using Lorentzian line shape (collisional broadening dominates in atmosphere)
		for (let binIdx = 0; binIdx < numHighResBins; binIdx++) {
			const binWavenumber = highResBinCenters_wavenumber[binIdx];
			const delta_nu = binWavenumber - nu;

			// Skip if too far from line center (saves computation)
			if (Math.abs(delta_nu) > LINE_WING_CUTOFF_HALFWIDTHS * gamma_air) {
				continue;
			}

			// Lorentzian line shape: L(ν) = (γ/π) / ((ν-ν₀)² + γ²)
			// Cross-section: σ(ν) = S × L(ν)
			const lorentzian = gamma_air / (Math.PI * (delta_nu * delta_nu + gamma_air * gamma_air));
			const crossSection = sw * lorentzian;

			highResCrossSections[binIdx] += crossSection;
			maxCrossSection = Math.max(maxCrossSection, highResCrossSections[binIdx]);
		}
	}

	// Compute average cross-section
	const avgCrossSection = highResCrossSections.reduce((a, b) => a + b, 0) / numHighResBins;

	console.log(`  Processed ${linesProcessed} lines, ${linesInRange} in wavelength range`);
	console.log(`  Max cross-section: ${maxCrossSection.toExponential(3)} cm²/molecule`);
	console.log(`  Avg cross-section: ${avgCrossSection.toExponential(3)} cm²/molecule`);

	// === CORRELATED-K METHOD ===
	// For each output bin, extract k-distribution from high-resolution data

	const kDistributions = [];

	for (let outBinIdx = 0; outBinIdx < NUM_BINS; outBinIdx++) {
		// Find all high-resolution bins that belong to this output bin
		const highResBinsPerOutputBin = HIGH_RES_MULTIPLIER;
		const startIdx = outBinIdx * highResBinsPerOutputBin;
		const endIdx = startIdx + highResBinsPerOutputBin;

		// Extract cross-sections for this bin
		const binCrossSections = Array.from(highResCrossSections.slice(startIdx, endIdx));

		// Sort cross-sections to find percentiles (k-values)
		binCrossSections.sort((a, b) => a - b);

		// Extract k-values at equal-weight percentiles
		// For 4 k-values: 12.5%, 37.5%, 62.5%, 87.5%
		const kValues = [];
		for (let i = 0; i < NUM_K_VALUES; i++) {
			const percentile = (i + 0.5) / NUM_K_VALUES;
			const idx = Math.floor(percentile * binCrossSections.length);
			kValues.push(binCrossSections[idx]);
		}

		// Equal weights for simplicity (could be refined with spectral mapping)
		const weights = new Array(NUM_K_VALUES).fill(1.0 / NUM_K_VALUES);

		kDistributions.push({ kValues, weights });
	}

	console.log(`  k-distributions: ${NUM_BINS} bins × ${NUM_K_VALUES} k-values`);

	return { wavelengths, kDistributions };
}

/**
 * Find CSV file for a gas in public/hitran-line/{gas}/
 */
function findGasCSV(gas) {
	const gasDir = path.join(__dirname, '..', 'public', 'hitran-line', gas);

	if (!fs.existsSync(gasDir)) {
		throw new Error(`Gas directory not found: ${gasDir}`);
	}

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
	console.log('Processing HITRAN line-by-line data to k-distributions');
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

	// === OUTPUT: MAIN DATA FILE ===
	// Generate TypeScript output with full k-distributions
	let tsContent = '// Gas absorption data (correlated-k distributions from HITRAN)\n';
	tsContent += '// Generated by scripts/processHitranData.js\n';
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

	tsContent += 'export type GasAbsorptionSpectrum = {\n';
	tsContent += '\twavelengths: number[];        // μm (bin centers)\n';
	tsContent += '\tkDistributions: KDistribution[];  // One per wavelength bin\n';
	tsContent += '};\n\n';

	// Write data for each gas
	for (const [gas, data] of Object.entries(results)) {
		const varName = `${gas}Absorption`;

		tsContent += `export const ${varName}: GasAbsorptionSpectrum = {\n`;
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
			tsContent += kDist.weights.join(', ');
			tsContent += ']\n';
			tsContent += '\t\t},\n';
		}

		tsContent += '\t]\n';
		tsContent += '};\n\n';
	}

	const mainOutputPath = path.join(__dirname, '..', 'src', 'data', 'gasAbsorptionData.ts');
	fs.writeFileSync(mainOutputPath, tsContent, 'utf8');

	// === OUTPUT: GPU TEXTURE FILES ===
	// Generate individual files per gas for GPU texture data
	const textureDir = path.join(__dirname, '..', 'src', 'data', 'gasTextures');
	if (!fs.existsSync(textureDir)) {
		fs.mkdirSync(textureDir, { recursive: true });
	}

	for (const [gas, data] of Object.entries(results)) {
		let gasTextureContent = '// GPU texture data for ' + gas.toUpperCase() + '\n';
		gasTextureContent += '// Generated by scripts/processHitranData.js\n';
		gasTextureContent += '// Pre-computed to avoid runtime overhead\n\n';

		// Create k-distribution texture data (128x1 RGBA)
		const kData = new Float32Array(NUM_BINS * 4);
		for (let i = 0; i < NUM_BINS; i++) {
			kData[i * 4 + 0] = data.kDistributions[i].kValues[0];
			kData[i * 4 + 1] = data.kDistributions[i].kValues[1];
			kData[i * 4 + 2] = data.kDistributions[i].kValues[2];
			kData[i * 4 + 3] = data.kDistributions[i].kValues[3];
		}

		gasTextureContent += '/** k-distribution texture data (128×1 RGBA, cm²/molecule) */\n';
		gasTextureContent += 'export const kDistributionData = new Float32Array([\n\t';
		gasTextureContent += Array.from(kData).map(v => v.toExponential(6)).join(', ');
		gasTextureContent += '\n]);\n\n';

		// Create wavelength + binWidth texture data (128x1 RG)
		// RG format: R = wavelength (μm), G = binWidth (μm)
		const wavelengthBinWidthData = new Float32Array(NUM_BINS * 2);
		for (let i = 0; i < NUM_BINS; i++) {
			const wavelength = data.wavelengths[i];
			const wavelengthNext = i < NUM_BINS - 1 ? data.wavelengths[i + 1] : wavelength;
			const binWidth = wavelengthNext - wavelength;

			wavelengthBinWidthData[i * 2 + 0] = wavelength;  // R channel
			wavelengthBinWidthData[i * 2 + 1] = binWidth;    // G channel
		}

		gasTextureContent += '/** Wavelength + bin width texture data (128×1 RG, μm) */\n';
		gasTextureContent += '// R = wavelength bin center, G = bin width\n';
		gasTextureContent += 'export const wavelengthBinWidthData = new Float32Array([\n\t';
		gasTextureContent += Array.from(wavelengthBinWidthData).map(v => v.toExponential(6)).join(', ');
		gasTextureContent += '\n]);\n';

		const gasFilePath = path.join(textureDir, `${gas}.ts`);
		fs.writeFileSync(gasFilePath, gasTextureContent, 'utf8');
	}

	console.log(`\nMain output: ${mainOutputPath}`);
	console.log(`GPU texture files: ${textureDir}`);
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

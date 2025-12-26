/**
 * Log-binning downsampler for HITRAN spectral data
 *
 * Takes high-resolution CSV data and bins it into log-spaced wavelength bins.
 *
 * Usage: node scripts/downsampleHitran.js <input.csv> <output.csv> [numBins]
 * e.g. node scripts/downsampleHitran.js refs/spectra/hitran_h2o.csv refs/spectra/hitran_h2o_downsampled_256.csv 256
 */

import fs from 'fs';

// Parse CSV with scientific notation
function parseCSV(content) {
	const lines = content.trim().split('\n');
	const data = [];

	for (let i = 1; i < lines.length; i++) { // Skip header
		const parts = lines[i].split(',');
		if (parts.length >= 2) {
			const wavelength = parseFloat(parts[0]);
			const absorbance = parseFloat(parts[1]);

			if (!isNaN(wavelength) && !isNaN(absorbance)) {
				data.push([wavelength, absorbance]);
			}
		}
	}

	// Sort by wavelength (ascending)
	data.sort((a, b) => a[0] - b[0]);

	return data;
}

// Generate log-spaced bins
function generateLogBins(min, max, n) {
	const bins = [];
	for (let i = 0; i < n; i++) {
		bins.push(min * Math.pow(max / min, i / (n - 1)));
	}
	return bins;
}

// Binary search to find insertion index
function binarySearch(data, wavelength) {
	let left = 0;
	let right = data.length - 1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		if (data[mid][0] < wavelength) {
			left = mid + 1;
		} else {
			right = mid - 1;
		}
	}

	return left;
}

// Bin the data using linear interpolation
function binData(data, bins) {
	const binned = [];

	for (const binWavelength of bins) {
		// Binary search for surrounding points
		const i = binarySearch(data, binWavelength);

		let absorbance;

		// Edge cases
		if (i === 0) {
			absorbance = data[0][1]; // extrapolate from first point
		} else if (i === data.length) {
			absorbance = data[data.length - 1][1]; // extrapolate from last point
		} else {
			// Linear interpolation between data[i-1] and data[i]
			const [λ1, a1] = data[i - 1];
			const [λ2, a2] = data[i];
			const t = (binWavelength - λ1) / (λ2 - λ1);
			absorbance = a1 + t * (a2 - a1);
		}

		binned.push([binWavelength, absorbance]);
	}

	return binned;
}

// Write output CSV
function writeCSV(data, outputPath) {
	const lines = ['Wavelength (μm),Transmission'];

	for (const [wavelength, absorbance] of data) {
		const outputValue = Math.exp(-absorbance);

		lines.push(`${wavelength.toExponential(6)},${outputValue.toExponential(6)}`);
	}

	fs.writeFileSync(outputPath, lines.join('\n'));
	console.log(`Wrote output to ${outputPath}`);
}

// Main
const args = process.argv.slice(2);

if (args.length < 2) {
	console.error('Usage: node downsampleHitran.js <input.csv> <output.csv> [numBins]');
	console.error('Example: node scripts/downsampleHitran.js refs/spectra/hitran_h2o.csv refs/spectra/hitran_h2o_downsampled.csv 512');
	process.exit(1);
}

const [inputPath, outputPath, numBinsStr] = args;
const numBins = numBinsStr ? parseInt(numBinsStr) : 256;

if (!fs.existsSync(inputPath)) {
	console.error(`Input file not found: ${inputPath}`);
	process.exit(1);
}

console.log(`Reading ${inputPath}...`);
const content = fs.readFileSync(inputPath, 'utf8');
const data = parseCSV(content);

if (data.length === 0) {
	console.error('No valid data found in CSV');
	process.exit(1);
}

console.log(`Parsed ${data.length} data points`);

// Determine wavelength range (data is already sorted)
const minWavelength = data[0][0];
const maxWavelength = data[data.length - 1][0];

// Convert to micrometers if needed (assume nm if > 1000)
const isNanometers = minWavelength > 100;
let wavelengthData = data;

if (isNanometers) {
	console.log(`Converting from nanometers to micrometers...`);
	wavelengthData = data.map(([wl, abs]) => [wl / 1000, abs]);
}

const minWL = wavelengthData[0][0];
const maxWL = wavelengthData[wavelengthData.length - 1][0];

// console.log(`Wavelength range: ${minWL.toFixed(2)} - ${maxWL.toFixed(2)} μm`);
// console.log(`Absorbance range: ${Math.min(...wavelengthData.map(d => d[1])).toExponential(2)} - ${Math.max(...wavelengthData.map(d => d[1])).toExponential(2)}`);
console.log(`Creating ${numBins} log-spaced bins...`);

const bins = generateLogBins(minWL, maxWL, numBins);
const binned = binData(wavelengthData, bins);

console.log(`Binned to ${binned.length} points`);
writeCSV(binned, outputPath);

console.log('Done!');

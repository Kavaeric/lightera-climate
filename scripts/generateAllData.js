/**
 * Main script to generate all pre-computed data
 *
 * Runs all preprocessing scripts in the correct order:
 * 1. Process HITRAN data → k-distributions
 * 2. Generate Planck lookup table
 *
 * Usage: node scripts/generateAllData.js
 *        or: npm run generate:data
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(70));
console.log('Generating all pre-computed data for climate simulation');
console.log('='.repeat(70));
console.log();

const scripts = [
	{ name: 'HITRAN k-distributions', file: 'processHitranData.js' },
	{ name: 'Planck lookup table', file: 'generatePlanckLookup.js' }
];

for (const script of scripts) {
	console.log(`\n${'='.repeat(70)}`);
	console.log(`Running: ${script.name}`);
	console.log('='.repeat(70));

	const scriptPath = path.join(__dirname, script.file);

	try {
		execSync(`node "${scriptPath}"`, {
			stdio: 'inherit',
			cwd: path.join(__dirname, '..')
		});
		console.log(`${script.name} completed successfully.`);
	} catch (error) {
		console.error(`${script.name} failed!`);
		process.exit(1);
	}
}

console.log();
console.log('='.repeat(70));
console.log('All data generation completed successfully.');
console.log('='.repeat(70));

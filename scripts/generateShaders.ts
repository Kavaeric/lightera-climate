/**
 * Generate GLSL shader code from TypeScript schema definitions.
 *
 * This script generates:
 * - atmosphereLayerAccessors.glsl: Accessor functions for multi-layer atmosphere
 *
 * Usage: npx tsx scripts/generateShaders.ts
 *        or: npm run generate:shaders
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Import generator
import { generateAtmosphereLayerAccessorsGLSL } from '../src/climate/schema/generateLayerAccessors.js';

console.log('='.repeat(70));
console.log('Generating GLSL shader code from schema');
console.log('='.repeat(70));
console.log();

// Output directory
const outputDir = join(projectRoot, 'src', 'climate', 'shaders', 'generated');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  console.log(`Creating directory: ${outputDir}`);
  mkdirSync(outputDir, { recursive: true });
}

// Generate atmosphere layer accessors
const outputPath = join(outputDir, 'atmosphereLayerAccessors.glsl');
console.log(`Generating: ${outputPath}`);

const glslContent = generateAtmosphereLayerAccessorsGLSL();
writeFileSync(outputPath, glslContent, 'utf-8');

console.log(`  Written ${glslContent.length} bytes`);
console.log();
console.log('='.repeat(70));
console.log('Shader generation completed successfully.');
console.log('='.repeat(70));

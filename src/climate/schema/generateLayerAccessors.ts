/**
 * GLSL Code Generator for Atmosphere Layer Accessors
 *
 * Generates atmosphereLayerAccessors.glsl from the schema definition.
 * Run via: npx tsx scripts/generateShaders.ts
 */

import {
  ATMOSPHERE_LAYERS,
  NUM_ATMOSPHERE_LAYERS,
  THERMO_VARIABLES,
  DYNAMICS_VARIABLES,
  getLayerThermoUniformName,
  getLayerDynamicsUniformName,
  getAccessorFunctionName,
  getPackFunctionName,
} from './atmosphereLayerSchema';

/**
 * Generate the complete GLSL accessor file content.
 */
export function generateAtmosphereLayerAccessorsGLSL(): string {
  const lines: string[] = [];

  // Header
  lines.push('// =============================================================================');
  lines.push('// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY');
  lines.push('// Generated from: src/climate/schema/atmosphereLayerSchema.ts');
  lines.push('// Run "npm run generate:shaders" to regenerate');
  lines.push('// =============================================================================');
  lines.push('');
  lines.push('#ifndef ATMOSPHERE_LAYER_ACCESSORS_GLSL');
  lines.push('#define ATMOSPHERE_LAYER_ACCESSORS_GLSL');
  lines.push('');

  // Constants
  lines.push('// =============================================================================');
  lines.push('// CONSTANTS');
  lines.push('// =============================================================================');
  lines.push('');
  lines.push(`const int NUM_ATMOSPHERE_LAYERS = ${NUM_ATMOSPHERE_LAYERS};`);
  lines.push('');

  // Layer pressure fraction constants (planetary-independent)
  lines.push('// Pressure fractions relative to surface pressure');
  for (const layer of ATMOSPHERE_LAYERS) {
    lines.push(`const float LAYER_${layer.index}_PRESSURE_BOTTOM = ${layer.pressureBottom.toFixed(3)}; // Fraction of surface pressure`);
    lines.push(`const float LAYER_${layer.index}_PRESSURE_TOP = ${layer.pressureTop.toFixed(3)}; // Fraction of surface pressure`);
    lines.push(`const float LAYER_${layer.index}_REF_PRESSURE_FRACTION = ${layer.referencePressure.toFixed(3)}; // Fraction of surface pressure`);
  }
  lines.push('');

  // Helper functions for altitude calculation
  lines.push('// =============================================================================');
  lines.push('// ALTITUDE CALCULATION HELPERS');
  lines.push('// =============================================================================');
  lines.push('');
  lines.push('// Calculate altitude from pressure using barometric formula');
  lines.push('// z = H * ln(P_surface / P) where H is scale height');
  lines.push('float calculateAltitude(float pressure, float surfacePressure, float scaleHeight) {');
  lines.push('  return scaleHeight * log(surfacePressure / pressure);');
  lines.push('}');
  lines.push('');

  // Uniform declarations
  lines.push('// =============================================================================');
  lines.push('// UNIFORM DECLARATIONS');
  lines.push('// =============================================================================');
  lines.push('');
  lines.push('// Thermo textures: RGBA = [temperature, pressure, humidity, cloudFraction]');
  for (const layer of ATMOSPHERE_LAYERS) {
    lines.push(`uniform sampler2D ${getLayerThermoUniformName(layer.index)};`);
  }
  lines.push('');
  lines.push('// Dynamics textures: RGBA = [windU, windV, omega, reserved]');
  for (const layer of ATMOSPHERE_LAYERS) {
    lines.push(`uniform sampler2D ${getLayerDynamicsUniformName(layer.index)};`);
  }
  lines.push('');

  // Generate accessors for each layer
  for (const layer of ATMOSPHERE_LAYERS) {
    const pressureRange = `${(layer.pressureBottom * 100).toFixed(0)}-${(layer.pressureTop * 100).toFixed(1)}%`;
    lines.push('// =============================================================================');
    lines.push(`// LAYER ${layer.index}: ${layer.name.toUpperCase()} (${pressureRange} surface pressure)`);
    lines.push('// =============================================================================');
    lines.push('');

    // Thermo accessors
    lines.push(`// --- Thermo State (${getLayerThermoUniformName(layer.index)}) ---`);
    for (const variable of THERMO_VARIABLES) {
      const funcName = getAccessorFunctionName(layer.index, variable.name);
      lines.push(`// ${variable.description} [${variable.unit}]`);
      lines.push(`float ${funcName}(vec2 uv) {`);
      lines.push(`  return texture(${getLayerThermoUniformName(layer.index)}, uv).${variable.channel};`);
      lines.push('}');
      lines.push('');
    }

    // Dynamics accessors
    lines.push(`// --- Dynamics State (${getLayerDynamicsUniformName(layer.index)}) ---`);
    for (const variable of DYNAMICS_VARIABLES) {
      if (variable.name === 'reserved') continue; // Skip reserved channel
      const funcName = getAccessorFunctionName(layer.index, variable.name);
      lines.push(`// ${variable.description} [${variable.unit}]`);
      lines.push(`float ${funcName}(vec2 uv) {`);
      lines.push(`  return texture(${getLayerDynamicsUniformName(layer.index)}, uv).${variable.channel};`);
      lines.push('}');
      lines.push('');
    }

    // Wind vector accessor (convenience)
    lines.push(`// Wind vector [m/s]`);
    lines.push(`vec2 getLayer${layer.index}Wind(vec2 uv) {`);
    lines.push(`  vec4 data = texture(${getLayerDynamicsUniformName(layer.index)}, uv);`);
    lines.push(`  return vec2(data.r, data.g);`);
    lines.push('}');
    lines.push('');

    // Struct for reading all thermo data at once
    lines.push(`// Read all thermo state at once (more efficient for multiple reads)`);
    lines.push(`struct Layer${layer.index}ThermoState {`);
    lines.push('  float temperature;');
    lines.push('  float pressure;');
    lines.push('  float humidity;');
    lines.push('  float cloudFraction;');
    lines.push('};');
    lines.push('');
    lines.push(`Layer${layer.index}ThermoState getLayer${layer.index}ThermoState(vec2 uv) {`);
    lines.push(`  vec4 data = texture(${getLayerThermoUniformName(layer.index)}, uv);`);
    lines.push(`  return Layer${layer.index}ThermoState(data.r, data.g, data.b, data.a);`);
    lines.push('}');
    lines.push('');

    // Pack functions
    lines.push(`// Pack thermo state for output`);
    const thermoParams = THERMO_VARIABLES.map(v => `float ${v.name}`).join(', ');
    const thermoChannels = THERMO_VARIABLES.map(v => v.name).join(', ');
    lines.push(`vec4 ${getPackFunctionName(layer.index, 'thermo')}(${thermoParams}) {`);
    lines.push(`  return vec4(${thermoChannels});`);
    lines.push('}');
    lines.push('');

    lines.push(`// Pack dynamics state for output`);
    const dynamicsParams = DYNAMICS_VARIABLES.filter(v => v.name !== 'reserved')
      .map(v => `float ${v.name}`)
      .join(', ');
    lines.push(`vec4 ${getPackFunctionName(layer.index, 'dynamics')}(${dynamicsParams}) {`);
    lines.push(`  return vec4(windU, windV, omega, 0.0);`);
    lines.push('}');
    lines.push('');
  }

  // Column-integrated accessors
  lines.push('// =============================================================================');
  lines.push('// COLUMN-INTEGRATED ACCESSORS');
  lines.push('// =============================================================================');
  lines.push('');

  // Generic layer accessor by index
  lines.push('// Get temperature for any layer by index');
  lines.push('float getLayerTemperature(vec2 uv, int layer) {');
  lines.push('  if (layer == 0) return getLayer0Temperature(uv);');
  lines.push('  if (layer == 1) return getLayer1Temperature(uv);');
  lines.push('  if (layer == 2) return getLayer2Temperature(uv);');
  lines.push('  return 0.0;');
  lines.push('}');
  lines.push('');

  lines.push('// Get pressure for any layer by index');
  lines.push('float getLayerPressure(vec2 uv, int layer) {');
  lines.push('  if (layer == 0) return getLayer0Pressure(uv);');
  lines.push('  if (layer == 1) return getLayer1Pressure(uv);');
  lines.push('  if (layer == 2) return getLayer2Pressure(uv);');
  lines.push('  return 0.0;');
  lines.push('}');
  lines.push('');

  lines.push('// Get humidity for any layer by index');
  lines.push('float getLayerHumidity(vec2 uv, int layer) {');
  lines.push('  if (layer == 0) return getLayer0Humidity(uv);');
  lines.push('  if (layer == 1) return getLayer1Humidity(uv);');
  lines.push('  if (layer == 2) return getLayer2Humidity(uv);');
  lines.push('  return 0.0;');
  lines.push('}');
  lines.push('');

  lines.push('// Get cloud fraction for any layer by index');
  lines.push('float getLayerCloudFraction(vec2 uv, int layer) {');
  lines.push('  if (layer == 0) return getLayer0CloudFraction(uv);');
  lines.push('  if (layer == 1) return getLayer1CloudFraction(uv);');
  lines.push('  if (layer == 2) return getLayer2CloudFraction(uv);');
  lines.push('  return 0.0;');
  lines.push('}');
  lines.push('');

  // Column totals
  lines.push('// Calculate column-integrated precipitable water (kg/m²)');
  lines.push('// This sums humidity weighted by layer mass');
  lines.push('float getColumnPrecipitableWater(vec2 uv, float surfacePressure, float gravity) {');
  lines.push('  float total = 0.0;');
  lines.push('  // Layer 0: boundary layer (~0-2km)');
  lines.push('  float p0 = getLayer0Pressure(uv);');
  lines.push('  float p1 = getLayer1Pressure(uv);');
  lines.push('  float p2 = getLayer2Pressure(uv);');
  lines.push('  float q0 = getLayer0Humidity(uv);');
  lines.push('  float q1 = getLayer1Humidity(uv);');
  lines.push('  float q2 = getLayer2Humidity(uv);');
  lines.push('  // Approximate layer masses from pressure differences');
  lines.push('  float mass0 = (surfacePressure - p1) / gravity;');
  lines.push('  float mass1 = (p0 - p2) / gravity;');
  lines.push('  float mass2 = p1 / gravity;');
  lines.push('  total = q0 * mass0 + q1 * mass1 + q2 * mass2;');
  lines.push('  return total;');
  lines.push('}');
  lines.push('');

  lines.push('// Calculate effective cloud fraction (weighted by optical thickness)');
  lines.push('// Higher clouds contribute less to total albedo');
  lines.push('float getEffectiveCloudFraction(vec2 uv) {');
  lines.push('  float c0 = getLayer0CloudFraction(uv);');
  lines.push('  float c1 = getLayer1CloudFraction(uv);');
  lines.push('  float c2 = getLayer2CloudFraction(uv);');
  lines.push('  // Weight by approximate optical depth (lower layers thicker)');
  lines.push('  return c0 * 0.6 + c1 * 0.3 + c2 * 0.1;');
  lines.push('}');
  lines.push('');

  // Mass-weighted average temperature
  lines.push('// Calculate mass-weighted average atmospheric temperature');
  lines.push('float getColumnAverageTemperature(vec2 uv) {');
  lines.push('  float t0 = getLayer0Temperature(uv);');
  lines.push('  float t1 = getLayer1Temperature(uv);');
  lines.push('  float t2 = getLayer2Temperature(uv);');
  lines.push('  // Approximate weights based on typical mass distribution');
  lines.push('  // Boundary layer ~20%, troposphere ~70%, stratosphere ~10%');
  lines.push('  return t0 * 0.2 + t1 * 0.7 + t2 * 0.1;');
  lines.push('}');
  lines.push('');

  // Footer
  lines.push('#endif // ATMOSPHERE_LAYER_ACCESSORS_GLSL');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate TypeScript type definitions that mirror the GLSL structure.
 * Useful for CPU-side initialisation and readback.
 */
export function generateTypeScriptDefinitions(): string {
  const lines: string[] = [];

  lines.push('// =============================================================================');
  lines.push('// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY');
  lines.push('// Generated from: src/climate/schema/atmosphereLayerSchema.ts');
  lines.push('// =============================================================================');
  lines.push('');
  lines.push('export interface LayerThermoState {');
  for (const variable of THERMO_VARIABLES) {
    lines.push(`  /** ${variable.description} [${variable.unit}] */`);
    lines.push(`  ${variable.name}: number;`);
  }
  lines.push('}');
  lines.push('');
  lines.push('export interface LayerDynamicsState {');
  for (const variable of DYNAMICS_VARIABLES) {
    if (variable.name === 'reserved') continue;
    lines.push(`  /** ${variable.description} [${variable.unit}] */`);
    lines.push(`  ${variable.name}: number;`);
  }
  lines.push('}');
  lines.push('');
  lines.push('export interface AtmosphereLayerState {');
  lines.push('  thermo: LayerThermoState;');
  lines.push('  dynamics: LayerDynamicsState;');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

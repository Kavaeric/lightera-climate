/**
 * Colourmap system for GPU-based data visualisation
 *
 * This module provides:
 * - ColourmapDefinition: Interface for defining colourmaps with position-based stops
 * - createColourmapTexture: Creates 1D GPU textures from colourmap definitions
 * - JSON loader utilities for loading colourmaps from external files
 * - Pre-defined colourmap constants loaded from JSON files
 *
 * Usage (with pre-defined constants):
 *   import { COLOURMAP_PLASMA, createColourmapTexture } from './colourmaps'
 *   const texture = createColourmapTexture(COLOURMAP_PLASMA)
 *   material.uniforms.colourmapTexture.value = texture
 *
 * Usage (async loading from custom files):
 *   import { loadColourmapJSON, createColourmapTexture } from './colourmaps'
 *   const colourmap = await loadColourmapJSON('/path/to/custom.json')
 *   const texture = createColourmapTexture(colourmap)
 *   material.uniforms.colourmapTexture.value = texture
 */

// Texture creation utilities
export {
  type ColourmapDefinition,
  createColourmapTexture,
  getColourmapUVMapping,
  generateColourmapSamplerGLSL,
} from './ColourmapTexture';

// JSON loader utilities
export {
  type ColourmapJSON,
  validateColourmapJSON,
  colourmapJSONToDefinition,
  parseColourmapJSON,
  loadColourmapJSON,
} from './loader';

// Pre-defined colourmap constants (loaded from JSON files)
export * from './colourmaps';

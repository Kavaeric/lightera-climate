/**
 * Colourmap system for GPU-based data visualisation
 *
 * This module provides:
 * - ColourmapDefinition: Interface for defining colourmaps with control points
 * - createColourmapTexture: Creates 1D GPU textures from colourmap definitions
 * - Pre-defined colourmaps (COLOURMAP_PLASMA, COLOURMAP_GREYSCALE, etc.)
 *
 * Usage:
 *   import { COLOURMAP_PLASMA, createColourmapTexture } from './colourmaps'
 *   const texture = createColourmapTexture(COLOURMAP_PLASMA)
 *   material.uniforms.colourmapTexture.value = texture
 */

// Texture creation utilities
export {
  type ColourmapDefinition,
  createColourmapTexture,
  getColourmapUVMapping,
  generateColourmapSamplerGLSL,
} from './ColourmapTexture';

// Pre-defined colourmaps
export {
  COLOURMAP_GREYSCALE,
  COLOURMAP_YELLOW_YEL15,
  COLOURMAP_BLUE_B1,
  COLOURMAP_TEAL_C16,
  COLOURMAP_WATER_STATE,
  COLOURMAP_BLUE_SD,
  COLOURMAP_TR4,
  COLOURMAP_EXTENDED_KINDLMANN,
  COLOURMAP_PLASMA,
  COLOURMAP_FAST,
  COLOURMAP_TERRAIN_ELEVATION,
  COLOURMAP_TERRAIN_WATER,
  COLOURMAP_TERRAIN_ICE,
} from './definitions';

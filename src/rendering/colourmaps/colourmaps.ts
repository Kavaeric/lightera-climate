/**
 * Colourmap constants loaded from JSON files
 * These are synchronously available at import time for use in visualisation modes.
 */

import { parseColourmapJSON } from './loader';
import type { ColourmapDefinition } from './ColourmapTexture';

// Import JSON files directly (Vite/bundler will handle these)
import greyscaleJSON from './definitions/greyscale.jsonc';
import yellowPeachbrJSON from './definitions/yellow_peachbr.jsonc';
import blueB1JSON from './definitions/blue_b1.jsonc';
import tealC16JSON from './definitions/teal_c16.jsonc';
import waterStateJSON from './definitions/water_state.jsonc';
import violetSdJSON from './definitions/violet_sd.jsonc';
import extendedKindlmannJSON from './definitions/extended_kindlmann.jsonc';
import plasmaJSON from './definitions/plasma.jsonc';
import fastJSON from './definitions/fast.jsonc';
import terrainElevationJSON from './definitions/terrain_elevation.jsonc';
import terrainWaterJSON from './definitions/terrain_water.jsonc';
import terrainIceJSON from './definitions/terrain_ice.jsonc';

/**
 * Parses a JSON and converts it to a ColourmapDefinition.
 */
function loadJSON(json: unknown): ColourmapDefinition {
  return parseColourmapJSON(JSON.stringify(json));
}

// Export colourmap constants
export const COLOURMAP_GREYSCALE = loadJSON(greyscaleJSON);
export const COLOURMAP_YELLOW_PEACHBR = loadJSON(yellowPeachbrJSON);
export const COLOURMAP_BLUE_B1 = loadJSON(blueB1JSON);
export const COLOURMAP_TEAL_C16 = loadJSON(tealC16JSON);
export const COLOURMAP_WATER_STATE = loadJSON(waterStateJSON);
export const COLOURMAP_VIOLET_SD = loadJSON(violetSdJSON);
export const COLOURMAP_EXTENDED_KINDLMANN = loadJSON(extendedKindlmannJSON);
export const COLOURMAP_PLASMA = loadJSON(plasmaJSON);
export const COLOURMAP_FAST = loadJSON(fastJSON);
export const COLOURMAP_TERRAIN_ELEVATION = loadJSON(terrainElevationJSON);
export const COLOURMAP_TERRAIN_WATER = loadJSON(terrainWaterJSON);
export const COLOURMAP_TERRAIN_ICE = loadJSON(terrainIceJSON);

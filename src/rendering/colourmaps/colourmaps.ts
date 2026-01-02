/**
 * Colourmap constants loaded from JSON files
 * These are synchronously available at import time for use in visualisation modes.
 */

import { parseColourmapJSON } from './loader';
import type { ColourmapDefinition } from './ColourmapTexture';

// Import JSON files directly (Vite/bundler will handle these)
import greyscaleJSON from './definitions/greyscale.json';
import yellowYel15JSON from './definitions/yellow_yel15.json';
import blueB1JSON from './definitions/blue_b1.json';
import tealC16JSON from './definitions/teal_c16.json';
import waterStateJSON from './definitions/water_state.json';
import blueSdJSON from './definitions/blue_sd.json';
import tr4JSON from './definitions/tr4.json';
import extendedKindlmannJSON from './definitions/extended_kindlmann.json';
import plasmaJSON from './definitions/plasma.json';
import fastJSON from './definitions/fast.json';
import elevationTerrainJSON from './definitions/elevation_terrain.json';
import waterDepthTerrainJSON from './definitions/water_depth_terrain.json';
import iceThicknessTerrainJSON from './definitions/ice_thickness_terrain.json';

/**
 * Parses a JSON and converts it to a ColourmapDefinition.
 */
function loadJSON(json: unknown): ColourmapDefinition {
  return parseColourmapJSON(JSON.stringify(json));
}

// Export colourmap constants
export const COLOURMAP_GREYSCALE = loadJSON(greyscaleJSON);
export const COLOURMAP_YELLOW_YEL15 = loadJSON(yellowYel15JSON);
export const COLOURMAP_BLUE_B1 = loadJSON(blueB1JSON);
export const COLOURMAP_TEAL_C16 = loadJSON(tealC16JSON);
export const COLOURMAP_WATER_STATE = loadJSON(waterStateJSON);
export const COLOURMAP_BLUE_SD = loadJSON(blueSdJSON);
export const COLOURMAP_TR4 = loadJSON(tr4JSON);
export const COLOURMAP_EXTENDED_KINDLMANN = loadJSON(extendedKindlmannJSON);
export const COLOURMAP_PLASMA = loadJSON(plasmaJSON);
export const COLOURMAP_FAST = loadJSON(fastJSON);
export const COLOURMAP_TERRAIN_ELEVATION = loadJSON(elevationTerrainJSON);
export const COLOURMAP_TERRAIN_WATER = loadJSON(waterDepthTerrainJSON);
export const COLOURMAP_TERRAIN_ICE = loadJSON(iceThicknessTerrainJSON);

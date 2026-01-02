/**
 * JSON colourmap loader
 * Utilities for loading and validating colourmap JSON files
 */

import type { ColourmapDefinition } from './ColourmapTexture';

/**
 * JSON representation of a colourmap (matches schema.json)
 */
export interface ColourmapJSON {
  name: string;
  stops: Array<{
    position: number;
    color: [number, number, number];
  }>;
  interpolationSpace?: 'rgb' | 'lab';
  underflowColour: [number, number, number];
  overflowColour: [number, number, number];
  metadata?: {
    source?: string;
    creator?: string;
    url?: string;
    license?: string;
    description?: string;
  };
}

/**
 * Validate a colourmap JSON object
 * Throws an error if validation fails
 */
export function validateColourmapJSON(data: unknown): asserts data is ColourmapJSON {
  if (!data || typeof data !== 'object') {
    throw new Error('Colourmap data must be an object');
  }

  const obj = data as Record<string, unknown>;

  // Validate name
  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    throw new Error('Colourmap must have a non-empty name');
  }

  // Validate stops array
  if (!Array.isArray(obj.stops) || obj.stops.length === 0) {
    throw new Error('Colourmap must have at least one stop');
  }

  // Validate each stop
  for (let i = 0; i < obj.stops.length; i++) {
    const stop = obj.stops[i];
    if (!stop || typeof stop !== 'object') {
      throw new Error(`Stop ${i} must be an object`);
    }

    const stopObj = stop as Record<string, unknown>;

    if (typeof stopObj.position !== 'number') {
      throw new Error(`Stop ${i} must have a numeric position`);
    }
    if (stopObj.position < 0 || stopObj.position > 1) {
      throw new Error(`Stop ${i} position must be between 0 and 1 (got ${stopObj.position})`);
    }

    if (!Array.isArray(stopObj.color) || stopObj.color.length !== 3) {
      throw new Error(`Stop ${i} must have a color array with 3 values`);
    }
    if (!stopObj.color.every((c) => typeof c === 'number')) {
      throw new Error(`Stop ${i} color must contain only numbers`);
    }

    // Check that stops are sorted by position
    if (i > 0) {
      const prevStop = obj.stops[i - 1] as Record<string, unknown>;
      if (stopObj.position < (prevStop.position as number)) {
        throw new Error(
          `Stops must be sorted by position (stop ${i} at ${stopObj.position} comes after stop ${i - 1} at ${prevStop.position})`
        );
      }
    }
  }

  // Validate underflow colour
  if (
    !Array.isArray(obj.underflowColour) ||
    obj.underflowColour.length !== 3 ||
    !obj.underflowColour.every((c) => typeof c === 'number')
  ) {
    throw new Error('underflowColour must be an array of 3 numbers');
  }

  // Validate overflow colour
  if (
    !Array.isArray(obj.overflowColour) ||
    obj.overflowColour.length !== 3 ||
    !obj.overflowColour.every((c) => typeof c === 'number')
  ) {
    throw new Error('overflowColour must be an array of 3 numbers');
  }

  // Validate interpolation space if present
  if (
    obj.interpolationSpace !== undefined &&
    obj.interpolationSpace !== 'rgb' &&
    obj.interpolationSpace !== 'lab'
  ) {
    throw new Error('interpolationSpace must be "rgb" or "lab" if specified');
  }
}

/**
 * Convert JSON representation to ColourmapDefinition
 */
export function colourmapJSONToDefinition(json: ColourmapJSON): ColourmapDefinition {
  return {
    name: json.name,
    stops: json.stops,
    interpolationSpace: json.interpolationSpace,
    underflowColour: json.underflowColour,
    overflowColour: json.overflowColour,
  };
}

/**
 * Load and parse a colourmap from JSON text
 */
export function parseColourmapJSON(jsonText: string): ColourmapDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Failed to parse colourmap JSON: ${err}`);
  }

  validateColourmapJSON(parsed);
  return colourmapJSONToDefinition(parsed);
}

/**
 * Load a colourmap from a JSON file URL
 * This is async and suitable for dynamic loading
 */
export async function loadColourmapJSON(url: string): Promise<ColourmapDefinition> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const jsonText = await response.text();
    return parseColourmapJSON(jsonText);
  } catch (err) {
    throw new Error(`Failed to load colourmap from ${url}: ${err}`);
  }
}

/**
 * Hydrology initialisation system
 * Handles initial water depth, salinity, and ice thickness based on elevation and user preferences
 */

export interface HydrologyInitConfig {
  waterDepth: number[]; // metres (0 = no water)
  salinity: number[]; // PSU (0 = fresh, 35 = ocean)
  iceThickness: number[]; // metres (0 = no ice)
}

/**
 * Initialise hydrology state based on elevation
 * Creates oceans in low-elevation areas, freshwater lakes at higher elevations
 */
export class HydrologyInitialiser {
  /**
   * Create oceans based on elevation threshold (seaLevel)
   * Areas below seaLevel get water with depth = seaLevel - elevation
   * Areas above seaLevel get no water
   */
  initialiseFromElevation(elevation: number[], seaLevel: number = 0): HydrologyInitConfig {
    const cellCount = elevation.length;
    const waterDepth = new Float32Array(cellCount);
    const salinity = new Float32Array(cellCount);
    const iceThickness = new Float32Array(cellCount).fill(0); // Start with no ice

    for (let i = 0; i < cellCount; i++) {
      if (elevation[i] < seaLevel) {
        // Below sea level = ocean
        // Water depth = distance from sea level down to the elevation
        waterDepth[i] = seaLevel - elevation[i];
        salinity[i] = 35; // Ocean salinity (PSU)
      } else {
        // Above sea level = land (no water)
        waterDepth[i] = 0;
        salinity[i] = 0;
      }
    }

    return {
      waterDepth: Array.from(waterDepth),
      salinity: Array.from(salinity),
      iceThickness: Array.from(iceThickness),
    };
  }

  /**
   * Create a default hydrology state (all zeros)
   * Useful for testing or completely dry planets
   */
  createEmptyHydrology(cellCount: number): HydrologyInitConfig {
    return {
      waterDepth: new Array(cellCount).fill(0),
      salinity: new Array(cellCount).fill(0),
      iceThickness: new Array(cellCount).fill(0),
    };
  }

  /**
   * Initialise from pre-computed arrays
   */
  loadFromArrays(
    waterDepth: number[],
    salinity: number[],
    iceThickness: number[]
  ): HydrologyInitConfig {
    if (waterDepth.length !== salinity.length || salinity.length !== iceThickness.length) {
      throw new Error('All hydrology arrays must have the same length');
    }

    return {
      waterDepth,
      salinity,
      iceThickness,
    };
  }
}

// =====================
// Standalone factory functions (moved from config/hydrologyConfig.ts)
// =====================

/**
 * HydrologyConfig interface - ice thickness per cell
 * @deprecated Use HydrologyInitConfig instead for full hydrology state
 */
export interface HydrologyConfig {
  iceThickness: number[];
}

/**
 * Create default hydrology state (no ice, water in liquid phase where it exists)
 */
export function createDefaultHydrology(cellCount: number): HydrologyConfig {
  return {
    iceThickness: new Array(cellCount).fill(0),
  };
}

/**
 * Initialise hydrology texture data for GPU
 * Called by TextureGridSimulation to create initial hydrology render target
 */
export function initialiseHydrologyData(cellCount: number): { iceThickness: Float32Array } {
  const iceThickness = new Float32Array(cellCount);

  for (let i = 0; i < cellCount; i++) {
    iceThickness[i] = 0; // Start with no ice
  }

  return { iceThickness };
}

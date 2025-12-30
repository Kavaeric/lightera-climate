/**
 * Hydrology configuration - water and ice state
 * Separate layer tracking water phase transitions and ice dynamics
 *
 * This layer sits between elevation (static input) and climate (dynamic output)
 * Evolution: elevation → hydrology → surface properties → climate → hydrology feedback
 */

export interface HydrologyConfig {
  // Ice thickness per cell (metres)
  // 0 = no ice, >0 = ice present
  // Max typical value: 10,000 m (Antarctica mean ~2 km)
  iceThickness: number[]
}

/**
 * Hydrology state stored in GPU texture
 * Format: RGBA = [waterDepth, iceThickness, unused, salinity]
 *
 * waterDepth: in metres (range 0-10000)
 * iceThickness: in metres (range 0-10000)
 * unused: reserved for future use
 * salinity: in PSU (practical salinity units)
 */
export interface HydrologyTextureFormat {
  r: number // waterDepth (metres)
  g: number // iceThickness (metres)
  b: number // unused
  a: number // salinity (PSU)
}

/**
 * Create default hydrology state (no ice, water in liquid phase where it exists)
 */
export function createDefaultHydrology(cellCount: number): HydrologyConfig {
  return {
    iceThickness: new Array(cellCount).fill(0),
  }
}

/**
 * Initialise hydrology texture data for GPU
 * Called by TextureGridSimulation to create initial hydrology render target
 */
export function initialiseHydrologyData(cellCount: number): { iceThickness: Float32Array } {
  const iceThickness = new Float32Array(cellCount)

  for (let i = 0; i < cellCount; i++) {
    iceThickness[i] = 0 // Start with no ice
  }

  return { iceThickness }
}

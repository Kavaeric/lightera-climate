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
 * Format: RGBA = [iceThickness, waterThermalMass, reserved1, reserved2]
 *
 * iceThickness: in metres (range 0-10000)
 * waterThermalMass: normalised thermal mass indicator (0-1)
 *   - Used to track whether surface is liquid water or ice
 *   - 1.0 = pure liquid water (C = 4186 * 1000 * depth)
 *   - 0.0 = pure ice or rock (C = 2.16e6)
 *   - Intermediate values for phase transitions
 * reserved: For future use (salinity effects, snow, etc.)
 */
export interface HydrologyTextureFormat {
  r: number // iceThickness (metres)
  g: number // waterThermalMass (0-1 normalised)
  b: number // reserved
  a: number // reserved
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
export function initializeHydrologyData(
  cellCount: number,
  waterDepth: number[]
): { iceThickness: Float32Array; waterThermalMass: Float32Array } {
  const iceThickness = new Float32Array(cellCount)
  const waterThermalMass = new Float32Array(cellCount)

  for (let i = 0; i < cellCount; i++) {
    iceThickness[i] = 0 // Start with no ice

    // If water is present, it starts in liquid phase
    // If land/rock, thermal mass = 0 (will use rock heat capacity)
    waterThermalMass[i] = waterDepth[i] > 0.01 ? 1.0 : 0.0
  }

  return { iceThickness, waterThermalMass }
}

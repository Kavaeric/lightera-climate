/**
 * Terrain configuration - geographic and surface properties per cell
 * Separated from planet and simulation configs for clear separation of concerns
 */

export interface TerrainConfig {
  // Elevation data (one value per geodesic cell) - STATIC, never changes
  elevation: number[] // metres - height above/below sea level (negative = underwater)
}

/**
 * Validate that terrain config has correct array length
 */
export function validateTerrainConfig(terrain: TerrainConfig, expectedLength: number): boolean {
  if (terrain.elevation.length !== expectedLength) return false
  return true
}

/**
 * Create a default flat terrain (all at sea level)
 * Useful for testing and as a fallback
 */
export function createDefaultTerrain(cellCount: number): TerrainConfig {
  return {
    elevation: new Array(cellCount).fill(0),
  }
}

/**
 * Create a simple procedural terrain with continents and oceans
 * Uses Perlin-like noise for natural-looking elevation
 * NOTE: Hydrology initialisation (water depth, salinity, ice) is handled separately
 */
export function createSimpleProcedural(
  cellCount: number,
  seed: number,
  cellLatLons: Array<{ lat: number; lon: number }>
): TerrainConfig {
  const elevation = new Float32Array(cellCount)

  // Perlin-like noise using value noise interpolation
  const perlin = (x: number, y: number): number => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi

    // Hash function for grid corners
    const hash = (px: number, py: number): number => {
      let h = seed + px * 73856093 ^ py * 19349663
      h = (h ^ (h >> 13)) * 1274126177
      return ((h ^ (h >> 16)) & 2147483647) / 2147483647
    }

    // Smoothstep interpolation
    const smooth = (t: number): number => t * t * (3 - 2 * t)
    const sx = smooth(xf)
    const sy = smooth(yf)

    // Sample corners
    const n00 = hash(xi, yi)
    const n10 = hash(xi + 1, yi)
    const n01 = hash(xi, yi + 1)
    const n11 = hash(xi + 1, yi + 1)

    // Interpolate
    const nx0 = n00 * (1 - sx) + n10 * sx
    const nx1 = n01 * (1 - sx) + n11 * sx
    const result = nx0 * (1 - sy) + nx1 * sy

    // Convert from [0, 1] to [-1, 1]
    return result * 2 - 1
  }

  for (let i = 0; i < cellCount; i++) {
    const { lat, lon } = cellLatLons[i]

    // Multi-octave Perlin-like noise for natural terrain
    let heightNorm = 0
    let amplitude = 1
    let frequency = 1
    let maxAmplitude = 0

    // Four octaves of noise
    for (let octave = 0; octave < 4; octave++) {
      heightNorm += perlin(lon * frequency * 0.01, lat * frequency * 0.01) * amplitude
      maxAmplitude += amplitude
      amplitude *= 0.5
      frequency *= 2
    }

    // Normalize to roughly [-1, 1]
    heightNorm /= maxAmplitude
    const maxElevation = 10000 // metres
    const minElevation = -5000 // metres (deepest ocean)

    // Map height [-1, 1] to actual elevation range
    elevation[i] = minElevation + ((heightNorm + 1) / 2) * (maxElevation - minElevation)
  }

  return {
    elevation: Array.from(elevation),
  }
}

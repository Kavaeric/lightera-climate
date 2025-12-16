/**
 * Terrain configuration - geographic and surface properties per cell
 * Separated from planet and simulation configs for clear separation of concerns
 */

export interface TerrainConfig {
  // Elevation data (one value per geodesic cell)
  elevation: number[] // meters - height above/below sea level (negative = underwater)

  // Water properties (one value per geodesic cell)
  waterDepth: number[] // meters - depth of water column (0 = land, >0 = water present)
  // Note: For oceans, total depth = max(0, -elevation) + waterDepth
  // For lakes: elevation is positive, waterDepth > 0

  salinity: number[] // PSU (Practical Salinity Units, 0-50)
  // Typical values: 0 = freshwater/lakes, 35 = ocean, 50+ = hypersaline

  // Surface properties
  baseAlbedo: number[] // 0-1 - terrain reflectivity before biome effects
  // Typical values: rock=0.15, sand=0.40, ice=0.80, water=0.06
  // This is terrain input; biome-derived albedo blends with this in Phase 3

  // Optional: Ice thickness (can be computed by climate model or supplied)
  iceThickness?: number[] // meters - ice/snow cover (0 = no ice)
}

/**
 * Validate that terrain config has correct array lengths
 */
export function validateTerrainConfig(terrain: TerrainConfig, expectedLength: number): boolean {
  if (terrain.elevation.length !== expectedLength) return false
  if (terrain.waterDepth.length !== expectedLength) return false
  if (terrain.salinity.length !== expectedLength) return false
  if (terrain.baseAlbedo.length !== expectedLength) return false
  if (terrain.iceThickness && terrain.iceThickness.length !== expectedLength) return false
  return true
}

/**
 * Create a default flat Earth-like terrain (all land, no water)
 * Useful for testing and as a fallback
 */
export function createDefaultTerrain(cellCount: number): TerrainConfig {
  return {
    elevation: new Array(cellCount).fill(0),
    waterDepth: new Array(cellCount).fill(0),
    salinity: new Array(cellCount).fill(0),
    baseAlbedo: new Array(cellCount).fill(0.3), // Earth average
  }
}

/**
 * Create a simple procedural terrain with continents and oceans
 * Uses a sine-based function for predictable, varied terrain
 * Water depth is calculated as max(0, seaLevel - elevation)
 */
export function createSimpleProcedural(
  cellCount: number,
  seed: number,
  cellLatLons: Array<{ lat: number; lon: number }>,
  seaLevel: number = 0 // meters - elevation above which is land
): TerrainConfig {
  const elevation = new Float32Array(cellCount)
  const waterDepth = new Float32Array(cellCount)
  const salinity = new Float32Array(cellCount)
  const baseAlbedo = new Float32Array(cellCount)

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
    const maxElevation = 10000 // meters
    const minElevation = -5000 // meters (deepest ocean)

    // Map height [-1, 1] to actual elevation range
    elevation[i] = minElevation + ((heightNorm + 1) / 2) * (maxElevation - minElevation)

    // Calculate water depth as difference between sea level and ground elevation
    const depth = seaLevel - elevation[i]
    waterDepth[i] = Math.max(0, depth)

    // Set albedo and salinity based on whether it's water or land
    if (waterDepth[i] > 0) {
      // Ocean or water body
      salinity[i] = 35 // Standard ocean salinity
      baseAlbedo[i] = 0.06 // Water albedo
    } else {
      // Land - default airless body albedo
      salinity[i] = 0 // No salt on land
      baseAlbedo[i] = 0.1 // Typical albedo of airless world (Moon, Mercury)
    }
  }

  return {
    elevation: Array.from(elevation),
    waterDepth: Array.from(waterDepth),
    salinity: Array.from(salinity),
    baseAlbedo: Array.from(baseAlbedo),
  }
}

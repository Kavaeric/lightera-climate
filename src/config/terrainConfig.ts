/**
 * Terrain configuration - geographic and surface properties per cell
 * Separated from planet and simulation configs for clear separation of concerns
 */

export interface TerrainConfig {
  // Elevation data (one value per geodesic cell) - STATIC, never changes
  elevation: number[] // metres - height above/below sea level (negative = underwater)
}

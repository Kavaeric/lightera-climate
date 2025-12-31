import * as THREE from 'three'

/**
 * Pure utility functions for cell coordinate conversion
 * Stateless - operates on texture dimensions and cell data
 */

/**
 * Convert cell index to 2D texture coordinates
 */
export function indexTo2D(
  index: number,
  textureWidth: number
): { x: number; y: number } {
  return {
    x: index % textureWidth,
    y: Math.floor(index / textureWidth),
  }
}

/**
 * Convert 2D coordinates to linear data array index
 */
export function coordsToDataIndex(
  x: number,
  y: number,
  textureWidth: number,
  channels: number
): number {
  return (y * textureWidth + x) * channels
}

/**
 * Get UV coordinates for a given cell index (returns [u, v])
 */
export function getCellUV(
  cellIndex: number,
  textureWidth: number,
  textureHeight: number
): [number, number] {
  const coords = indexTo2D(cellIndex, textureWidth)
  return [
    (coords.x + 0.5) / textureWidth,
    (coords.y + 0.5) / textureHeight,
  ]
}

/**
 * Calculate texture dimensions for a given cell count
 * Returns power-of-2 dimensions for optimal GPU performance
 */
export function calculateTextureDimensions(cellCount: number): {
  width: number
  height: number
} {
  const sqrtCells = Math.sqrt(cellCount)
  const baseWidth = Math.ceil(sqrtCells)
  const width = Math.pow(2, Math.ceil(Math.log2(baseWidth)))
  let height = Math.ceil(cellCount / width)
  height = Math.pow(2, Math.ceil(Math.log2(height)))
  return { width, height }
}

/**
 * Create common texture settings for data textures
 */
export function createDataTextureSettings(): Partial<THREE.DataTexture> {
  return {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  }
}

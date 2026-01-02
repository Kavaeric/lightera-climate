import * as THREE from 'three';

/**
 * Pure utility functions for cell coordinate conversion
 * Stateless - operates on texture dimensions and cell data
 */

// =====================================================
// Primary API: UV <-> Cell Index conversion
// =====================================================

/**
 * Converts a cell index to UV coordinates.
 * Returns [u, v] coordinates in the range [0, 1].
 * UV coordinates point to the center of each cell in the texture grid.
 *
 * @param cellIndex - Linear cell index
 * @param textureWidth - Width of the texture grid
 * @param textureHeight - Height of the texture grid
 * @returns [u, v] coordinates in range [0, 1]
 */
export function cellIndexToUV(
  cellIndex: number,
  textureWidth: number,
  textureHeight: number
): [number, number] {
  const x = cellIndex % textureWidth;
  const y = Math.floor(cellIndex / textureWidth);
  return [(x + 0.5) / textureWidth, (y + 0.5) / textureHeight];
}

/**
 * Converts UV coordinates to cell index (reverse of cellIndexToUV).
 *
 * @param u - U coordinate (0-1 range)
 * @param v - V coordinate (0-1 range)
 * @param textureWidth - Width of the texture grid
 * @param textureHeight - Height of the texture grid
 * @returns Cell index, or -1 if UV is out of bounds
 */
export function uvToCellIndex(
  u: number,
  v: number,
  textureWidth: number,
  textureHeight: number
): number {
  const x = Math.floor(u * textureWidth);
  const y = Math.floor(v * textureHeight);

  // Validate bounds (UV should be in [0, 1] range)
  if (x < 0 || x >= textureWidth || y < 0 || y >= textureHeight) {
    return -1;
  }

  return y * textureWidth + x;
}

// =====================================================
// Lower-level utilities (used internally)
// =====================================================

/**
 * Converts a linear cell index to 2D texture coordinates.
 */
export function indexTo2D(index: number, textureWidth: number): { x: number; y: number } {
  return {
    x: index % textureWidth,
    y: Math.floor(index / textureWidth),
  };
}

/**
 * Converts 2D texture coordinates to a linear data array index.
 * Used when accessing raw pixel data arrays (e.g., RGBA channels).
 */
export function coordsToDataIndex(
  x: number,
  y: number,
  textureWidth: number,
  channels: number
): number {
  return (y * textureWidth + x) * channels;
}

// =====================================================
// Legacy aliases (for backwards compatibility)
// =====================================================

/**
 * @deprecated Use cellIndexToUV instead
 */
export function getCellUV(
  cellIndex: number,
  textureWidth: number,
  textureHeight: number
): [number, number] {
  return cellIndexToUV(cellIndex, textureWidth, textureHeight);
}

/**
 * Calculates texture dimensions for a given cell count.
 * Returns power-of-2 dimensions for optimal GPU performance.
 */
export function calculateTextureDimensions(cellCount: number): {
  width: number;
  height: number;
} {
  const sqrtCells = Math.sqrt(cellCount);
  const baseWidth = Math.ceil(sqrtCells);
  const width = Math.pow(2, Math.ceil(Math.log2(baseWidth)));
  let height = Math.ceil(cellCount / width);
  height = Math.pow(2, Math.ceil(Math.log2(height)));
  return { width, height };
}

/**
 * Creates common texture settings for data textures.
 */
export function createDataTextureSettings(): Partial<THREE.DataTexture> {
  return {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  };
}

import * as THREE from 'three'
import type { TerrainConfig } from '../../../config/terrainConfig'
import { DEPTH_QUANTUM } from '../../../config/simulationConfig'
import { indexTo2D, coordsToDataIndex } from '../grid/CellAccessors'

/**
 * Manages static terrain data texture (elevation)
 * Created once, updated when terrain is loaded
 */
export class TerrainTextureManager {
  private textureWidth: number
  private textureHeight: number
  private cellCount: number

  // Terrain data (static, doesn't change per time sample)
  public terrainData: THREE.DataTexture // RGBA = [elevation, reserved, reserved, reserved]

  constructor(textureWidth: number, textureHeight: number, cellCount: number) {
    this.textureWidth = textureWidth
    this.textureHeight = textureHeight
    this.cellCount = cellCount

    // Create terrain data texture (initialised with defaults)
    this.terrainData = this.createDefaultTerrainTexture()
  }

  /**
   * Create default terrain texture (flat land, elevation only)
   */
  private createDefaultTerrainTexture(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * this.textureHeight * 4) // RGBA

    // Initialise with defaults: elevation=0, rest reserved
    for (let i = 0; i < this.cellCount; i++) {
      const coords = indexTo2D(i, this.textureWidth)
      const dataIndex = coordsToDataIndex(coords.x, coords.y, this.textureWidth, 4)

      data[dataIndex + 0] = 0 // R = elevation (metres)
      data[dataIndex + 1] = 0 // G = reserved
      data[dataIndex + 2] = 0 // B = reserved
      data[dataIndex + 3] = 0 // A = reserved
    }

    const texture = new THREE.DataTexture(
      data,
      this.textureWidth,
      this.textureHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    )
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
    return texture
  }

  /**
   * Update terrain data from a TerrainConfig (elevation only)
   */
  setTerrainData(terrain: TerrainConfig): void {
    if (terrain.elevation.length !== this.cellCount) {
      console.error(
        `Terrain config has ${terrain.elevation.length} cells but simulation has ${this.cellCount} cells`
      )
      return
    }

    const data = this.terrainData.image.data as Float32Array

    for (let i = 0; i < this.cellCount; i++) {
      const coords = indexTo2D(i, this.textureWidth)
      const dataIndex = coordsToDataIndex(coords.x, coords.y, this.textureWidth, 4)

      // Quantise elevation to 0.1m increments to match water/ice depths
      const quantisedElevation = Math.round(terrain.elevation[i] / DEPTH_QUANTUM) * DEPTH_QUANTUM

      data[dataIndex + 0] = quantisedElevation // R = elevation (quantised)
      data[dataIndex + 1] = 0 // G = reserved
      data[dataIndex + 2] = 0 // B = reserved
      data[dataIndex + 3] = 0 // A = reserved
    }

    this.terrainData.needsUpdate = true
  }

  /**
   * Read back terrain data (elevation) for a specific cell
   * Note: Terrain data is static and stored in a DataTexture, not a render target
   */
  getTerrainDataForCell(cellIndex: number): { elevation: number } {
    const coords = indexTo2D(cellIndex, this.textureWidth)
    const dataIndex = coordsToDataIndex(coords.x, coords.y, this.textureWidth, 4)
    const data = this.terrainData.image.data as Float32Array

    return {
      elevation: data[dataIndex + 0], // R channel = elevation (metres)
    }
  }

  dispose(): void {
    this.terrainData.dispose()
  }
}

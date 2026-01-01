import * as THREE from 'three'
import { Grid, GridCell } from '../../geometry/geodesic'
import {
  indexTo2D,
  coordsToDataIndex,
  calculateTextureDimensions,
  getCellUV,
} from './CellAccessors'

/**
 * Manages static grid topology data (neighbours, cell positions)
 * Created once during simulation setup, never changes after
 */
export class GridTextureManager {
  private grid: Grid
  private cells: GridCell[]
  private cellCount: number
  private textureWidth: number
  private textureHeight: number

  // Neighbour lookup textures (for heat transport calculations)
  public neighbourIndices1: THREE.DataTexture // stores neighbours 0,1,2
  public neighbourIndices2: THREE.DataTexture // stores neighbours 3,4,5
  public neighbourCounts: THREE.DataTexture // stores how many neighbours (5 or 6)

  // Cell position data (lat/lon in degrees, surface area in m²)
  public cellInformation: THREE.DataTexture // RGBA = [latitude, longitude, surfaceArea, reserved]

  constructor(resolution: number) {
    this.grid = new Grid(resolution)
    this.cells = Array.from(this.grid)
    this.cellCount = this.cells.length

    const dims = calculateTextureDimensions(this.cellCount)
    this.textureWidth = dims.width
    this.textureHeight = dims.height

    // Create neighbour lookup textures
    this.neighbourIndices1 = this.createNeighbourTexture1()
    this.neighbourIndices2 = this.createNeighbourTexture2()
    this.neighbourCounts = this.createNeighbourCountTexture()

    // Create cell position texture
    this.cellInformation = this.createCellInformationTexture()
  }

  /**
   * Create neighbour indices texture 1 (stores neighbours 0, 1, 2)
   */
  private createNeighbourTexture1(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * this.textureHeight * 4) // RGBA

    // Build lookup map for O(1) cell index lookups
    const cellToIndex = new Map<GridCell, number>()
    for (let i = 0; i < this.cellCount; i++) {
      cellToIndex.set(this.cells[i], i)
    }

    for (let i = 0; i < this.cellCount; i++) {
      const cell = this.cells[i]
      const neighbourCells = cell.neighbours(this.grid)

      // Find indices of neighbours in the cells array
      const neighbourIndices = neighbourCells.map((neighbourCell: GridCell) =>
        cellToIndex.get(neighbourCell) ?? -1
      )

      // Convert cell index to 2D coordinates
      const coords = indexTo2D(i, this.textureWidth)
      const dataIndex = coordsToDataIndex(coords.x, coords.y, this.textureWidth, 4)

      // Store first 3 neighbours as RGB (A channel unused)
      data[dataIndex + 0] = neighbourIndices[0] ?? -1 // R = neighbour 0
      data[dataIndex + 1] = neighbourIndices[1] ?? -1 // G = neighbour 1
      data[dataIndex + 2] = neighbourIndices[2] ?? -1 // B = neighbour 2
      data[dataIndex + 3] = 0.0 // A = unused
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
   * Create neighbour indices texture 2 (stores neighbours 3, 4, 5)
   */
  private createNeighbourTexture2(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * this.textureHeight * 4) // RGBA

    // Build lookup map for O(1) cell index lookups
    const cellToIndex = new Map<GridCell, number>()
    for (let i = 0; i < this.cellCount; i++) {
      cellToIndex.set(this.cells[i], i)
    }

    for (let i = 0; i < this.cellCount; i++) {
      const cell = this.cells[i]
      const neighbourCells = cell.neighbours(this.grid)

      // Find indices of neighbours in the cells array
      const neighbourIndices = neighbourCells.map((neighbourCell: GridCell) =>
        cellToIndex.get(neighbourCell) ?? -1
      )

      // Convert cell index to 2D coordinates
      const coords = indexTo2D(i, this.textureWidth)
      const dataIndex = coordsToDataIndex(coords.x, coords.y, this.textureWidth, 4)

      // Store next 3 neighbours as RGB (A channel unused)
      data[dataIndex + 0] = neighbourIndices[3] ?? -1 // R = neighbour 3
      data[dataIndex + 1] = neighbourIndices[4] ?? -1 // G = neighbour 4
      data[dataIndex + 2] = neighbourIndices[5] ?? -1 // B = neighbour 5
      data[dataIndex + 3] = 0.0 // A = unused
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
   * Create neighbour count texture (stores how many neighbours each cell has)
   */
  private createNeighbourCountTexture(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * this.textureHeight) // Single channel

    for (let i = 0; i < this.cellCount; i++) {
      const cell = this.cells[i]
      const neighbourCells = cell.neighbours(this.grid)
      const coords = indexTo2D(i, this.textureWidth)
      const dataIndex = coordsToDataIndex(coords.x, coords.y, this.textureWidth, 1)
      data[dataIndex] = neighbourCells.length
    }

    const texture = new THREE.DataTexture(
      data,
      this.textureWidth,
      this.textureHeight,
      THREE.RedFormat,
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
   * Create cell position texture (stores lat/lon and surface area for each cell)
   */
  private createCellInformationTexture(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * this.textureHeight * 4) // RGBA

    for (let i = 0; i < this.cellCount; i++) {
      const cell = this.cells[i]
      const coords = indexTo2D(i, this.textureWidth)
      const dataIndex = coordsToDataIndex(coords.x, coords.y, this.textureWidth, 4)

      data[dataIndex + 0] = cell.latLon.lat // R = latitude (degrees)
      data[dataIndex + 1] = cell.latLon.lon // G = longitude (degrees)
      data[dataIndex + 2] = cell.area // B = surface area (m²)
      data[dataIndex + 3] = 0.0 // A = reserved
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

  // Accessors
  getTextureWidth(): number {
    return this.textureWidth
  }

  getTextureHeight(): number {
    return this.textureHeight
  }

  getCellCount(): number {
    return this.cellCount
  }

  /**
   * Get UV coordinates for a given cell index
   */
  getCellUV(cellIndex: number): [number, number] {
    return getCellUV(cellIndex, this.textureWidth, this.textureHeight)
  }

  /**
   * Get latitude and longitude for a specific cell
   */
  getCellLatLon(cellIndex: number): { lat: number; lon: number } {
    if (cellIndex < 0 || cellIndex >= this.cellCount) {
      return { lat: 0, lon: 0 }
    }
    const cell = this.cells[cellIndex]
    return { lat: cell.latLon.lat, lon: cell.latLon.lon }
  }

  /**
   * Get surface area for a specific cell (in m²)
   */
  getCellArea(cellIndex: number): number {
    if (cellIndex < 0 || cellIndex >= this.cellCount) {
      return 0
    }
    const cell = this.cells[cellIndex]
    return cell.area
  }

  dispose(): void {
    this.neighbourIndices1.dispose()
    this.neighbourIndices2.dispose()
    this.neighbourCounts.dispose()
    this.cellInformation.dispose()
  }
}

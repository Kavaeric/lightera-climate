import * as THREE from 'three'
import { Grid, GridCell } from '../simulation/geometry/geodesic'
import type { SimulationConfig } from '../config/simulationConfig'

/**
 * Climate simulation for a geodesic grid sphere
 * Stores climate data (temperature, etc.) over time for each cell
 */
export class TextureGridSimulation {
  private grid: Grid
  private cells: GridCell[]
  private cellCount: number
  private textureWidth: number
  private textureHeight: number

  // Number of time samples (e.g., 365 for daily averages over a year)
  private timeSamples: number

  // Neighbour lookup textures (for future heat transport calculations)
  public neighbourIndices1: THREE.DataTexture // stores neighbours 0,1,2
  public neighbourIndices2: THREE.DataTexture // stores neighbours 3,4,5
  public neighbourCounts: THREE.DataTexture // stores how many neighbours (5 or 6)

  // Cell position data (lat/lon in degrees)
  public cellPositions: THREE.DataTexture // RG = [latitude, longitude] in degrees

  // Climate data storage: array of render targets, one per time sample
  // Each render target RGBA = [temperature, humidity, pressure, unused]
  public climateDataTargets: THREE.WebGLRenderTarget[]

  constructor(config: SimulationConfig) {
    this.grid = new Grid(config.resolution)
    this.cells = Array.from(this.grid)
    this.cellCount = this.cells.length
    this.timeSamples = config.timeSamples

    // Calculate 2D texture dimensions (square or near-square, power-of-2)
    const sqrtCells = Math.sqrt(this.cellCount)
    const baseWidth = Math.ceil(sqrtCells)
    this.textureWidth = Math.pow(2, Math.ceil(Math.log2(baseWidth)))
    this.textureHeight = Math.ceil(this.cellCount / this.textureWidth)
    this.textureHeight = Math.pow(2, Math.ceil(Math.log2(this.textureHeight)))

    const totalMemoryMB = (this.textureWidth * this.textureHeight * this.timeSamples * 4 * 4) / (1024 * 1024)
    console.log(
      `TextureGridSimulation: ${this.cellCount} cells, ${this.timeSamples} time samples`
    )
    console.log(
      `Texture size: ${this.textureWidth}x${this.textureHeight}, Total memory: ${totalMemoryMB.toFixed(1)}MB`
    )

    // Create neighbour lookup textures
    this.neighbourIndices1 = this.createneighbourTexture1()
    this.neighbourIndices2 = this.createneighbourTexture2()
    this.neighbourCounts = this.createNeighbourCountTexture()

    // Create cell position texture
    this.cellPositions = this.createCellPositionTexture()

    // Create climate data storage (one render target per time sample)
    this.climateDataTargets = []
    for (let i = 0; i < this.timeSamples; i++) {
      this.climateDataTargets.push(this.createRenderTarget())
    }
  }

  /**
   * Convert cell index to 2D texture coordinates
   */
  private indexTo2D(index: number): { x: number; y: number } {
    return {
      x: index % this.textureWidth,
      y: Math.floor(index / this.textureWidth),
    }
  }

  /**
   * Convert 2D coordinates to linear data array index
   */
  private coordsToDataIndex(x: number, y: number, channels: number): number {
    return (y * this.textureWidth + x) * channels
  }


  /**
   * Create neighbour indices texture 1 (stores neighbours 0, 1, 2)
   */
  private createneighbourTexture1(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * this.textureHeight * 3) // RGB

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
      const coords = this.indexTo2D(i)
      const dataIndex = this.coordsToDataIndex(coords.x, coords.y, 3)

      // Store first 3 neighbours as RGB
      data[dataIndex + 0] = neighbourIndices[0] ?? -1 // R = neighbour 0
      data[dataIndex + 1] = neighbourIndices[1] ?? -1 // G = neighbour 1
      data[dataIndex + 2] = neighbourIndices[2] ?? -1 // B = neighbour 2
    }

    const texture = new THREE.DataTexture(
      data,
      this.textureWidth,
      this.textureHeight,
      THREE.RGBFormat,
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
  private createneighbourTexture2(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * this.textureHeight * 3) // RGB

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
      const coords = this.indexTo2D(i)
      const dataIndex = this.coordsToDataIndex(coords.x, coords.y, 3)

      // Store next 3 neighbours as RGB
      data[dataIndex + 0] = neighbourIndices[3] ?? -1 // R = neighbour 3
      data[dataIndex + 1] = neighbourIndices[4] ?? -1 // G = neighbour 4
      data[dataIndex + 2] = neighbourIndices[5] ?? -1 // B = neighbour 5
    }

    const texture = new THREE.DataTexture(
      data,
      this.textureWidth,
      this.textureHeight,
      THREE.RGBFormat,
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
      const coords = this.indexTo2D(i)
      const dataIndex = this.coordsToDataIndex(coords.x, coords.y, 1)
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
   * Create cell position texture (stores lat/lon for each cell)
   */
  private createCellPositionTexture(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * this.textureHeight * 2) // RG

    for (let i = 0; i < this.cellCount; i++) {
      const cell = this.cells[i]
      const coords = this.indexTo2D(i)
      const dataIndex = this.coordsToDataIndex(coords.x, coords.y, 2)

      data[dataIndex + 0] = cell.latLon.lat // R = latitude (degrees)
      data[dataIndex + 1] = cell.latLon.lon // G = longitude (degrees)
    }

    const texture = new THREE.DataTexture(
      data,
      this.textureWidth,
      this.textureHeight,
      THREE.RGFormat,
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
   * Create a render target for GPU computation
   */
  private createRenderTarget(): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(this.textureWidth, this.textureHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    })
  }

  /**
   * Get a specific climate data render target by time sample index
   */
  getClimateDataTarget(timeSampleIndex: number): THREE.WebGLRenderTarget {
    return this.climateDataTargets[timeSampleIndex]
  }

  /**
   * Get the number of time samples
   */
  getTimeSamples(): number {
    return this.timeSamples
  }

  /**
   * Get texture width
   */
  getTextureWidth(): number {
    return this.textureWidth
  }

  /**
   * Get texture height
   */
  getTextureHeight(): number {
    return this.textureHeight
  }

  /**
   * Get cell count
   */
  getCellCount(): number {
    return this.cellCount
  }

  /**
   * Get UV coordinates for a given cell index (returns [u, v])
   */
  getCellUV(cellIndex: number): [number, number] {
    const coords = this.indexTo2D(cellIndex)
    return [
      (coords.x + 0.5) / this.textureWidth,
      (coords.y + 0.5) / this.textureHeight,
    ]
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
   * Read back temperature value from GPU for a specific cell and time sample
   */
  async getTemperature(
    cellIndex: number,
    timeSampleIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<number> {
    const buffer = new Float32Array(4)
    const target = this.climateDataTargets[timeSampleIndex]
    const coords = this.indexTo2D(cellIndex)

    // Read a single pixel
    renderer.readRenderTargetPixels(target, coords.x, coords.y, 1, 1, buffer)

    return buffer[0] // R channel = temperature
  }

  /**
   * Read back all climate data for a specific cell across all time samples
   */
  async getClimateDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<Array<{ temperature: number; humidity: number; pressure: number }>> {
    const coords = this.indexTo2D(cellIndex)
    const buffer = new Float32Array(4)
    const results: Array<{ temperature: number; humidity: number; pressure: number }> = []

    for (let i = 0; i < this.timeSamples; i++) {
      const target = this.climateDataTargets[i]
      renderer.readRenderTargetPixels(target, coords.x, coords.y, 1, 1, buffer)
      results.push({
        temperature: buffer[0],
        humidity: buffer[1],
        pressure: buffer[2],
      })
    }

    return results
  }

  dispose() {
    this.neighbourIndices1.dispose()
    this.neighbourIndices2.dispose()
    this.neighbourCounts.dispose()
    this.cellPositions.dispose()
    for (const target of this.climateDataTargets) {
      target.dispose()
    }
  }
}

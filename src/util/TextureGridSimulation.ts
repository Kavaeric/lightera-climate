import * as THREE from 'three'
import { Grid, GridCell } from '../simulation/geometry/geodesic'
import type { SimulationConfig } from '../config/simulationConfig'
import type { TerrainConfig } from '../config/terrainConfig'

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

  // Terrain data (static, doesn't change per time sample)
  public terrainData: THREE.DataTexture // RGBA = [elevation, waterDepth, salinity, baseAlbedo]

  // Hydrology data storage: TWO render targets (current and next frame)
  // Tracks ice and water phase transitions independently of climate
  // Each render target RGBA = [iceThickness, waterThermalMass, waterDepth, reserved]
  public hydrologyDataTargets: THREE.WebGLRenderTarget[]

  // Hydrology data archive: array of render targets, one per time sample
  // Captures hydrology state at each time sample for visualisation and analysis
  // Each render target RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
  public hydrologyArchive: THREE.WebGLRenderTarget[]

  // Hydrology initialisation data (temporary storage for setHydrologyData)
  private hydrologyInitData: { waterDepth: number[]; salinity: number[]; iceThickness: number[] } | null = null

  // Surface data storage: TWO render targets (current and next frame)
  // Computes surface properties from terrain + hydrology (albedo, etc)
  // Each render target RGBA = [effectiveAlbedo, reserved, reserved, reserved]
  public surfaceDataTargets: THREE.WebGLRenderTarget[]

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

    // Create terrain data texture (initialised with defaults)
    this.terrainData = this.createDefaultTerrainTexture()

    // Create hydrology data storage (two render targets: current and next frame)
    this.hydrologyDataTargets = [this.createRenderTarget(), this.createRenderTarget()]
    this.initializeHydrologyTargets()

    // Create hydrology archive (one render target per time sample for visualisation)
    this.hydrologyArchive = []
    for (let i = 0; i < this.timeSamples; i++) {
      this.hydrologyArchive.push(this.createRenderTarget())
    }

    // Create surface data storage (two render targets: current and next frame)
    this.surfaceDataTargets = [this.createRenderTarget(), this.createRenderTarget()]

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
   * Create default terrain texture (flat land, elevation only)
   */
  private createDefaultTerrainTexture(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * this.textureHeight * 4) // RGBA

      // Initialise with defaults: elevation=0, rest reserved
    for (let i = 0; i < this.cellCount; i++) {
      const coords = this.indexTo2D(i)
      const dataIndex = this.coordsToDataIndex(coords.x, coords.y, 4)

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
  public setTerrainData(terrain: TerrainConfig): void {
    if (terrain.elevation.length !== this.cellCount) {
      console.error(
        `Terrain config has ${terrain.elevation.length} cells but simulation has ${this.cellCount} cells`
      )
      return
    }

    const data = this.terrainData.image.data as Float32Array

    for (let i = 0; i < this.cellCount; i++) {
      const coords = this.indexTo2D(i)
      const dataIndex = this.coordsToDataIndex(coords.x, coords.y, 4)

      data[dataIndex + 0] = terrain.elevation[i] // R = elevation
      data[dataIndex + 1] = 0 // G = reserved
      data[dataIndex + 2] = 0 // B = reserved
      data[dataIndex + 3] = 0 // A = reserved
    }

    this.terrainData.needsUpdate = true
  }

  /**
   * Initialise hydrology render targets with default values
   * Called during construction to set up initial ice/water state
   * The actual initialisation happens when the shader first runs
   */
  private initializeHydrologyTargets(): void {
    // Hydrology targets start cleared to [0, 0, 0, 0] by WebGL
    // They will be properly initialised by setHydrologyData when terrain is loaded
  }

  /**
   * Set initial hydrology state (water depth, salinity, ice thickness)
   * Stores the initialisation data for later use by the simulation engine
   */
  public setHydrologyData(
    waterDepth: number[],
    salinity: number[],
    iceThickness: number[]
  ): void {
    if (
      waterDepth.length !== this.cellCount ||
      salinity.length !== this.cellCount ||
      iceThickness.length !== this.cellCount
    ) {
      console.error(
        `Hydrology config has mismatched cell counts but simulation has ${this.cellCount} cells`
      )
      return
    }

    // Store initialisation data for use during simulation
    this.hydrologyInitData = { waterDepth, salinity, iceThickness }
  }

  /**
   * Create the initial hydrology data texture
   * Called by ClimateSimulationEngine to initialise render targets
   */
  public createInitialHydrologyTexture(): THREE.DataTexture {
    const { waterDepth, salinity, iceThickness } = this.hydrologyInitData || {
      waterDepth: new Array(this.cellCount).fill(0),
      salinity: new Array(this.cellCount).fill(0),
      iceThickness: new Array(this.cellCount).fill(0),
    }

    // Create hydrology data texture
    // RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
    const hydrologyData = new Float32Array(this.textureWidth * this.textureHeight * 4)
    for (let i = 0; i < this.cellCount; i++) {
      const coords = this.indexTo2D(i)
      const dataIndex = this.coordsToDataIndex(coords.x, coords.y, 4)
      hydrologyData[dataIndex + 0] = iceThickness[i]      // R = iceThickness
      hydrologyData[dataIndex + 1] = 0                    // G = waterThermalMass (start at 0)
      hydrologyData[dataIndex + 2] = waterDepth[i]        // B = waterDepth
      hydrologyData[dataIndex + 3] = salinity[i]          // A = salinity
    }

    const hydrologyTexture = new THREE.DataTexture(
      hydrologyData,
      this.textureWidth,
      this.textureHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    )
    hydrologyTexture.minFilter = THREE.NearestFilter
    hydrologyTexture.magFilter = THREE.NearestFilter
    hydrologyTexture.wrapS = THREE.ClampToEdgeWrapping
    hydrologyTexture.wrapT = THREE.ClampToEdgeWrapping
    hydrologyTexture.needsUpdate = true

    return hydrologyTexture
  }

  /**
   * Get hydrology initialisation data (for shader initialisation)
   */
  public getHydrologyInitData(): { waterDepth: number[]; salinity: number[]; iceThickness: number[] } | null {
    return this.hydrologyInitData
  }

  /**
   * Get the current hydrology render target (for reading in shaders)
   */
  public getHydrologyDataCurrent(): THREE.WebGLRenderTarget {
    return this.hydrologyDataTargets[0]
  }

  /**
   * Get the next hydrology render target (for writing in shaders)
   */
  public getHydrologyDataNext(): THREE.WebGLRenderTarget {
    return this.hydrologyDataTargets[1]
  }

  /**
   * Swap hydrology buffers for next frame
   */
  public swapHydrologyBuffers(): void {
    const temp = this.hydrologyDataTargets[0]
    this.hydrologyDataTargets[0] = this.hydrologyDataTargets[1]
    this.hydrologyDataTargets[1] = temp
  }

  /**
   * Get the current surface render target (for reading in shaders)
   */
  public getSurfaceDataCurrent(): THREE.WebGLRenderTarget {
    return this.surfaceDataTargets[0]
  }

  /**
   * Get the next surface render target (for writing in shaders)
   */
  public getSurfaceDataNext(): THREE.WebGLRenderTarget {
    return this.surfaceDataTargets[1]
  }

  /**
   * Swap surface buffers for next frame
   */
  public swapSurfaceBuffers(): void {
    const temp = this.surfaceDataTargets[0]
    this.surfaceDataTargets[0] = this.surfaceDataTargets[1]
    this.surfaceDataTargets[1] = temp
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
   * Get a specific hydrology archive render target by time sample index
   */
  getHydrologyArchiveTarget(timeSampleIndex: number): THREE.WebGLRenderTarget {
    return this.hydrologyArchive[timeSampleIndex]
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

  /**
   * Fetch hydrology data (water depth, ice thickness, salinity) for a specific cell across all time samples
   */
  async getHydrologyDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<Array<{ waterDepth: number; iceThickness: number; salinity: number }>> {
    const coords = this.indexTo2D(cellIndex)
    const buffer = new Float32Array(4)
    const results: Array<{ waterDepth: number; iceThickness: number; salinity: number }> = []

    for (let i = 0; i < this.timeSamples; i++) {
      const target = this.hydrologyArchive[i]
      renderer.readRenderTargetPixels(target, coords.x, coords.y, 1, 1, buffer)
      results.push({
        iceThickness: buffer[0],       // R channel
        waterDepth: buffer[2],         // B channel
        salinity: buffer[3],           // A channel
      })
    }

    return results
  }

  dispose() {
    this.neighbourIndices1.dispose()
    this.neighbourIndices2.dispose()
    this.neighbourCounts.dispose()
    this.cellPositions.dispose()
    this.terrainData.dispose()
    for (const target of this.hydrologyDataTargets) {
      target.dispose()
    }
    for (const target of this.hydrologyArchive) {
      target.dispose()
    }
    for (const target of this.surfaceDataTargets) {
      target.dispose()
    }
    for (const target of this.climateDataTargets) {
      target.dispose()
    }
  }
}

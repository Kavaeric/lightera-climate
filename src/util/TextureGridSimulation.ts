import * as THREE from 'three'
import { Grid, GridCell } from '../simulation/geometry/geodesic'
import type { SimulationConfig } from '../config/simulationConfig'
import { DEPTH_QUANTUM } from '../config/simulationConfig'
import type { TerrainConfig } from '../config/terrainConfig'

/**
 * Climate simulation for a geodesic grid sphere
 * Stores climate data (surface temperature, etc.) over time for each cell
 */
export class TextureGridSimulation {
  private grid: Grid
  private cells: GridCell[]
  private cellCount: number
  private textureWidth: number
  private textureHeight: number

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
  // Each render target RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
  public hydrologyDataTargets: THREE.WebGLRenderTarget[]

  // Hydrology initialisation data (temporary storage for setHydrologyData)
  private hydrologyInitData: { waterDepth: number[]; salinity: number[]; iceThickness: number[] } | null = null

  // Surface data storage: TWO render targets (current and next frame)
  // Stores surface temperature and albedo together
  // Each render target RGBA = [surfaceTemperature, albedo, reserved, reserved]
  public climateDataTargets: THREE.WebGLRenderTarget[]

  // Atmosphere data storage: TWO render targets (current and next frame)
  // Stores atmospheric temperature
  // Each render target RGBA = [atmosphereTemperature, reserved, reserved, reserved]
  public atmosphereDataTargets: THREE.WebGLRenderTarget[]

  constructor(config: SimulationConfig) {
    this.grid = new Grid(config.resolution)
    this.cells = Array.from(this.grid)
    this.cellCount = this.cells.length

    // Calculate 2D texture dimensions (square or near-square, power-of-2)
    const sqrtCells = Math.sqrt(this.cellCount)
    const baseWidth = Math.ceil(sqrtCells)
    this.textureWidth = Math.pow(2, Math.ceil(Math.log2(baseWidth)))
    this.textureHeight = Math.ceil(this.cellCount / this.textureWidth)
    this.textureHeight = Math.pow(2, Math.ceil(Math.log2(this.textureHeight)))

    // Memory usage: 2 pairs of ping-pong buffers (hydrology, surface/climate)
    const totalMemoryMB = (this.textureWidth * this.textureHeight * 4 * 4 * 4) / (1024 * 1024)
    console.log(
      `TextureGridSimulation: ${this.cellCount} cells`
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
    this.initialiseHydrologyTargets()

    // Create surface/climate data storage (two render targets: current and next frame)
    // Stores both surface temperature and albedo: RGBA = [surfaceTemperature, albedo, reserved, reserved]
    this.climateDataTargets = [this.createRenderTarget(), this.createRenderTarget()]

    // Create atmosphere data storage (two render targets: current and next frame)
    // Stores atmospheric temperature: RGBA = [atmosphereTemperature, reserved, reserved, reserved]
    this.atmosphereDataTargets = [this.createRenderTarget(), this.createRenderTarget()]
    this.initialiseAtmosphereTargets()
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
   * Initialise hydrology render targets with default values
   * Called during construction to set up initial ice/water state
   * The actual initialisation happens when the shader first runs
   */
  private initialiseHydrologyTargets(): void {
    // Hydrology targets start cleared to [0, 0, 0, 0] by WebGL
    // They will be properly initialised by setHydrologyData when terrain is loaded
  }

  /**
   * Initialise atmosphere render targets with default values
   * Called during construction to set up initial atmospheric temperature
   * Uses Earth-like baseline: ~288K (15°C)
   */
  private initialiseAtmosphereTargets(): void {
    // Atmosphere targets will be properly initialised by ClimateSimulationEngine
    // when it sets up the atmosphere shader material
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

      // Quantise water and ice depths to 0.1m increments
      const quantisedIce = Math.round(iceThickness[i] / DEPTH_QUANTUM) * DEPTH_QUANTUM
      const quantisedWater = Math.round(waterDepth[i] / DEPTH_QUANTUM) * DEPTH_QUANTUM

      hydrologyData[dataIndex + 0] = quantisedIce        // R = iceThickness (quantised)
      hydrologyData[dataIndex + 1] = 0                    // G = waterThermalMass (start at 0)
      hydrologyData[dataIndex + 2] = quantisedWater      // B = waterDepth (quantised)
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
   * Alias for getClimateDataCurrent() - surface and climate data are now combined
   */
  public getSurfaceDataCurrent(): THREE.WebGLRenderTarget {
    return this.getClimateDataCurrent()
  }

  /**
   * Get the next surface render target (for writing in shaders)
   * Alias for getClimateDataNext() - surface and climate data are now combined
   */
  public getSurfaceDataNext(): THREE.WebGLRenderTarget {
    return this.getClimateDataNext()
  }

  /**
   * Swap surface buffers for next frame
   * Alias for swapClimateBuffers() - surface and climate data are now combined
   */
  public swapSurfaceBuffers(): void {
    this.swapClimateBuffers()
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
   * Get the current surface/climate render target (for reading in shaders)
   * Format: RGBA = [surfaceTemperature, albedo, reserved, reserved]
   */
  public getClimateDataCurrent(): THREE.WebGLRenderTarget {
    return this.climateDataTargets[0]
  }

  /**
   * Get the next surface/climate render target (for writing in shaders)
   * Format: RGBA = [surfaceTemperature, albedo, reserved, reserved]
   */
  public getClimateDataNext(): THREE.WebGLRenderTarget {
    return this.climateDataTargets[1]
  }

  /**
   * Swap surface/climate buffers for next frame
   */
  public swapClimateBuffers(): void {
    const temp = this.climateDataTargets[0]
    this.climateDataTargets[0] = this.climateDataTargets[1]
    this.climateDataTargets[1] = temp
  }

  /**
   * Get the current atmosphere render target (for reading in shaders)
   * Format: RGBA = [atmosphereTemperature, reserved, reserved, reserved]
   */
  public getAtmosphereDataCurrent(): THREE.WebGLRenderTarget {
    return this.atmosphereDataTargets[0]
  }

  /**
   * Get the next atmosphere render target (for writing in shaders)
   * Format: RGBA = [atmosphereTemperature, reserved, reserved, reserved]
   */
  public getAtmosphereDataNext(): THREE.WebGLRenderTarget {
    return this.atmosphereDataTargets[1]
  }

  /**
   * Swap atmosphere buffers for next frame
   */
  public swapAtmosphereBuffers(): void {
    const temp = this.atmosphereDataTargets[0]
    this.atmosphereDataTargets[0] = this.atmosphereDataTargets[1]
    this.atmosphereDataTargets[1] = temp
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
   * Read back current surface temperature value from GPU for a specific cell
   */
  async getSurfaceTemperature(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<number> {
    const buffer = new Float32Array(4)
    const target = this.getClimateDataCurrent()
    const coords = this.indexTo2D(cellIndex)

    // Read a single pixel
    renderer.readRenderTargetPixels(target, coords.x, coords.y, 1, 1, buffer)

    return buffer[0] // R channel = surfaceTemperature
  }

  /**
   * Read back current climate data for a specific cell
   */
  async getClimateDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<{ surfaceTemperature: number }> {
    const coords = this.indexTo2D(cellIndex)
    const buffer = new Float32Array(4)

    const target = this.getClimateDataCurrent()
    renderer.readRenderTargetPixels(target, coords.x, coords.y, 1, 1, buffer)

    return {
      surfaceTemperature: buffer[0],
    }
  }

  /**
   * Read back current hydrology data (water depth, ice thickness, salinity) for a specific cell
   */
  async getHydrologyDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<{ waterDepth: number; iceThickness: number; salinity: number }> {
    const coords = this.indexTo2D(cellIndex)
    const buffer = new Float32Array(4)

    const target = this.getHydrologyDataCurrent()
    renderer.readRenderTargetPixels(target, coords.x, coords.y, 1, 1, buffer)

    return {
      iceThickness: buffer[0],       // R channel
      waterDepth: buffer[2],         // B channel
      salinity: buffer[3],           // A channel
    }
  }

  /**
   * Read back current surface data (effective albedo) for a specific cell
   */
  async getSurfaceDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<{ albedo: number }> {
    const coords = this.indexTo2D(cellIndex)
    const buffer = new Float32Array(4)

    // Surface data (surface temperature + albedo) is now stored in climate texture
    // R = surfaceTemperature, G = albedo
    const target = this.getClimateDataCurrent()
    renderer.readRenderTargetPixels(target, coords.x, coords.y, 1, 1, buffer)

    return {
      albedo: buffer[1], // G channel = effectiveAlbedo
    }
  }

  /**
   * Read back current atmosphere data (atmospheric temperature and pressure) for a specific cell
   */
  async getAtmosphereDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<{ atmosphericTemperature: number; atmosphericPressure: number }> {
    const coords = this.indexTo2D(cellIndex)
    const buffer = new Float32Array(4)

    const target = this.getAtmosphereDataCurrent()
    renderer.readRenderTargetPixels(target, coords.x, coords.y, 1, 1, buffer)

    return {
      atmosphericTemperature: buffer[0], // R channel = atmosphericTemperature
      atmosphericPressure: buffer[1], // G channel = P_local
    }
  }

  /**
   * Read back terrain data (elevation) for a specific cell
   * Note: Terrain data is static and stored in a DataTexture, not a render target
   */
  getTerrainDataForCell(cellIndex: number): { elevation: number } {
    const coords = this.indexTo2D(cellIndex)
    const dataIndex = this.coordsToDataIndex(coords.x, coords.y, 4)
    const data = this.terrainData.image.data as Float32Array

    return {
      elevation: data[dataIndex + 0], // R channel = elevation (metres)
    }
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
    for (const target of this.climateDataTargets) {
      target.dispose()
    }
    for (const target of this.atmosphereDataTargets) {
      target.dispose()
    }
  }
}

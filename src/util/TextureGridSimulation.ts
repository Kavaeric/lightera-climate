import * as THREE from 'three'
import { Grid, GridCell } from './geodesic'

/**
 * GPU-based grid simulation using textures for state storage
 * Each pixel in the texture represents one cell on the geodesic grid
 */
export class TextureGridSimulation {
  private grid: Grid
  private cells: GridCell[]
  private cellCount: number
  private textureWidth: number
  private textureHeight: number

  // State textures (ping-pong buffers)
  public stateTexture: THREE.DataTexture
  public nextStateTexture: THREE.DataTexture

  // Neighbour lookup textures
  public neighbourIndices1: THREE.DataTexture // stores neighbours 0,1,2
  public neighbourIndices2: THREE.DataTexture // stores neighbours 3,4,5
  public neighbourCounts: THREE.DataTexture // stores how many neighbours (5 or 6)

  // Render targets for ping-pong rendering
  public renderTarget1: THREE.WebGLRenderTarget
  public renderTarget2: THREE.WebGLRenderTarget
  private currentTarget: number = 0 // 0 or 1, for ping-ponging

  constructor(subdivision: number) {
    this.grid = new Grid(subdivision)
    this.cells = Array.from(this.grid)
    this.cellCount = this.cells.length

    // Calculate 2D texture dimensions (square or near-square, power-of-2)
    // Find dimensions that can fit all cells
    const sqrtCells = Math.sqrt(this.cellCount)
    const baseWidth = Math.ceil(sqrtCells)
    this.textureWidth = Math.pow(2, Math.ceil(Math.log2(baseWidth)))
    this.textureHeight = Math.ceil(this.cellCount / this.textureWidth)
    // Round height to next power of 2 for better GPU performance
    this.textureHeight = Math.pow(2, Math.ceil(Math.log2(this.textureHeight)))

    console.log(
      `TextureGridSimulation: ${this.cellCount} cells, texture size: ${this.textureWidth}x${this.textureHeight}`
    )

    // Create textures
    this.stateTexture = this.createStateTexture()
    this.nextStateTexture = this.createStateTexture()
    this.neighbourIndices1 = this.createneighbourTexture1()
    this.neighbourIndices2 = this.createneighbourTexture2()
    this.neighbourCounts = this.createNeighbourCountTexture()

    // Create render targets for GPU computation
    this.renderTarget1 = this.createRenderTarget()
    this.renderTarget2 = this.createRenderTarget()

    // Initialize values
    this.initializeValues()
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
   * Create a state texture (RGBA32F, 2D layout)
   * R = temperature, G/B/A reserved for future properties
   */
  private createStateTexture(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * this.textureHeight * 4) // RGBA
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
   * Initialize temperature values with random noise
   * Random values between -40°C and +30°C to test diffusion
   */
  private initializeValues() {
    const data = this.stateTexture.image.data as Float32Array

    for (let i = 0; i < this.cellCount; i++) {
      // Random temperature between -40 and +30
      const temp = -40 + Math.random() * 70

      const coords = this.indexTo2D(i)
      const dataIndex = this.coordsToDataIndex(coords.x, coords.y, 4)

      data[dataIndex + 0] = temp // R = temperature
      data[dataIndex + 1] = 0 // G = unused
      data[dataIndex + 2] = 0 // B = unused
      data[dataIndex + 3] = 0 // A = unused
    }

    this.stateTexture.needsUpdate = true

    // Copy to render target 1
    // (This will be done in the component after renderer is available)
  }

  /**
   * Get the current state texture (for rendering)
   */
  getCurrentTexture(): THREE.Texture {
    return this.currentTarget === 0
      ? this.renderTarget1.texture
      : this.renderTarget2.texture
  }

  /**
   * Get the current render target (for writing)
   */
  getCurrentRenderTarget(): THREE.WebGLRenderTarget {
    return this.currentTarget === 0 ? this.renderTarget1 : this.renderTarget2
  }

  /**
   * Get the next render target (for reading)
   */
  getNextRenderTarget(): THREE.WebGLRenderTarget {
    return this.currentTarget === 0 ? this.renderTarget2 : this.renderTarget1
  }

  /**
   * Swap ping-pong buffers
   */
  swapBuffers() {
    this.currentTarget = 1 - this.currentTarget
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
   * Read back temperature value from GPU (slow, for stats only)
   */
  async getTemperature(cellIndex: number, renderer: THREE.WebGLRenderer): Promise<number> {
    const buffer = new Float32Array(4)
    const target = this.getCurrentRenderTarget()
    const coords = this.indexTo2D(cellIndex)

    // Read a single pixel
    renderer.readRenderTargetPixels(target, coords.x, coords.y, 1, 1, buffer)

    return buffer[0] // R channel = temperature
  }

  /**
   * Read back min/max temperature from GPU (slow, for stats only)
   */
  async getMinMaxTemperature(renderer: THREE.WebGLRenderer): Promise<{ min: number; max: number }> {
    const buffer = new Float32Array(this.textureWidth * this.textureHeight * 4)
    const target = this.getCurrentRenderTarget()

    renderer.readRenderTargetPixels(target, 0, 0, this.textureWidth, this.textureHeight, buffer)

    let min = Infinity
    let max = -Infinity

    for (let i = 0; i < this.cellCount; i++) {
      const coords = this.indexTo2D(i)
      const dataIndex = this.coordsToDataIndex(coords.x, coords.y, 4)
      const temp = buffer[dataIndex] // R channel
      min = Math.min(min, temp)
      max = Math.max(max, temp)
    }

    return { min, max }
  }

  dispose() {
    this.stateTexture.dispose()
    this.nextStateTexture.dispose()
    this.neighbourIndices1.dispose()
    this.neighbourIndices2.dispose()
    this.neighbourCounts.dispose()
    this.renderTarget1.dispose()
    this.renderTarget2.dispose()
  }
}

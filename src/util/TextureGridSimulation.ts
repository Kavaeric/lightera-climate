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

    // Calculate texture width (next power of 2)
    this.textureWidth = Math.pow(2, Math.ceil(Math.log2(this.cellCount)))

    console.log(
      `TextureGridSimulation: ${this.cellCount} cells, texture width: ${this.textureWidth}`
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
   * Create a state texture (RGBA32F, 1D layout)
   * R = temperature, G/B/A reserved for future properties
   */
  private createStateTexture(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * 4) // RGBA
    const texture = new THREE.DataTexture(
      data,
      this.textureWidth,
      1,
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
    const data = new Float32Array(this.textureWidth * 3) // RGB

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

      // Store first 3 neighbours as RGB
      data[i * 3 + 0] = neighbourIndices[0] ?? -1 // R = neighbour 0
      data[i * 3 + 1] = neighbourIndices[1] ?? -1 // G = neighbour 1
      data[i * 3 + 2] = neighbourIndices[2] ?? -1 // B = neighbour 2
    }

    const texture = new THREE.DataTexture(
      data,
      this.textureWidth,
      1,
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
    const data = new Float32Array(this.textureWidth * 3) // RGB

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

      // Store next 3 neighbours as RGB
      data[i * 3 + 0] = neighbourIndices[3] ?? -1 // R = neighbour 3
      data[i * 3 + 1] = neighbourIndices[4] ?? -1 // G = neighbour 4
      data[i * 3 + 2] = neighbourIndices[5] ?? -1 // B = neighbour 5
    }

    const texture = new THREE.DataTexture(
      data,
      this.textureWidth,
      1,
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
    const data = new Float32Array(this.textureWidth) // Single channel

    for (let i = 0; i < this.cellCount; i++) {
      const cell = this.cells[i]
      const neighbourCells = cell.neighbours(this.grid)
      data[i] = neighbourCells.length
    }

    const texture = new THREE.DataTexture(
      data,
      this.textureWidth,
      1,
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
    return new THREE.WebGLRenderTarget(this.textureWidth, 1, {
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

      data[i * 4 + 0] = temp // R = temperature
      data[i * 4 + 1] = 0 // G = unused
      data[i * 4 + 2] = 0 // B = unused
      data[i * 4 + 3] = 0 // A = unused
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
   * Get cell count
   */
  getCellCount(): number {
    return this.cellCount
  }

  /**
   * Get UV coordinate for a given cell index
   */
  getCellUV(cellIndex: number): number {
    return (cellIndex + 0.5) / this.textureWidth
  }

  /**
   * Read back temperature value from GPU (slow, for stats only)
   */
  async getTemperature(cellIndex: number, renderer: THREE.WebGLRenderer): Promise<number> {
    const buffer = new Float32Array(4)
    const target = this.getCurrentRenderTarget()

    // Read a single pixel
    renderer.readRenderTargetPixels(target, cellIndex, 0, 1, 1, buffer)

    return buffer[0] // R channel = temperature
  }

  /**
   * Read back min/max temperature from GPU (slow, for stats only)
   */
  async getMinMaxTemperature(renderer: THREE.WebGLRenderer): Promise<{ min: number; max: number }> {
    const buffer = new Float32Array(this.textureWidth * 4)
    const target = this.getCurrentRenderTarget()

    renderer.readRenderTargetPixels(target, 0, 0, this.textureWidth, 1, buffer)

    let min = Infinity
    let max = -Infinity

    for (let i = 0; i < this.cellCount; i++) {
      const temp = buffer[i * 4] // R channel
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

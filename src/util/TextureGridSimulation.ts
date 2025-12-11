import * as THREE from 'three'
import { Grid } from './geodesic'

/**
 * GPU-based grid simulation using textures for state storage
 * Each pixel in the texture represents one cell on the geodesic grid
 */
export class TextureGridSimulation {
  private grid: Grid
  private cells: any[]
  private cellCount: number
  private textureWidth: number

  // State textures (ping-pong buffers)
  public stateTexture: THREE.DataTexture
  public nextStateTexture: THREE.DataTexture

  // Neighbor lookup textures
  public neighborIndices1: THREE.DataTexture // stores neighbors 0,1,2
  public neighborIndices2: THREE.DataTexture // stores neighbors 3,4,5
  public neighborCounts: THREE.DataTexture // stores how many neighbors (5 or 6)

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
    this.neighborIndices1 = this.createNeighborTexture1()
    this.neighborIndices2 = this.createNeighborTexture2()
    this.neighborCounts = this.createNeighborCountTexture()

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
   * Create neighbor indices texture 1 (stores neighbors 0, 1, 2)
   */
  private createNeighborTexture1(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * 3) // RGB

    for (let i = 0; i < this.cellCount; i++) {
      const cell = this.cells[i]
      const neighborCells = cell.neighbors(this.grid)

      // Find indices of neighbors in the cells array
      const neighborIndices = neighborCells.map((neighborCell: any) =>
        this.cells.indexOf(neighborCell)
      )

      // Store first 3 neighbors as RGB
      data[i * 3 + 0] = neighborIndices[0] ?? -1 // R = neighbor 0
      data[i * 3 + 1] = neighborIndices[1] ?? -1 // G = neighbor 1
      data[i * 3 + 2] = neighborIndices[2] ?? -1 // B = neighbor 2
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
   * Create neighbor indices texture 2 (stores neighbors 3, 4, 5)
   */
  private createNeighborTexture2(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth * 3) // RGB

    for (let i = 0; i < this.cellCount; i++) {
      const cell = this.cells[i]
      const neighborCells = cell.neighbors(this.grid)

      // Find indices of neighbors in the cells array
      const neighborIndices = neighborCells.map((neighborCell: any) =>
        this.cells.indexOf(neighborCell)
      )

      // Store next 3 neighbors as RGB
      data[i * 3 + 0] = neighborIndices[3] ?? -1 // R = neighbor 3
      data[i * 3 + 1] = neighborIndices[4] ?? -1 // G = neighbor 4
      data[i * 3 + 2] = neighborIndices[5] ?? -1 // B = neighbor 5
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
   * Create neighbor count texture (stores how many neighbors each cell has)
   */
  private createNeighborCountTexture(): THREE.DataTexture {
    const data = new Float32Array(this.textureWidth) // Single channel

    for (let i = 0; i < this.cellCount; i++) {
      const cell = this.cells[i]
      const neighborCells = cell.neighbors(this.grid)
      data[i] = neighborCells.length
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
    this.neighborIndices1.dispose()
    this.neighborIndices2.dispose()
    this.neighborCounts.dispose()
    this.renderTarget1.dispose()
    this.renderTarget2.dispose()
  }
}

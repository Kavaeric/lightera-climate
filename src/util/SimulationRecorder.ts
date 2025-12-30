import * as THREE from 'three'
import type { TextureGridSimulation } from './TextureGridSimulation'
import fullscreenVertexShader from '../shaders/fullscreen.vert?raw'
import copyFragmentShader from '../shaders/copy.frag?raw'
import interpolateFragmentShader from '../shaders/interpolate.frag?raw'

/**
 * Configuration for the simulation recorder
 */
export interface RecorderConfig {
  samplesPerOrbit: number // Number of samples to record per orbit (e.g., 50)
  stepsPerOrbit: number // Total physics steps per orbit
}

/**
 * SimulationRecorder - Records simulation data in a GPU ring buffer
 * 
 * Records climate data at regular intervals and stores it in a ring buffer.
 * Only the last complete orbit is accessible, with a rolling window of
 * 1 full orbit + 1 nearly complete orbit.
 */
export class SimulationRecorder {
  private config: RecorderConfig
  private simulation: TextureGridSimulation
  private gl: THREE.WebGLRenderer

  // Ring buffer: array of render targets, one per time sample
  // Buffer depth = 2 × samplesPerOrbit (1 full + 1 nearly complete orbit)
  private ringBuffer: THREE.WebGLRenderTarget[]
  private bufferDepth: number

  // Recording state
  private writeIndex: number = 0 // Current write position in ring buffer
  private sampleCount: number = 0 // Total samples recorded (for debugging)
  private completeOrbitStartIndex: number | null = null // Start index of last complete orbit
  private lastOrbitIdx: number = -1 // Track orbit changes

  // Sampling cadence (can be fractional)
  private stepsPerSample: number // How many physics steps between samples (e.g., 8.333...)
  private stepsSinceLastSample: number = 0 // Accumulates, can exceed stepsPerSample

  // Previous state snapshot for interpolation
  private previousSnapshot: THREE.WebGLRenderTarget | null = null

  // GPU resources for copying data
  private copyMaterial: THREE.ShaderMaterial
  private interpolationMaterial: THREE.ShaderMaterial
  private copyScene: THREE.Scene
  private copyMesh: THREE.Mesh
  private copyCamera: THREE.OrthographicCamera

  // Debugging
  private isEnabled: boolean = true

  constructor(
    config: RecorderConfig,
    simulation: TextureGridSimulation,
    gl: THREE.WebGLRenderer
  ) {
    this.config = config
    this.simulation = simulation
    this.gl = gl

    // Calculate buffer depth (2 orbits worth)
    this.bufferDepth = 2 * config.samplesPerOrbit
    // Allow fractional stepsPerSample for accurate sampling
    this.stepsPerSample = config.stepsPerOrbit / config.samplesPerOrbit

    // Create ring buffer (array of render targets)
    this.ringBuffer = this.createRingBuffer()

    // Create previous snapshot render target for interpolation
    const width = this.simulation.getTextureWidth()
    const height = this.simulation.getTextureHeight()
    this.previousSnapshot = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    })

    // Create GPU resources for copying data
    this.copyMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: copyFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        sourceTex: { value: null },
      },
    })

    // Create GPU resources for interpolation
    this.interpolationMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: interpolateFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        previousTex: { value: null },
        currentTex: { value: null },
        interpolationFactor: { value: 0 },
      },
    })

    this.copyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.copyScene = new THREE.Scene()
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.copyMesh = new THREE.Mesh(geometry, this.copyMaterial)
    this.copyScene.add(this.copyMesh)

    // Initialise previous snapshot with current state
    this.capturePreviousSnapshot()
  }

  /**
   * Create the ring buffer (array of render targets)
   */
  private createRingBuffer(): THREE.WebGLRenderTarget[] {
    const width = this.simulation.getTextureWidth()
    const height = this.simulation.getTextureHeight()
    const buffer: THREE.WebGLRenderTarget[] = []

    for (let i = 0; i < this.bufferDepth; i++) {
      const target = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      })
      buffer.push(target)
    }

    return buffer
  }


  /**
   * Called after each physics step to check if we should record a sample
   * Returns true if a sample was recorded
   * 
   * Note: This should be called AFTER the physics step, so current state is the new state
   * and we need to have captured the previous state before the step.
   */
  public onPhysicsStep(_physicsStep: number, orbitIdx: number): boolean {
    if (!this.isEnabled) {
      return false
    }

    // Check for orbit completion (orbitIdx increments when an orbit completes)
    // When orbitIdx changes, the previous orbit just completed
    if (orbitIdx !== this.lastOrbitIdx && this.lastOrbitIdx >= 0) {
      // Orbit just completed - mark the complete orbit
      // The complete orbit is the last samplesPerOrbit samples we recorded
      // Since writeIndex points to the NEXT write position, the last sample is at (writeIndex - 1) % bufferDepth
      // The complete orbit starts at (writeIndex - samplesPerOrbit) % bufferDepth
      this.completeOrbitStartIndex = (this.writeIndex - this.config.samplesPerOrbit + this.bufferDepth) % this.bufferDepth
      
      console.log(`[SimulationRecorder] Orbit ${this.lastOrbitIdx} complete (${this.config.samplesPerOrbit} samples)`)
    }
    
    this.lastOrbitIdx = orbitIdx

    // Check if it's time to sample
    // Note: previousSnapshot contains state from previous step (captured at end of last call)
    // current state is the new state after this step
    this.stepsSinceLastSample += 1.0
    
    if (this.stepsSinceLastSample >= this.stepsPerSample) {
      // Calculate interpolation factor (how far between previous and current step)
      // If stepsSinceLastSample = 8.5 and stepsPerSample = 8.333, we're 0.167 steps past the threshold
      const fraction = (this.stepsSinceLastSample - this.stepsPerSample) / 1.0
      
      // Record sample with interpolation between previous and current state
      this.recordSampleWithInterpolation(fraction)
      
      // Carry forward the fractional remainder
      this.stepsSinceLastSample = fraction
      
      // Capture current state as previous snapshot for next step
      this.capturePreviousSnapshot()
      return true
    }

    // Capture current state as previous snapshot for next step (even if we didn't sample)
    this.capturePreviousSnapshot()
    return false
  }

  /**
   * Capture current climate state as previous snapshot for interpolation
   * Called at the end of each step to prepare for next step's interpolation
   */
  private capturePreviousSnapshot(): void {
    if (!this.previousSnapshot) return

    const currentTexture = this.simulation.getClimateDataCurrent().texture
    this.copyMaterial.uniforms.sourceTex.value = currentTexture

    const prevTarget = this.gl.getRenderTarget()
    this.gl.setRenderTarget(this.previousSnapshot)
    this.gl.clear()
    this.gl.render(this.copyScene, this.copyCamera)
    this.gl.setRenderTarget(prevTarget)
  }

  /**
   * Record a sample with linear interpolation between previous and current state
   * @param fraction Interpolation factor [0, 1] where 0 = previous, 1 = current
   */
  private recordSampleWithInterpolation(fraction: number): void {
    const target = this.ringBuffer[this.writeIndex]
    const currentTexture = this.simulation.getClimateDataCurrent().texture

    // If previousSnapshot is not ready yet (first sample), just use current state
    if (!this.previousSnapshot) {
      this.copyMaterial.uniforms.sourceTex.value = currentTexture
      const prevTarget = this.gl.getRenderTarget()
      this.gl.setRenderTarget(target)
      this.gl.clear()
      this.gl.render(this.copyScene, this.copyCamera)
      this.gl.setRenderTarget(prevTarget)
    }
    // If fraction is very close to 1.0, just use current (no interpolation needed)
    else if (fraction > 0.999) {
      // Use current directly
      this.copyMaterial.uniforms.sourceTex.value = currentTexture
      const prevTarget = this.gl.getRenderTarget()
      this.gl.setRenderTarget(target)
      this.gl.clear()
      this.gl.render(this.copyScene, this.copyCamera)
      this.gl.setRenderTarget(prevTarget)
    }
    // If fraction is very close to 0.0, just use previous (no interpolation needed)
    else if (fraction < 0.001) {
      // Use previous snapshot directly
      this.copyMaterial.uniforms.sourceTex.value = this.previousSnapshot.texture
      const prevTarget = this.gl.getRenderTarget()
      this.gl.setRenderTarget(target)
      this.gl.clear()
      this.gl.render(this.copyScene, this.copyCamera)
      this.gl.setRenderTarget(prevTarget)
    }
    // Otherwise, interpolate between previous and current
    else {
      // Interpolate between previous and current
      this.interpolationMaterial.uniforms.previousTex.value = this.previousSnapshot.texture
      this.interpolationMaterial.uniforms.currentTex.value = currentTexture
      this.interpolationMaterial.uniforms.interpolationFactor.value = fraction

      // Temporarily switch mesh to interpolation material
      const originalMaterial = this.copyMesh.material
      this.copyMesh.material = this.interpolationMaterial

      const prevTarget = this.gl.getRenderTarget()
      this.gl.setRenderTarget(target)
      this.gl.clear()
      this.gl.render(this.copyScene, this.copyCamera)
      this.gl.setRenderTarget(prevTarget)

      // Restore original material
      this.copyMesh.material = originalMaterial
    }

    // Advance write pointer (wrap around)
    this.writeIndex = (this.writeIndex + 1) % this.bufferDepth
    this.sampleCount++
  }

  /**
   * Get the start index of the last complete orbit
   * Returns null if no complete orbit has been recorded yet
   */
  public getCompleteOrbitStartIndex(): number | null {
    return this.completeOrbitStartIndex
  }

  /**
   * Check if a complete orbit has been recorded
   */
  public hasCompleteOrbit(): boolean {
    return this.completeOrbitStartIndex !== null
  }

  /**
   * Get the number of samples in the complete orbit
   */
  public getSamplesPerOrbit(): number {
    return this.config.samplesPerOrbit
  }

  /**
   * Read complete orbit surface temperature data for a specific cell
   * Returns an array of surface temperature values, one per sample in the complete orbit
   * Returns null if no complete orbit is available
   */
  public async getCompleteOrbitSurfaceTemperatureForCell(
    cellIndex: number
  ): Promise<number[] | null> {
    if (!this.hasCompleteOrbit() || this.completeOrbitStartIndex === null) {
      return null
    }

    // Calculate 2D texture coordinates from cell index
    const textureWidth = this.simulation.getTextureWidth()
    const pixelX = cellIndex % textureWidth
    const pixelY = Math.floor(cellIndex / textureWidth)

    const surfaceTemperatures: number[] = []
    const buffer = new Float32Array(4)

    // Read from each sample in the complete orbit
    for (let i = 0; i < this.config.samplesPerOrbit; i++) {
      const sampleIndex = (this.completeOrbitStartIndex + i) % this.bufferDepth
      const target = this.ringBuffer[sampleIndex]

      this.gl.readRenderTargetPixels(target, pixelX, pixelY, 1, 1, buffer)
      surfaceTemperatures.push(buffer[0]) // R channel = surfaceTemperature
    }

    return surfaceTemperatures
  }

  /**
   * Read complete orbit surface temperature and albedo data for a specific cell
   * Returns an array of objects with temperature and albedo, one per sample in the complete orbit
   * Returns null if no complete orbit is available
   */
  public async getCompleteOrbitSurfaceDataForCell(
    cellIndex: number
  ): Promise<Array<{ temperature: number; albedo: number }> | null> {
    if (!this.hasCompleteOrbit() || this.completeOrbitStartIndex === null) {
      return null
    }

    // Calculate 2D texture coordinates from cell index
    const textureWidth = this.simulation.getTextureWidth()
    const pixelX = cellIndex % textureWidth
    const pixelY = Math.floor(cellIndex / textureWidth)

    const surfaceData: Array<{ temperature: number; albedo: number }> = []
    const buffer = new Float32Array(4)

    // Read from each sample in the complete orbit
    for (let i = 0; i < this.config.samplesPerOrbit; i++) {
      const sampleIndex = (this.completeOrbitStartIndex + i) % this.bufferDepth
      const target = this.ringBuffer[sampleIndex]

      this.gl.readRenderTargetPixels(target, pixelX, pixelY, 1, 1, buffer)
      surfaceData.push({
        temperature: buffer[0], // R channel = surfaceTemperature
        albedo: buffer[3],      // A channel = albedo
      })
    }

    return surfaceData
  }

  /**
   * Get current write index (for debugging)
   */
  public getWriteIndex(): number {
    return this.writeIndex
  }

  /**
   * Get total samples recorded (for debugging)
   */
  public getSampleCount(): number {
    return this.sampleCount
  }

  /**
   * Enable or disable recording
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  /**
   * Reset the recorder (clear buffer, reset indices)
   */
  public reset(): void {
    this.writeIndex = 0
    this.sampleCount = 0
    this.completeOrbitStartIndex = null
    this.lastOrbitIdx = -1
    this.stepsSinceLastSample = 0
    // Capture initial state as previous snapshot
    this.capturePreviousSnapshot()
  }

  /**
   * Dispose of GPU resources
   */
  public dispose(): void {
    for (const target of this.ringBuffer) {
      target.dispose()
    }
    if (this.previousSnapshot) {
      this.previousSnapshot.dispose()
    }
    this.copyMaterial.dispose()
    this.interpolationMaterial.dispose()
    this.copyMesh.geometry.dispose()
    this.copyScene.clear()
  }
}


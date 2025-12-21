import * as THREE from 'three'
import type { TextureGridSimulation } from './TextureGridSimulation'

/**
 * Configuration for the simulation executor
 */
export interface ExecutorConfig {
  dt: number
  yearLength: number
  subsolarPoint: { lat: number; lon: number }
  rotationsPerYear: number
}

/**
 * State of the simulation (read-only snapshot)
 */
export interface ExecutorState {
  readonly totalTime: number
  readonly yearProgress: number
  readonly rotationDegrees: number
  readonly currentSubsolarLon: number
}

/**
 * SimulationExecutor - Executes a single physics step
 *
 * This class has no awareness of orbits, iterations, or control flow.
 * It only knows how to advance the simulation by one timestep.
 */
export class SimulationExecutor {
  private config: ExecutorConfig
  private state: ExecutorState
  private onError?: (error: Error) => void

  constructor(config: ExecutorConfig, onError?: (error: Error) => void) {
    this.config = config
    this.onError = onError
    this.state = {
      totalTime: 0,
      yearProgress: 0,
      rotationDegrees: 0,
      currentSubsolarLon: config.subsolarPoint.lon,
    }
  }

  /**
   * Execute a single physics step
   * Updates internal state and returns the new state
   */
  step(): Readonly<ExecutorState> {
    // Advance time
    this.state = {
      totalTime: this.state.totalTime + this.config.dt,
      yearProgress: ((this.state.totalTime + this.config.dt) % this.config.yearLength) / this.config.yearLength,
      rotationDegrees: (((this.state.totalTime + this.config.dt) % this.config.yearLength) / this.config.yearLength) * this.config.rotationsPerYear * 360,
      currentSubsolarLon: (this.config.subsolarPoint.lon + (((this.state.totalTime + this.config.dt) % this.config.yearLength) / this.config.yearLength) * this.config.rotationsPerYear * 360) % 360,
    }

    return { ...this.state }
  }

  /**
   * Get current state without advancing
   */
  getState(): Readonly<ExecutorState> {
    return { ...this.state }
  }

  /**
   * Reset the executor to initial state
   */
  reset(): void {
    this.state = {
      totalTime: 0,
      yearProgress: 0,
      rotationDegrees: 0,
      currentSubsolarLon: this.config.subsolarPoint.lon,
    }
  }

  /**
   * Render a single physics step to GPU
   * This is the actual physics computation on the GPU
   * Returns true on success, false if an error occurred
   */
  renderStep(
    gl: THREE.WebGLRenderer,
    simulation: TextureGridSimulation,
    materials: {
      hydrologyMaterial: THREE.ShaderMaterial
      atmosphereMaterial: THREE.ShaderMaterial
      surfaceMaterial: THREE.ShaderMaterial
    },
    mesh: THREE.Mesh,
    scene: THREE.Scene,
    camera: THREE.OrthographicCamera
  ): boolean {
    try {
      const { hydrologyMaterial, atmosphereMaterial, surfaceMaterial } = materials

      // Update material uniforms with current orbital state
      atmosphereMaterial.uniforms.baseSubsolarPoint.value.set(
        this.config.subsolarPoint.lat,
        this.state.currentSubsolarLon
      )
      atmosphereMaterial.uniforms.yearProgress.value = this.state.yearProgress

      surfaceMaterial.uniforms.baseSubsolarPoint.value.set(
        this.config.subsolarPoint.lat,
        this.state.currentSubsolarLon
      )
      surfaceMaterial.uniforms.yearProgress.value = this.state.yearProgress

      // Get ping-pong buffers
      const surfaceSource = simulation.getClimateDataCurrent()
      const surfaceDest = simulation.getClimateDataNext()

      // ===== STEP 1: Update hydrology (ice formation/melting) =====
      const hydrologyCurrent = simulation.getHydrologyDataCurrent()
      const hydrologyNext = simulation.getHydrologyDataNext()

      hydrologyMaterial.uniforms.previousHydrology.value = hydrologyCurrent.texture
      hydrologyMaterial.uniforms.currentTemperature.value = surfaceSource.texture
      hydrologyMaterial.uniforms.atmosphereData.value = simulation.getAtmosphereDataCurrent().texture

      mesh.material = hydrologyMaterial
      gl.setRenderTarget(hydrologyNext)
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      simulation.swapHydrologyBuffers()

      // ===== STEP 2: Update atmosphere (IR absorption/transmission, thermal evolution) =====
      const atmosphereCurrent = simulation.getAtmosphereDataCurrent()
      const atmosphereNext = simulation.getAtmosphereDataNext()

      atmosphereMaterial.uniforms.previousAtmosphere.value = atmosphereCurrent.texture
      atmosphereMaterial.uniforms.previousSurfaceData.value = surfaceSource.texture

      mesh.material = atmosphereMaterial
      gl.setRenderTarget(atmosphereNext)
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      simulation.swapAtmosphereBuffers()

      // ===== STEP 3: Update surface/thermal (albedo + temperature evolution with atmospheric feedback) =====
      surfaceMaterial.uniforms.previousSurfaceData.value = surfaceSource.texture
      surfaceMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture
      surfaceMaterial.uniforms.atmosphereData.value = simulation.getAtmosphereDataCurrent().texture

      mesh.material = surfaceMaterial
      gl.setRenderTarget(surfaceDest)
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      simulation.swapClimateBuffers()

      return true
    } catch (error) {
      console.error('[SimulationExecutor] GPU render step failed:', error)
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)))
      }
      return false
    }
  }
}

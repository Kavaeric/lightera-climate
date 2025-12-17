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

  constructor(config: ExecutorConfig) {
    this.config = config
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
   */
  renderStep(
    gl: THREE.WebGLRenderer,
    simulation: TextureGridSimulation,
    materials: {
      hydrologyMaterial: THREE.ShaderMaterial
      surfaceMaterial: THREE.ShaderMaterial
      thermalMaterial: THREE.ShaderMaterial
    },
    mesh: THREE.Mesh,
    scene: THREE.Scene,
    camera: THREE.OrthographicCamera
  ): void {
    const { hydrologyMaterial, surfaceMaterial, thermalMaterial } = materials

    // Update thermal material uniforms with current orbital state
    thermalMaterial.uniforms.baseSubsolarPoint.value.set(
      this.config.subsolarPoint.lat,
      this.state.currentSubsolarLon
    )
    thermalMaterial.uniforms.yearProgress.value = this.state.yearProgress

    // Get ping-pong buffers
    const climateSource = simulation.getClimateDataCurrent()
    const climateDest = simulation.getClimateDataNext()

    // ===== STEP 1: Update hydrology (ice formation/melting) =====
    const hydrologyCurrent = simulation.getHydrologyDataCurrent()
    const hydrologyNext = simulation.getHydrologyDataNext()

    hydrologyMaterial.uniforms.previousHydrology.value = hydrologyCurrent.texture
    hydrologyMaterial.uniforms.currentTemperature.value = climateSource.texture

    mesh.material = hydrologyMaterial
    gl.setRenderTarget(hydrologyNext)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    simulation.swapHydrologyBuffers()

    // ===== STEP 2: Update surface properties (effective albedo) =====
    const surfaceNext = simulation.getSurfaceDataNext()

    surfaceMaterial.uniforms.terrainData.value = simulation.terrainData
    surfaceMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture

    mesh.material = surfaceMaterial
    gl.setRenderTarget(surfaceNext)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    simulation.swapSurfaceBuffers()

    // ===== STEP 3: Update thermal (temperature evolution) =====
    thermalMaterial.uniforms.previousTemperature.value = climateSource.texture
    thermalMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture
    thermalMaterial.uniforms.surfaceData.value = simulation.getSurfaceDataCurrent().texture

    mesh.material = thermalMaterial
    gl.setRenderTarget(climateDest)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    simulation.swapClimateBuffers()

    // Advance executor state
    this.step()
  }
}

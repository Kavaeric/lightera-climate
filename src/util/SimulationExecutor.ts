import * as THREE from 'three'
import type { TextureGridSimulation } from './TextureGridSimulation'

/**
 * Configuration for the simulation executor
 */
export interface ExecutorConfig {
  dt: number
  yearLength: number
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
  private copyMaterial: THREE.ShaderMaterial

  constructor(config: ExecutorConfig, onError?: (error: Error) => void) {
    this.config = config
    this.onError = onError
    this.state = {
      totalTime: 0,
      yearProgress: 0,
      rotationDegrees: 0,
      currentSubsolarLon: 0,  // Start at prime meridian
    }

    // Create reusable copy material for working buffer management
    this.copyMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D sourceTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(sourceTexture, vUv);
        }
      `,
      uniforms: {
        sourceTexture: { value: null }
      }
    })
  }

  /**
   * Execute a single physics step
   * Updates internal state and returns the new state
   */
  step(): Readonly<ExecutorState> {
    const newTotalTime = this.state.totalTime + this.config.dt
    const newYearProgress = (newTotalTime % this.config.yearLength) / this.config.yearLength
    const newRotationDegrees = newYearProgress * this.config.rotationsPerYear * 360

    // Advance time
    this.state = {
      totalTime: newTotalTime,
      yearProgress: newYearProgress,
      rotationDegrees: newRotationDegrees,
      currentSubsolarLon: newRotationDegrees % 360,  // Subsolar longitude advances with planet rotation
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
      currentSubsolarLon: 0,  // Start at prime meridian
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
      solarFluxMaterial: THREE.ShaderMaterial
      surfaceIncidentMaterial: THREE.ShaderMaterial
      surfaceRadiationMaterial: THREE.ShaderMaterial
    },
    mesh: THREE.Mesh,
    scene: THREE.Scene,
    camera: THREE.OrthographicCamera
  ): boolean {
    try {
      const { solarFluxMaterial } = materials
      // Note: hydrologyMaterial, atmosphereMaterial, surfaceMaterial are kept in materials
      // for future passes, but not used yet in new architecture

      // Update material uniforms with current orbital state
      solarFluxMaterial.uniforms.yearProgress.value = this.state.yearProgress
      solarFluxMaterial.uniforms.subsolarLon.value = this.state.currentSubsolarLon

      // ===== NEW PASS-BASED PHYSICS ARCHITECTURE =====

      // STEP 0: Copy current state into working buffers
      // This is the initial state for this timestep's pass sequence
      const surfaceStateCurrent = simulation.getClimateDataCurrent()
      const atmosphereStateCurrent = simulation.getAtmosphereDataCurrent()

      // Initialise working buffers with current state
      // We'll ping-pong between workingBuffers[0] and [1] during the passes

      // Copy surface state to working buffer 0
      this.copyMaterial.uniforms.sourceTexture.value = surfaceStateCurrent.texture
      mesh.material = this.copyMaterial
      gl.setRenderTarget(simulation.getSurfaceWorkingBuffer(0))
      gl.clear()
      gl.render(scene, camera)

      // Copy atmosphere state to working buffer 0
      this.copyMaterial.uniforms.sourceTexture.value = atmosphereStateCurrent.texture
      gl.setRenderTarget(simulation.getAtmosphereWorkingBuffer(0))
      gl.clear()
      gl.render(scene, camera)

      gl.setRenderTarget(null)

      // Pass 1: Calculate solar flux at top of atmosphere
      mesh.material = solarFluxMaterial
      gl.setRenderTarget(simulation.getSolarFluxTarget())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Pass 2: Calculate surface incident heating
      const { surfaceIncidentMaterial } = materials
      // Set input textures for pass 2
      surfaceIncidentMaterial.uniforms.solarFluxData.value = simulation.getSolarFluxTarget().texture
      surfaceIncidentMaterial.uniforms.surfaceData.value = simulation.getSurfaceWorkingBuffer(0).texture
      surfaceIncidentMaterial.uniforms.atmosphereData.value = simulation.getAtmosphereWorkingBuffer(0).texture
      surfaceIncidentMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture

      // Render pass 2: reads from working buffer 0, writes to working buffer 1
      mesh.material = surfaceIncidentMaterial
      gl.setRenderTarget(simulation.getSurfaceWorkingBuffer(1))
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Copy working buffer 1 back to working buffer 0 for next pass
      this.copyMaterial.uniforms.sourceTexture.value = simulation.getSurfaceWorkingBuffer(1).texture
      mesh.material = this.copyMaterial
      gl.setRenderTarget(simulation.getSurfaceWorkingBuffer(0))
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Pass 3: Calculate surface radiation (Stefan-Boltzmann cooling)
      const { surfaceRadiationMaterial } = materials
      // Set input textures for pass 3
      surfaceRadiationMaterial.uniforms.surfaceData.value = simulation.getSurfaceWorkingBuffer(0).texture

      // Render pass 3: reads from working buffer 0, writes to working buffer 1
      mesh.material = surfaceRadiationMaterial
      gl.setRenderTarget(simulation.getSurfaceWorkingBuffer(1))
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Copy working buffer 1 back to working buffer 0 for next pass
      this.copyMaterial.uniforms.sourceTexture.value = simulation.getSurfaceWorkingBuffer(1).texture
      mesh.material = this.copyMaterial
      gl.setRenderTarget(simulation.getSurfaceWorkingBuffer(0))
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Pass 4-6: TODO - will read from working buffers and ping-pong between them

      // FINAL STEP: Copy final working buffer state to next frame targets
      // Copy final surface state from working buffer to next target
      this.copyMaterial.uniforms.sourceTexture.value = simulation.getSurfaceWorkingBuffer(0).texture
      mesh.material = this.copyMaterial
      gl.setRenderTarget(simulation.getClimateDataNext())
      gl.clear()
      gl.render(scene, camera)

      // Copy final atmosphere state from working buffer to next target
      this.copyMaterial.uniforms.sourceTexture.value = simulation.getAtmosphereWorkingBuffer(0).texture
      gl.setRenderTarget(simulation.getAtmosphereDataNext())
      gl.clear()
      gl.render(scene, camera)

      gl.setRenderTarget(null)

      // Swap climate and atmosphere buffers for next timestep
      simulation.swapClimateBuffers()
      simulation.swapAtmosphereBuffers()

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

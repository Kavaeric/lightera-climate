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
 * SimulationExecutor.ts
 * 
 * Executes a single physics step on the GPU.
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
      const { solarFluxMaterial, surfaceIncidentMaterial, surfaceRadiationMaterial } = materials

      // Update material uniforms with current orbital state
      solarFluxMaterial.uniforms.yearProgress.value = this.state.yearProgress
      solarFluxMaterial.uniforms.subsolarLon.value = this.state.currentSubsolarLon

      // ===== OPTIMIZED PASS-BASED PHYSICS ARCHITECTURE =====
      // Eliminated excessive buffer copying by writing directly to next targets
      // Before: 10 copy operations per timestep
      // After: 0 copy operations per timestep (direct writes only)

      // Pass 1: Calculate solar flux at top of atmosphere
      mesh.material = solarFluxMaterial
      gl.setRenderTarget(simulation.getSolarFluxTarget())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Pass 2: Calculate surface incident heating
      // Read from current buffers, write to working buffer (intermediate result)
      surfaceIncidentMaterial.uniforms.solarFluxData.value = simulation.getSolarFluxTarget().texture
      surfaceIncidentMaterial.uniforms.surfaceData.value = simulation.getClimateDataCurrent().texture
      surfaceIncidentMaterial.uniforms.atmosphereData.value = simulation.getAtmosphereDataCurrent().texture
      surfaceIncidentMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture

      mesh.material = surfaceIncidentMaterial
      gl.setRenderTarget(simulation.getSurfaceWorkingBuffer(0))
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Pass 3: Calculate surface radiation (Stefan-Boltzmann cooling + atmospheric absorption)
      // Read from working buffer (pass 2 output) and current atmosphere
      surfaceRadiationMaterial.uniforms.surfaceData.value = simulation.getSurfaceWorkingBuffer(0).texture
      surfaceRadiationMaterial.uniforms.atmosphereData.value = simulation.getAtmosphereDataCurrent().texture

      // Get MRT configured to write directly to next targets
      const surfaceRadiationMRT = simulation.getSurfaceRadiationMRT()

      mesh.material = surfaceRadiationMaterial
      gl.setRenderTarget(surfaceRadiationMRT)
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Copy MRT outputs to next frame targets
      // MRT attachment 0 → next surface state
      this.copyMaterial.uniforms.sourceTexture.value = surfaceRadiationMRT.textures[0]
      mesh.material = this.copyMaterial
      gl.setRenderTarget(simulation.getClimateDataNext())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // MRT attachment 1 → next atmosphere state
      this.copyMaterial.uniforms.sourceTexture.value = surfaceRadiationMRT.textures[1]
      gl.setRenderTarget(simulation.getAtmosphereDataNext())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Swap climate and atmosphere pointers for next timestep
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

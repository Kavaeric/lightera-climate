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
      shortwaveIncidentMaterial: THREE.ShaderMaterial
      longwaveRadiationMaterial: THREE.ShaderMaterial
      hydrologyMaterial: THREE.ShaderMaterial
    },
    mesh: THREE.Mesh,
    scene: THREE.Scene,
    camera: THREE.OrthographicCamera
  ): boolean {
    try {
      const { shortwaveIncidentMaterial, longwaveRadiationMaterial, hydrologyMaterial } = materials

      // ===== 3-PASS PHYSICS ARCHITECTURE =====
      // Pass 1: Shortwave heating (solar flux + surface absorption)
      // Pass 2: Longwave radiation (surface emission, atmospheric absorption & re-emission)
      // Pass 3: Hydrology (water cycle dynamics)

      // Pass 1: Calculate shortwave heating (combined solar flux + surface incident)
      // Uses MRT to output both surface state (for physics) and solar flux (for visualisation)
      // Update orbital state uniforms
      shortwaveIncidentMaterial.uniforms.yearProgress.value = this.state.yearProgress
      shortwaveIncidentMaterial.uniforms.subsolarLon.value = this.state.currentSubsolarLon
      // Set input textures
      shortwaveIncidentMaterial.uniforms.surfaceData.value = simulation.getClimateDataCurrent().texture
      shortwaveIncidentMaterial.uniforms.atmosphereData.value = simulation.getAtmosphereDataCurrent().texture
      shortwaveIncidentMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture

      // Render to MRT (attachment 0 = surface state, attachment 1 = solar flux)
      const shortwaveMRT = simulation.getShortwaveMRT()
      mesh.material = shortwaveIncidentMaterial
      gl.setRenderTarget(shortwaveMRT)
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Copy MRT attachment 0 → surface working buffer (for longwave pass)
      this.copyMaterial.uniforms.sourceTexture.value = shortwaveMRT.textures[0]
      mesh.material = this.copyMaterial
      gl.setRenderTarget(simulation.getSurfaceWorkingBuffer(0))
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Copy MRT attachment 1 → auxiliary target R channel (solar flux, not used in physics pipeline)
      this.copyMaterial.uniforms.sourceTexture.value = shortwaveMRT.textures[1]
      gl.setRenderTarget(simulation.getAuxiliaryTarget())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Pass 2: Longwave radiation (greenhouse effect)
      // - Surface emits IR radiation (Stefan-Boltzmann)
      // - Atmosphere absorbs part of surface emission
      // - Atmosphere re-emits based on Kirchhoff's law (emissivity = absorptivity)
      // - Half of atmospheric emission goes to space, half back to surface
      longwaveRadiationMaterial.uniforms.surfaceData.value = simulation.getSurfaceWorkingBuffer(0).texture
      longwaveRadiationMaterial.uniforms.atmosphereData.value = simulation.getAtmosphereDataCurrent().texture
      longwaveRadiationMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture

      // Get MRT configured to write directly to next targets
      const longwaveRadiationMRT = simulation.getLongwaveRadiationMRT()

      mesh.material = longwaveRadiationMaterial
      gl.setRenderTarget(longwaveRadiationMRT)
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Copy MRT outputs to next frame targets
      // MRT attachment 0 → next surface state
      this.copyMaterial.uniforms.sourceTexture.value = longwaveRadiationMRT.textures[0]
      mesh.material = this.copyMaterial
      gl.setRenderTarget(simulation.getClimateDataNext())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // MRT attachment 1 → next atmosphere state
      this.copyMaterial.uniforms.sourceTexture.value = longwaveRadiationMRT.textures[1]
      gl.setRenderTarget(simulation.getAtmosphereDataNext())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Pass 3: Hydrology (water cycle dynamics)
      // - Ice/water phase transitions (freezing and melting)
      // - Latent heat effects on surface temperature
      // - Evaporation from water surfaces (future)
      // - Precipitation from atmosphere (future)
      // Uses MRT to output hydrology state, auxiliary water state, and latent-heat-corrected surface state
      hydrologyMaterial.uniforms.surfaceData.value = longwaveRadiationMRT.textures[0]
      hydrologyMaterial.uniforms.atmosphereData.value = longwaveRadiationMRT.textures[1]
      hydrologyMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture
      hydrologyMaterial.uniforms.auxiliaryData.value = simulation.getAuxiliaryTarget().texture

      // Render to hydrology MRT (attachment 0 = hydrology state, attachment 1 = auxiliary, attachment 2 = surface state)
      const hydrologyMRT = simulation.getHydrologyMRT()
      mesh.material = hydrologyMaterial
      gl.setRenderTarget(hydrologyMRT)
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Copy MRT attachment 0 → next hydrology state
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[0]
      mesh.material = this.copyMaterial
      gl.setRenderTarget(simulation.getHydrologyDataNext())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Copy MRT attachment 1 → auxiliary target (contains solar flux + water state)
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[1]
      gl.setRenderTarget(simulation.getAuxiliaryTarget())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Copy MRT attachment 2 → next surface state (overwrites longwave output with latent-heat-corrected temperature)
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[2]
      gl.setRenderTarget(simulation.getClimateDataNext())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(null)

      // Swap climate, atmosphere, and hydrology pointers for next timestep
      simulation.swapClimateBuffers()
      simulation.swapAtmosphereBuffers()
      simulation.swapHydrologyBuffers()

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

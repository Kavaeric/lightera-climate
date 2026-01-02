import * as THREE from 'three';
import type { TextureGridSimulation } from './TextureGridSimulation';

/**
 * Configuration for the simulation executor
 */
export interface ExecutorConfig {
  dt: number;
  yearLength: number;
  rotationsPerYear: number;
}

/**
 * State of the simulation (read-only snapshot)
 */
export interface ExecutorState {
  readonly totalTime: number;
  readonly yearProgress: number;
  readonly rotationDegrees: number;
  readonly currentSubsolarLon: number;
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
  private config: ExecutorConfig;
  private state: ExecutorState;
  private onError?: (error: Error) => void;
  private copyMaterial: THREE.ShaderMaterial;

  constructor(config: ExecutorConfig, onError?: (error: Error) => void) {
    this.config = config;
    this.onError = onError;
    this.state = {
      totalTime: 0,
      yearProgress: 0,
      rotationDegrees: 0,
      currentSubsolarLon: 0, // Start at prime meridian
    };

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
        sourceTexture: { value: null },
      },
    });
  }

  /**
   * Execute a single physics step
   * Updates internal state and returns the new state
   */
  step(): Readonly<ExecutorState> {
    const newTotalTime = this.state.totalTime + this.config.dt;
    const newYearProgress = (newTotalTime % this.config.yearLength) / this.config.yearLength;
    const newRotationDegrees = newYearProgress * this.config.rotationsPerYear * 360;

    // Advance time
    this.state = {
      totalTime: newTotalTime,
      yearProgress: newYearProgress,
      rotationDegrees: newRotationDegrees,
      currentSubsolarLon: newRotationDegrees % 360, // Subsolar longitude advances with planet rotation
    };

    return { ...this.state };
  }

  /**
   * Get current state without advancing
   */
  getState(): Readonly<ExecutorState> {
    return { ...this.state };
  }

  /**
   * Reset the executor to initial state
   */
  reset(): void {
    this.state = {
      totalTime: 0,
      yearProgress: 0,
      rotationDegrees: 0,
      currentSubsolarLon: 0, // Start at prime meridian
    };
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
      radiationMaterial: THREE.ShaderMaterial;
      hydrologyMaterial: THREE.ShaderMaterial;
      diffusionMaterial: THREE.ShaderMaterial;
    },
    mesh: THREE.Mesh,
    scene: THREE.Scene,
    camera: THREE.OrthographicCamera
  ): boolean {
    try {
      const { radiationMaterial, hydrologyMaterial, diffusionMaterial } = materials;

      // ===== 3-PASS PHYSICS ARCHITECTURE =====
      // Pass 1: Combined radiation (shortwave heating + longwave greenhouse effect)
      // Pass 2: Hydrology (water cycle dynamics)
      // Pass 3: Thermal diffusion (conduction between cells)

      // Pass 1: Combined radiation (shortwave + longwave)
      // - Shortwave: Solar flux at TOA and surface heating
      // - Longwave: Surface emission, atmospheric absorption & re-emission (greenhouse effect)
      // Update orbital state uniforms
      radiationMaterial.uniforms.yearProgress.value = this.state.yearProgress;
      radiationMaterial.uniforms.subsolarLon.value = this.state.currentSubsolarLon;
      // Set input textures
      radiationMaterial.uniforms.surfaceData.value = simulation.getClimateDataCurrent().texture;
      radiationMaterial.uniforms.atmosphereData.value =
        simulation.getAtmosphereDataCurrent().texture;
      radiationMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture;

      // Render to MRT (attachment 0 = surface state, attachment 1 = atmosphere state, attachment 2 = solar flux)
      const radiationMRT = simulation.getRadiationMRT();
      mesh.material = radiationMaterial;
      gl.setRenderTarget(radiationMRT);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy MRT outputs to next frame targets
      // MRT attachment 0 → next surface state
      this.copyMaterial.uniforms.sourceTexture.value = radiationMRT.textures[0];
      mesh.material = this.copyMaterial;
      gl.setRenderTarget(simulation.getClimateDataNext());
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // MRT attachment 1 → next atmosphere state
      this.copyMaterial.uniforms.sourceTexture.value = radiationMRT.textures[1];
      gl.setRenderTarget(simulation.getAtmosphereDataNext());
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // MRT attachment 2 → auxiliary target R channel (solar flux, for visualisation)
      this.copyMaterial.uniforms.sourceTexture.value = radiationMRT.textures[2];
      gl.setRenderTarget(simulation.getAuxiliaryTarget());
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Pass 2: Hydrology (water cycle dynamics)
      // - Ice/water phase transitions (freezing and melting)
      // - Latent heat effects on surface temperature
      // - Evaporation from water surfaces (future)
      // - Precipitation from atmosphere (future)
      // Uses MRT to output hydrology state, auxiliary water state, and latent-heat-corrected surface state
      hydrologyMaterial.uniforms.surfaceData.value = radiationMRT.textures[0];
      hydrologyMaterial.uniforms.atmosphereData.value = radiationMRT.textures[1];
      hydrologyMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture;
      hydrologyMaterial.uniforms.auxiliaryData.value = simulation.getAuxiliaryTarget().texture;

      // Render to hydrology MRT (attachment 0 = hydrology state, attachment 1 = auxiliary, attachment 2 = surface state)
      const hydrologyMRT = simulation.getHydrologyMRT();
      mesh.material = hydrologyMaterial;
      gl.setRenderTarget(hydrologyMRT);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy MRT attachment 0 → next hydrology state
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[0];
      mesh.material = this.copyMaterial;
      gl.setRenderTarget(simulation.getHydrologyDataNext());
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy MRT attachment 1 → auxiliary target (contains solar flux + water state)
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[1];
      gl.setRenderTarget(simulation.getAuxiliaryTarget());
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy MRT attachment 2 → next surface state (overwrites longwave output with latent-heat-corrected temperature)
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[2];
      gl.setRenderTarget(simulation.getClimateDataNext());
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy MRT attachment 3 → next atmosphere state (updated pressure and precipitableWater from vaporisation)
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[3];
      gl.setRenderTarget(simulation.getAtmosphereDataNext());
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Pass 3: Thermal diffusion (conduction between cells)
      // - Applies Fourier's law for thermal conduction
      // - Smooths temperature gradients across the planet surface
      // - Uses surface state after hydrology pass
      //
      // To avoid feedback loop, copy current state to working buffer first
      // then read from working buffer and write to next buffer
      this.copyMaterial.uniforms.sourceTexture.value = simulation.getClimateDataNext().texture;
      mesh.material = this.copyMaterial;
      const workingBuffer = simulation.getSurfaceWorkingBuffer(0);
      gl.setRenderTarget(workingBuffer);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Now read from working buffer and write diffused result to next buffer
      diffusionMaterial.uniforms.surfaceData.value = workingBuffer.texture;
      diffusionMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataNext().texture;

      // Render to next surface state (overwrites with diffused temperature)
      mesh.material = diffusionMaterial;
      gl.setRenderTarget(simulation.getClimateDataNext());
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Swap climate, atmosphere, and hydrology pointers for next timestep
      simulation.swapClimateBuffers();
      simulation.swapAtmosphereBuffers();
      simulation.swapHydrologyBuffers();

      return true;
    } catch (error) {
      console.error('[SimulationExecutor] GPU render step failed:', error);
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)));
      }
      return false;
    }
  }
}

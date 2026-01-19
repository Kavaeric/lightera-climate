import * as THREE from 'three';
import type { TextureGridSimulation } from './TextureGridSimulation';
import type { GPUResources } from '../../types/gpu';

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
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D sourceTexture;
        in vec2 vUv;
        out vec4 fragColor;
        void main() {
          fragColor = texture(sourceTexture, vUv);
        }
      `,
      glslVersion: THREE.GLSL3,
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
    gpuResources: GPUResources,
    scene: THREE.Scene,
    camera: THREE.OrthographicCamera
  ): boolean {
    try {
      const mesh = gpuResources.mesh;

      // =========================================================================
      // PASS 1: Radiation (shortwave + longwave)
      // =========================================================================
      // Two-stream radiative transfer through 3 atmospheric layers.
      // - Downward sweep: Solar flux attenuated by each layer.
      // - Upward sweep: Surface emission absorbed/re-emitted by layers.

      const mlRadiationMat = gpuResources.multiLayerRadiationMaterial;

      // Set orbital parameters
      mlRadiationMat.uniforms.yearProgress.value = this.state.yearProgress;
      mlRadiationMat.uniforms.subsolarLon.value = this.state.currentSubsolarLon;

      // Set current state textures
      mlRadiationMat.uniforms.surfaceData.value = simulation.getClimateDataCurrent().texture;
      mlRadiationMat.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture;

      // Set all layer textures
      mlRadiationMat.uniforms.layer0ThermoData.value = simulation.getLayerThermoCurrent(0).texture;
      mlRadiationMat.uniforms.layer1ThermoData.value = simulation.getLayerThermoCurrent(1).texture;
      mlRadiationMat.uniforms.layer2ThermoData.value = simulation.getLayerThermoCurrent(2).texture;
      mlRadiationMat.uniforms.layer0DynamicsData.value =
        simulation.getLayerDynamicsCurrent(0).texture;
      mlRadiationMat.uniforms.layer1DynamicsData.value =
        simulation.getLayerDynamicsCurrent(1).texture;
      mlRadiationMat.uniforms.layer2DynamicsData.value =
        simulation.getLayerDynamicsCurrent(2).texture;

      mesh.material = mlRadiationMat;

      // Render to MRT (5 outputs: surface + 3 layer thermos + auxiliary)
      const mlRadiationMRT = simulation.getMultiLayerRadiationMRT();
      gl.setRenderTarget(mlRadiationMRT);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy outputs to next-frame buffers
      mesh.material = this.copyMaterial;

      // Copy surface state (attachment 0)
      this.copyMaterial.uniforms.sourceTexture.value = mlRadiationMRT.textures[0];
      gl.setRenderTarget(simulation.getClimateDataNext());
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy layer 0-2 thermo (attachments 1-3)
      for (let i = 0; i < 3; i++) {
        this.copyMaterial.uniforms.sourceTexture.value = mlRadiationMRT.textures[1 + i];
        gl.setRenderTarget(simulation.getLayerThermoNext(i));
        gl.render(scene, camera);
        gl.setRenderTarget(null);
      }

      // Copy auxiliary (attachment 4)
      this.copyMaterial.uniforms.sourceTexture.value = mlRadiationMRT.textures[4];
      gl.setRenderTarget(simulation.getAuxiliaryTarget());
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // =========================================================================
      // PASS 2: Hydrology
      // =========================================================================
      // Water cycle with boundary layer (layer 0) interaction.
      // - Evaporation adds humidity to layer 0.
      // - Phase transitions (ice/water) with latent heat.

      const mlHydrologyMat = gpuResources.multiLayerHydrologyMaterial;

      // Set state textures (read from "next" buffers written by radiation)
      mlHydrologyMat.uniforms.surfaceData.value = simulation.getClimateDataNext().texture;
      mlHydrologyMat.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture;
      mlHydrologyMat.uniforms.auxiliaryData.value = simulation.getAuxiliaryTarget().texture;
      mlHydrologyMat.uniforms.layer0ThermoData.value = simulation.getLayerThermoNext(0).texture;

      mesh.material = mlHydrologyMat;

      // Render to MRT (4 outputs: hydrology + auxiliary + surface + layer0 thermo)
      const hydrologyMRT = simulation.getHydrologyMRT();
      gl.setRenderTarget(hydrologyMRT);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy outputs
      mesh.material = this.copyMaterial;

      // Copy hydrology (attachment 0)
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[0];
      gl.setRenderTarget(simulation.getHydrologyDataNext());
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy auxiliary (attachment 1)
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[1];
      gl.setRenderTarget(simulation.getAuxiliaryTarget());
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy surface (attachment 2) - latent heat corrected
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[2];
      gl.setRenderTarget(simulation.getClimateDataNext());
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy layer 0 thermo (attachment 3) - updated humidity
      this.copyMaterial.uniforms.sourceTexture.value = hydrologyMRT.textures[3];
      gl.setRenderTarget(simulation.getLayerThermoNext(0));
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // =========================================================================
      // PASS 3: Vertical mixing (convection + clouds)
      // =========================================================================
      // Convective adjustment and cloud parameterization
      // - Mix temperatures when lapse rate exceeds adiabatic limit.
      // - Transport moisture upward during convection.
      // - Update cloud fractions based on relative humidity.

      const vmMat = gpuResources.verticalMixingMaterial;

      // Set all layer textures (read from "next" buffers)
      vmMat.uniforms.layer0ThermoData.value = simulation.getLayerThermoNext(0).texture;
      vmMat.uniforms.layer1ThermoData.value = simulation.getLayerThermoNext(1).texture;
      vmMat.uniforms.layer2ThermoData.value = simulation.getLayerThermoNext(2).texture;
      vmMat.uniforms.layer0DynamicsData.value = simulation.getLayerDynamicsCurrent(0).texture;
      vmMat.uniforms.layer1DynamicsData.value = simulation.getLayerDynamicsCurrent(1).texture;
      vmMat.uniforms.layer2DynamicsData.value = simulation.getLayerDynamicsCurrent(2).texture;

      mesh.material = vmMat;

      // Render to MRT (6 outputs: 3 thermos + 3 dynamics)
      const vmMRT = simulation.getVerticalMixingMRT();
      gl.setRenderTarget(vmMRT);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Copy outputs
      mesh.material = this.copyMaterial;

      // Copy layer 0-2 thermo (attachments 0-2)
      for (let i = 0; i < 3; i++) {
        this.copyMaterial.uniforms.sourceTexture.value = vmMRT.textures[i];
        gl.setRenderTarget(simulation.getLayerThermoNext(i));
        gl.render(scene, camera);
        gl.setRenderTarget(null);
      }

      // Copy layer 0-2 dynamics (attachments 3-5)
      for (let i = 0; i < 3; i++) {
        this.copyMaterial.uniforms.sourceTexture.value = vmMRT.textures[3 + i];
        gl.setRenderTarget(simulation.getLayerDynamicsNext(i));
        gl.render(scene, camera);
        gl.setRenderTarget(null);
      }

      // =========================================================================
      // PASS 4: Thermal diffusion (surface only)
      // =========================================================================
      // Horizontal heat conduction between surface cells

      const diffusionMat = gpuResources.diffusionMaterial;

      // Copy surface state to working buffer to avoid feedback
      this.copyMaterial.uniforms.sourceTexture.value = simulation.getClimateDataNext().texture;
      mesh.material = this.copyMaterial;
      const workingBuffer = simulation.getSurfaceWorkingBuffer(0);
      gl.setRenderTarget(workingBuffer);
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Read from working buffer and write diffused result
      diffusionMat.uniforms.surfaceData.value = workingBuffer.texture;
      diffusionMat.uniforms.hydrologyData.value = simulation.getHydrologyDataNext().texture;

      mesh.material = diffusionMat;
      gl.setRenderTarget(simulation.getClimateDataNext());
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // =========================================================================
      // BUFFER SWAPPING
      // =========================================================================

      simulation.swapClimateBuffers();
      simulation.swapHydrologyBuffers();
      simulation.swapMultiLayerAtmosphereBuffers();

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

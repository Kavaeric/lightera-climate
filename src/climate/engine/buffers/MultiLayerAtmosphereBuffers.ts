import * as THREE from 'three';
import { RenderTargetFactory } from './RenderTargetFactory';
import { NUM_ATMOSPHERE_LAYERS } from '../../schema/atmosphereLayerSchema';

/**
 * Per-layer buffer pair for ping-pong rendering.
 */
interface LayerBufferPair {
  /** Thermodynamic state: RGBA = [temperature, pressure, humidity, cloudFraction] */
  thermo: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  /** Dynamics state: RGBA = [windU, windV, omega, reserved] */
  dynamics: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
}

/**
 * Manages multi-layer atmosphere ping-pong buffers.
 *
 * Each atmospheric layer has two texture types:
 * - Thermo: thermodynamic state (temperature, pressure, humidity, cloud fraction)
 * - Dynamics: wind and vertical motion (u, v, omega)
 *
 * Each texture type has a ping-pong pair for frame-to-frame updates.
 *
 * Total textures: 3 layers × 2 types × 2 (ping-pong) = 12 render targets
 */
export class MultiLayerAtmosphereBuffers {
  private layers: LayerBufferPair[];
  private currentIndex: 0 | 1 = 0;

  constructor(factory: RenderTargetFactory) {
    this.layers = [];

    for (let i = 0; i < NUM_ATMOSPHERE_LAYERS; i++) {
      this.layers.push({
        thermo: [factory.createRenderTarget(), factory.createRenderTarget()],
        dynamics: [factory.createRenderTarget(), factory.createRenderTarget()],
      });
    }
  }

  /**
   * Get the current thermo texture for a layer (for reading in shaders).
   */
  getLayerThermoCurrent(layerIndex: number): THREE.WebGLRenderTarget {
    this.validateLayerIndex(layerIndex);
    return this.layers[layerIndex].thermo[this.currentIndex];
  }

  /**
   * Get the next thermo texture for a layer (for writing in shaders).
   */
  getLayerThermoNext(layerIndex: number): THREE.WebGLRenderTarget {
    this.validateLayerIndex(layerIndex);
    return this.layers[layerIndex].thermo[1 - this.currentIndex];
  }

  /**
   * Get the current dynamics texture for a layer (for reading in shaders).
   */
  getLayerDynamicsCurrent(layerIndex: number): THREE.WebGLRenderTarget {
    this.validateLayerIndex(layerIndex);
    return this.layers[layerIndex].dynamics[this.currentIndex];
  }

  /**
   * Get the next dynamics texture for a layer (for writing in shaders).
   */
  getLayerDynamicsNext(layerIndex: number): THREE.WebGLRenderTarget {
    this.validateLayerIndex(layerIndex);
    return this.layers[layerIndex].dynamics[1 - this.currentIndex];
  }

  /**
   * Get all current thermo textures as an array.
   * Useful for binding to shader uniforms.
   */
  getAllThermoCurrentTextures(): THREE.Texture[] {
    return this.layers.map(layer => layer.thermo[this.currentIndex].texture);
  }

  /**
   * Get all current dynamics textures as an array.
   * Useful for binding to shader uniforms.
   */
  getAllDynamicsCurrentTextures(): THREE.Texture[] {
    return this.layers.map(layer => layer.dynamics[this.currentIndex].texture);
  }

  /**
   * Swap all buffers for next frame.
   * After this call, "next" becomes "current" and vice versa.
   */
  swapAll(): void {
    this.currentIndex = (1 - this.currentIndex) as 0 | 1;
  }

  /**
   * Get the number of layers.
   */
  getLayerCount(): number {
    return NUM_ATMOSPHERE_LAYERS;
  }

  /**
   * Dispose all render targets.
   */
  dispose(): void {
    for (const layer of this.layers) {
      layer.thermo[0].dispose();
      layer.thermo[1].dispose();
      layer.dynamics[0].dispose();
      layer.dynamics[1].dispose();
    }
    this.layers = [];
  }

  private validateLayerIndex(layerIndex: number): void {
    if (layerIndex < 0 || layerIndex >= NUM_ATMOSPHERE_LAYERS) {
      throw new Error(
        `Invalid layer index ${layerIndex}. Must be 0-${NUM_ATMOSPHERE_LAYERS - 1}`
      );
    }
  }
}

import * as THREE from 'three';
import { RenderTargetFactory } from './RenderTargetFactory';

/**
 * Manages atmosphere data ping-pong buffers.
 * Format: RGBA = [atmosphereTemperature, pressure, precipitableWater, albedo]
 */
export class AtmosphereBuffers {
  private targets: THREE.WebGLRenderTarget[];
  private workingBuffers: THREE.WebGLRenderTarget[];

  constructor(factory: RenderTargetFactory) {
    // Create atmosphere data storage (two render targets: current and next frame)
    this.targets = [factory.createRenderTarget(), factory.createRenderTarget()];

    // Create working buffers for pass-based architecture
    this.workingBuffers = [factory.createRenderTarget(), factory.createRenderTarget()];
  }

  /**
   * Get the current atmosphere render target (for reading in shaders).
   */
  getCurrent(): THREE.WebGLRenderTarget {
    return this.targets[0];
  }

  /**
   * Get the next atmosphere render target (for writing in shaders).
   */
  getNext(): THREE.WebGLRenderTarget {
    return this.targets[1];
  }

  /**
   * Swap atmosphere buffers for next frame.
   */
  swap(): void {
    const temp = this.targets[0];
    this.targets[0] = this.targets[1];
    this.targets[1] = temp;
  }

  /**
   * Get working buffer (for pass-based architecture).
   */
  getWorkingBuffer(index: 0 | 1): THREE.WebGLRenderTarget {
    return this.workingBuffers[index];
  }

  dispose(): void {
    for (const target of this.targets) {
      target.dispose();
    }
    for (const target of this.workingBuffers) {
      target.dispose();
    }
  }
}

import * as THREE from 'three';
import { RenderTargetFactory } from './RenderTargetFactory';

/**
 * Manages climate/surface data ping-pong buffers.
 * Format: RGBA = [surfaceTemperature, reserved, reserved, albedo]
 */
export class ClimateBuffers {
  private targets: THREE.WebGLRenderTarget[];
  private workingBuffers: THREE.WebGLRenderTarget[];

  constructor(factory: RenderTargetFactory) {
    // Create surface/climate data storage (two render targets: current and next frame)
    this.targets = [factory.createRenderTarget(), factory.createRenderTarget()];

    // Create working buffers for pass-based architecture
    this.workingBuffers = [factory.createRenderTarget(), factory.createRenderTarget()];
  }

  /**
   * Get the current climate render target (for reading in shaders).
   */
  getCurrent(): THREE.WebGLRenderTarget {
    return this.targets[0];
  }

  /**
   * Get the next climate render target (for writing in shaders).
   */
  getNext(): THREE.WebGLRenderTarget {
    return this.targets[1];
  }

  /**
   * Swap climate buffers for next frame.
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

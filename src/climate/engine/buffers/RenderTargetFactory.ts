import * as THREE from 'three';

/**
 * Factory for creating GPU render targets
 * Centralises render target configuration for consistency
 */
export class RenderTargetFactory {
  private textureWidth: number;
  private textureHeight: number;

  constructor(textureWidth: number, textureHeight: number) {
    this.textureWidth = textureWidth;
    this.textureHeight = textureHeight;
  }

  /**
   * Create a standard render target for GPU computation
   */
  createRenderTarget(): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(this.textureWidth, this.textureHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    });
  }

  /**
   * Create MRT for surface + atmosphere outputs
   * Outputs: [0] surface state, [1] atmosphere state
   */
  createSurfaceAtmosphereMRT(): THREE.WebGLRenderTarget<THREE.Texture[]> {
    const mrt = new THREE.WebGLRenderTarget(this.textureWidth, this.textureHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      count: 2, // Number of draw buffers (MRT count)
    });

    return mrt as unknown as THREE.WebGLRenderTarget<THREE.Texture[]>;
  }

  /**
   * Create MRT for combined radiation pass (shortwave + longwave)
   * Outputs: [0] surface state, [1] atmosphere state, [2] solar flux (auxiliary)
   */
  createRadiationMRT(): THREE.WebGLRenderTarget<THREE.Texture[]> {
    const mrt = new THREE.WebGLRenderTarget(this.textureWidth, this.textureHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      count: 3, // Number of draw buffers: surface + atmosphere + solar flux
    });

    return mrt as unknown as THREE.WebGLRenderTarget<THREE.Texture[]>;
  }

  /**
   * Create a 3-attachment MRT for hydrology pass
   * Outputs: [0] hydrology state, [1] auxiliary data, [2] surface state with latent heat correction
   */
  createHydrologyMRT(): THREE.WebGLRenderTarget<THREE.Texture[]> {
    const mrt = new THREE.WebGLRenderTarget(this.textureWidth, this.textureHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      count: 3, // Number of draw buffers: hydrology + auxiliary + surface
    });

    return mrt as unknown as THREE.WebGLRenderTarget<THREE.Texture[]>;
  }

  getTextureWidth(): number {
    return this.textureWidth;
  }

  getTextureHeight(): number {
    return this.textureHeight;
  }
}

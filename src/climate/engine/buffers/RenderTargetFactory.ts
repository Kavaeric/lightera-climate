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
   * Create a 4-attachment MRT for hydrology pass
   * Outputs: [0] hydrology state, [1] auxiliary data, [2] surface state with latent heat correction, [3] atmosphere state
   */
  createHydrologyMRT(): THREE.WebGLRenderTarget<THREE.Texture[]> {
    const mrt = new THREE.WebGLRenderTarget(this.textureWidth, this.textureHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      count: 4, // Number of draw buffers: hydrology + auxiliary + surface + atmosphere
    });

    return mrt as unknown as THREE.WebGLRenderTarget<THREE.Texture[]>;
  }

  /**
   * Create MRT for multi-layer radiation pass.
   * Outputs: [0] surface, [1-3] layer thermo states, [4] auxiliary
   *
   * Layout:
   * - Attachment 0: Surface state (temperature, albedo)
   * - Attachment 1: Layer 0 thermo (boundary layer)
   * - Attachment 2: Layer 1 thermo (troposphere)
   * - Attachment 3: Layer 2 thermo (stratosphere)
   * - Attachment 4: Auxiliary (solar flux, diagnostics)
   */
  createMultiLayerRadiationMRT(): THREE.WebGLRenderTarget<THREE.Texture[]> {
    const mrt = new THREE.WebGLRenderTarget(this.textureWidth, this.textureHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      count: 5, // surface + 3 layer thermos + auxiliary
    });

    return mrt as unknown as THREE.WebGLRenderTarget<THREE.Texture[]>;
  }

  /**
   * Create MRT for vertical mixing pass.
   * Outputs all layer states (both thermo and dynamics).
   *
   * Layout:
   * - Attachment 0-2: Layer 0-2 thermo states
   * - Attachment 3-5: Layer 0-2 dynamics states
   */
  createVerticalMixingMRT(): THREE.WebGLRenderTarget<THREE.Texture[]> {
    const mrt = new THREE.WebGLRenderTarget(this.textureWidth, this.textureHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      count: 6, // 3 thermo + 3 dynamics
    });

    return mrt as unknown as THREE.WebGLRenderTarget<THREE.Texture[]>;
  }

  /**
   * Create MRT for multi-layer initialisation pass.
   * Outputs: surface + hydrology + all layer states
   *
   * Layout:
   * - Attachment 0: Surface state
   * - Attachment 1: Hydrology state
   * - Attachment 2-4: Layer 0-2 thermo states
   * - Attachment 5-7: Layer 0-2 dynamics states
   */
  createMultiLayerInitMRT(): THREE.WebGLRenderTarget<THREE.Texture[]> {
    const mrt = new THREE.WebGLRenderTarget(this.textureWidth, this.textureHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      count: 8, // surface + hydrology + 3 thermo + 3 dynamics
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

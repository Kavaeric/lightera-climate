import * as THREE from 'three';
import { RenderTargetFactory } from './RenderTargetFactory';
import { indexTo2D, coordsToDataIndex } from '../grid/CellAccessors';
import { DEPTH_QUANTUM } from '../../../config/simulationConfig';

/**
 * Manages hydrology data ping-pong buffers and initialisation
 * Format: RGBA = [waterDepth, iceThickness, unused, salinity]
 */
export class HydrologyBuffers {
  private targets: THREE.WebGLRenderTarget[];
  private textureWidth: number;
  private textureHeight: number;
  private cellCount: number;

  // Hydrology initialisation data (temporary storage for setHydrologyData)
  private initData: { waterDepth: number[]; salinity: number[]; iceThickness: number[] } | null =
    null;

  constructor(factory: RenderTargetFactory, cellCount: number) {
    this.textureWidth = factory.getTextureWidth();
    this.textureHeight = factory.getTextureHeight();
    this.cellCount = cellCount;

    // Create hydrology data storage (two render targets: current and next frame)
    this.targets = [factory.createRenderTarget(), factory.createRenderTarget()];
  }

  /**
   * Get the current hydrology render target (for reading in shaders)
   */
  getCurrent(): THREE.WebGLRenderTarget {
    return this.targets[0];
  }

  /**
   * Get the next hydrology render target (for writing in shaders)
   */
  getNext(): THREE.WebGLRenderTarget {
    return this.targets[1];
  }

  /**
   * Swap hydrology buffers for next frame
   */
  swap(): void {
    const temp = this.targets[0];
    this.targets[0] = this.targets[1];
    this.targets[1] = temp;
  }

  /**
   * Set initial hydrology state (water depth, salinity, ice thickness)
   * Stores the initialisation data for later use by the simulation engine
   */
  setInitData(waterDepth: number[], salinity: number[], iceThickness: number[]): void {
    if (
      waterDepth.length !== this.cellCount ||
      salinity.length !== this.cellCount ||
      iceThickness.length !== this.cellCount
    ) {
      console.error(
        `Hydrology config has mismatched cell counts but simulation has ${this.cellCount} cells`
      );
      return;
    }

    this.initData = { waterDepth, salinity, iceThickness };
  }

  /**
   * Get hydrology initialisation data (for shader initialisation)
   */
  getInitData(): { waterDepth: number[]; salinity: number[]; iceThickness: number[] } | null {
    return this.initData;
  }

  /**
   * Create the initial hydrology data texture
   * Called by ClimateSimulationEngine to initialise render targets
   */
  createInitialTexture(): THREE.DataTexture {
    const { waterDepth, salinity, iceThickness } = this.initData || {
      waterDepth: new Array(this.cellCount).fill(0),
      salinity: new Array(this.cellCount).fill(0),
      iceThickness: new Array(this.cellCount).fill(0),
    };

    // Create hydrology data texture
    // RGBA = [waterDepth, iceThickness, unused, salinity]
    const hydrologyData = new Float32Array(this.textureWidth * this.textureHeight * 4);
    for (let i = 0; i < this.cellCount; i++) {
      const coords = indexTo2D(i, this.textureWidth);
      const dataIndex = coordsToDataIndex(coords.x, coords.y, this.textureWidth, 4);

      // Quantise water and ice depths to 0.1m increments
      const quantisedIce = Math.round(iceThickness[i] / DEPTH_QUANTUM) * DEPTH_QUANTUM;
      const quantisedWater = Math.round(waterDepth[i] / DEPTH_QUANTUM) * DEPTH_QUANTUM;

      hydrologyData[dataIndex + 0] = quantisedWater; // R = waterDepth (quantised)
      hydrologyData[dataIndex + 1] = quantisedIce; // G = iceThickness (quantised)
      hydrologyData[dataIndex + 2] = 0; // B = unused
      hydrologyData[dataIndex + 3] = salinity[i]; // A = salinity
    }

    const hydrologyTexture = new THREE.DataTexture(
      hydrologyData,
      this.textureWidth,
      this.textureHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    hydrologyTexture.minFilter = THREE.NearestFilter;
    hydrologyTexture.magFilter = THREE.NearestFilter;
    hydrologyTexture.wrapS = THREE.ClampToEdgeWrapping;
    hydrologyTexture.wrapT = THREE.ClampToEdgeWrapping;
    hydrologyTexture.needsUpdate = true;

    return hydrologyTexture;
  }

  dispose(): void {
    for (const target of this.targets) {
      target.dispose();
    }
  }
}

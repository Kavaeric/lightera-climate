import * as THREE from 'three';
import type { SimulationConfig } from '../../config/simulationConfig';
import type { TerrainConfig } from '../../config/terrainConfig';

// Sub-modules
import { GridTextureManager } from './grid';
import {
  RenderTargetFactory,
  ClimateBuffers,
  AtmosphereBuffers,
  HydrologyBuffers,
} from './buffers';
import { TerrainTextureManager } from './terrain';
import { GPUReadback } from './readback';

/**
 * Climate simulation for a geodesic grid sphere.
 * Stores climate data (surface temperature, etc.) over time for each cell.
 *
 * This class orchestrates sub-modules for different concerns:
 * - GridTextureManager: Static grid topology (neighbours, cell positions).
 * - ClimateBuffers: Surface/climate ping-pong buffers.
 * - AtmosphereBuffers: Atmosphere ping-pong buffers.
 * - HydrologyBuffers: Hydrology ping-pong buffers.
 * - TerrainTextureManager: Static terrain data.
 * - GPUReadback: Async GPU -> CPU data reading.
 */
export class TextureGridSimulation {
  // Sub-modules
  private readonly gridManager: GridTextureManager;
  private readonly renderTargetFactory: RenderTargetFactory;
  private readonly climateBuffers: ClimateBuffers;
  private readonly atmosphereBuffers: AtmosphereBuffers;
  private readonly hydrologyBuffers: HydrologyBuffers;
  private readonly terrainManager: TerrainTextureManager;
  private readonly gpuReadback: GPUReadback;

  // Expose grid textures for shader access
  public get neighbourIndices1(): THREE.DataTexture {
    return this.gridManager.neighbourIndices1;
  }
  public get neighbourIndices2(): THREE.DataTexture {
    return this.gridManager.neighbourIndices2;
  }
  public get neighbourCounts(): THREE.DataTexture {
    return this.gridManager.neighbourCounts;
  }
  public get cellInformation(): THREE.DataTexture {
    return this.gridManager.cellInformation;
  }
  public get terrainData(): THREE.DataTexture {
    return this.terrainManager.terrainData;
  }

  // Auxiliary data storage: Single render target (recalculated each step, no ping-pong needed)
  // Not used in physics pipeline - available for visualisation/diagnostics
  // RGBA = [solarFlux (W/m²), surfaceNetPower (W/m²), atmosphereNetPower (W/m²), reserved]
  public auxiliaryTarget: THREE.WebGLRenderTarget | null = null;

  // MRT for combined radiation pass (shortwave + longwave)
  // Outputs: [0] surface state, [1] atmosphere state, [2] solar flux (auxiliary)
  public radiationMRT: THREE.WebGLRenderTarget<THREE.Texture[]> | null = null;

  // MRT for hydrology pass (outputs hydrology state + auxiliary water state)
  public hydrologyMRT: THREE.WebGLRenderTarget<THREE.Texture[]> | null = null;

  constructor(config: SimulationConfig) {
    // Initialise grid manager (topology)
    this.gridManager = new GridTextureManager(config.resolution);

    const textureWidth = this.gridManager.getTextureWidth();
    const textureHeight = this.gridManager.getTextureHeight();
    const cellCount = this.gridManager.getCellCount();

    // Log memory usage
    const totalMemoryMB = (textureWidth * textureHeight * 4 * 4 * 4) / (1024 * 1024);
    console.log(`TextureGridSimulation: ${cellCount} cells`);
    console.log(
      `Texture size: ${textureWidth}x${textureHeight}, Total memory: ${totalMemoryMB.toFixed(1)}MB`
    );

    // Initialise render target factory
    this.renderTargetFactory = new RenderTargetFactory(textureWidth, textureHeight);

    // Initialise buffer managers
    this.climateBuffers = new ClimateBuffers(this.renderTargetFactory);
    this.atmosphereBuffers = new AtmosphereBuffers(this.renderTargetFactory);
    this.hydrologyBuffers = new HydrologyBuffers(this.renderTargetFactory, cellCount);

    // Initialise terrain manager
    this.terrainManager = new TerrainTextureManager(textureWidth, textureHeight, cellCount);

    // Initialise GPU readback
    this.gpuReadback = new GPUReadback(textureWidth);

    // Create auxiliary data storage (single target, no ping-pong)
    this.auxiliaryTarget = this.renderTargetFactory.createRenderTarget();

    // Create MRTs
    this.radiationMRT = this.renderTargetFactory.createRadiationMRT();
    this.hydrologyMRT = this.renderTargetFactory.createHydrologyMRT();
  }

  // =====================
  // Terrain methods
  // =====================

  /**
   * Update terrain data from a TerrainConfig (elevation only)
   */
  public setTerrainData(terrain: TerrainConfig): void {
    this.terrainManager.setTerrainData(terrain);
  }

  // =====================
  // Hydrology methods
  // =====================

  /**
   * Set initial hydrology state (water depth, salinity, ice thickness)
   */
  public setHydrologyData(waterDepth: number[], salinity: number[], iceThickness: number[]): void {
    this.hydrologyBuffers.setInitData(waterDepth, salinity, iceThickness);
  }

  /**
   * Create the initial hydrology data texture
   */
  public createInitialHydrologyTexture(): THREE.DataTexture {
    return this.hydrologyBuffers.createInitialTexture();
  }

  /**
   * Get hydrology initialisation data
   */
  public getHydrologyInitData(): {
    waterDepth: number[];
    salinity: number[];
    iceThickness: number[];
  } | null {
    return this.hydrologyBuffers.getInitData();
  }

  public getHydrologyDataCurrent(): THREE.WebGLRenderTarget {
    return this.hydrologyBuffers.getCurrent();
  }

  public getHydrologyDataNext(): THREE.WebGLRenderTarget {
    return this.hydrologyBuffers.getNext();
  }

  public swapHydrologyBuffers(): void {
    this.hydrologyBuffers.swap();
  }

  // =====================
  // Climate/Surface methods
  // =====================

  public getClimateDataCurrent(): THREE.WebGLRenderTarget {
    return this.climateBuffers.getCurrent();
  }

  public getClimateDataNext(): THREE.WebGLRenderTarget {
    return this.climateBuffers.getNext();
  }

  public swapClimateBuffers(): void {
    this.climateBuffers.swap();
  }

  public getSurfaceWorkingBuffer(index: 0 | 1): THREE.WebGLRenderTarget {
    return this.climateBuffers.getWorkingBuffer(index);
  }

  // =====================
  // Atmosphere methods
  // =====================

  public getAtmosphereDataCurrent(): THREE.WebGLRenderTarget {
    return this.atmosphereBuffers.getCurrent();
  }

  public getAtmosphereDataNext(): THREE.WebGLRenderTarget {
    return this.atmosphereBuffers.getNext();
  }

  public swapAtmosphereBuffers(): void {
    this.atmosphereBuffers.swap();
  }

  public getAtmosphereWorkingBuffer(index: 0 | 1): THREE.WebGLRenderTarget {
    return this.atmosphereBuffers.getWorkingBuffer(index);
  }

  // =====================
  // Auxiliary/MRT methods
  // =====================

  public getAuxiliaryTarget(): THREE.WebGLRenderTarget {
    if (!this.auxiliaryTarget) {
      throw new Error('Auxiliary target not initialised');
    }
    return this.auxiliaryTarget;
  }

  public getRadiationMRT(): THREE.WebGLRenderTarget<THREE.Texture[]> {
    if (!this.radiationMRT) {
      throw new Error('Radiation MRT not initialised');
    }
    return this.radiationMRT;
  }

  public getHydrologyMRT(): THREE.WebGLRenderTarget<THREE.Texture[]> {
    if (!this.hydrologyMRT) {
      throw new Error('Hydrology MRT not initialised');
    }
    return this.hydrologyMRT;
  }

  // =====================
  // Dimension accessors
  // =====================

  getTextureWidth(): number {
    return this.gridManager.getTextureWidth();
  }

  getTextureHeight(): number {
    return this.gridManager.getTextureHeight();
  }

  getCellCount(): number {
    return this.gridManager.getCellCount();
  }

  getCellUV(cellIndex: number): [number, number] {
    return this.gridManager.getCellUV(cellIndex);
  }

  getCellLatLon(cellIndex: number): { lat: number; lon: number } {
    return this.gridManager.getCellLatLon(cellIndex);
  }

  getCellArea(cellIndex: number): number {
    return this.gridManager.getCellArea(cellIndex);
  }

  // =====================
  // GPU Readback methods
  // =====================

  async getSurfaceTemperature(cellIndex: number, renderer: THREE.WebGLRenderer): Promise<number> {
    return this.gpuReadback.getSurfaceTemperature(
      cellIndex,
      renderer,
      this.climateBuffers.getCurrent()
    );
  }

  async getClimateDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<{ surfaceTemperature: number }> {
    return this.gpuReadback.getClimateDataForCell(
      cellIndex,
      renderer,
      this.climateBuffers.getCurrent()
    );
  }

  async getHydrologyDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<{ waterDepth: number; iceThickness: number; salinity: number }> {
    return this.gpuReadback.getHydrologyDataForCell(
      cellIndex,
      renderer,
      this.hydrologyBuffers.getCurrent()
    );
  }

  async getSurfaceDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<{ albedo: number }> {
    return this.gpuReadback.getSurfaceDataForCell(
      cellIndex,
      renderer,
      this.climateBuffers.getCurrent()
    );
  }

  async getAtmosphereDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<{ atmosphericTemperature: number; pressure: number; precipitableWater: number }> {
    return this.gpuReadback.getAtmosphereDataForCell(
      cellIndex,
      renderer,
      this.atmosphereBuffers.getCurrent()
    );
  }

  async getAuxiliaryDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer
  ): Promise<{ solarFlux: number; surfaceNetPower: number; atmosphereNetPower: number }> {
    return this.gpuReadback.getAuxiliaryDataForCell(
      cellIndex,
      renderer,
      this.getAuxiliaryTarget()
    );
  }

  getTerrainDataForCell(cellIndex: number): { elevation: number } {
    return this.terrainManager.getTerrainDataForCell(cellIndex);
  }

  // =====================
  // Cleanup
  // =====================

  dispose(): void {
    this.gridManager.dispose();
    this.climateBuffers.dispose();
    this.atmosphereBuffers.dispose();
    this.hydrologyBuffers.dispose();
    this.terrainManager.dispose();

    if (this.auxiliaryTarget) {
      this.auxiliaryTarget.dispose();
    }
    if (this.radiationMRT) {
      this.radiationMRT.dispose();
    }
    if (this.hydrologyMRT) {
      this.hydrologyMRT.dispose();
    }
  }
}

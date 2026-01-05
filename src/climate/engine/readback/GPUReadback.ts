import * as THREE from 'three';
import { indexTo2D } from '../grid/CellAccessors';

/**
 * Handles all GPU -> CPU readback operations
 * Centralises async texture reading for debugging and UI display
 */
export class GPUReadback {
  private textureWidth: number;

  constructor(textureWidth: number) {
    this.textureWidth = textureWidth;
  }

  /**
   * Read back current surface temperature value from GPU for a specific cell
   */
  async getSurfaceTemperature(
    cellIndex: number,
    renderer: THREE.WebGLRenderer,
    climateTarget: THREE.WebGLRenderTarget
  ): Promise<number> {
    const buffer = new Float32Array(4);
    const coords = indexTo2D(cellIndex, this.textureWidth);

    // Read a single pixel
    renderer.readRenderTargetPixels(climateTarget, coords.x, coords.y, 1, 1, buffer);

    return buffer[0]; // R channel = surfaceTemperature
  }

  /**
   * Read back current climate data for a specific cell
   */
  async getClimateDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer,
    climateTarget: THREE.WebGLRenderTarget
  ): Promise<{ surfaceTemperature: number }> {
    const coords = indexTo2D(cellIndex, this.textureWidth);
    const buffer = new Float32Array(4);

    renderer.readRenderTargetPixels(climateTarget, coords.x, coords.y, 1, 1, buffer);

    return {
      surfaceTemperature: buffer[0],
    };
  }

  /**
   * Read back current hydrology data (water depth, ice thickness, salinity) for a specific cell
   */
  async getHydrologyDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer,
    hydrologyTarget: THREE.WebGLRenderTarget
  ): Promise<{ waterDepth: number; iceThickness: number; salinity: number }> {
    const coords = indexTo2D(cellIndex, this.textureWidth);
    const buffer = new Float32Array(4);

    renderer.readRenderTargetPixels(hydrologyTarget, coords.x, coords.y, 1, 1, buffer);

    return {
      waterDepth: buffer[0], // R channel
      iceThickness: buffer[1], // G channel
      salinity: buffer[3], // A channel
    };
  }

  /**
   * Read back current surface data (effective albedo) for a specific cell
   */
  async getSurfaceDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer,
    climateTarget: THREE.WebGLRenderTarget
  ): Promise<{ albedo: number }> {
    const coords = indexTo2D(cellIndex, this.textureWidth);
    const buffer = new Float32Array(4);

    // Surface data (surface temperature + albedo) is now stored in climate texture
    // R = surfaceTemperature, A = albedo
    renderer.readRenderTargetPixels(climateTarget, coords.x, coords.y, 1, 1, buffer);

    return {
      albedo: buffer[3], // A channel = effectiveAlbedo
    };
  }

  /**
   * Read back current atmosphere data for a specific cell
   * Format: RGBA = [atmosphereTemperature, pressure, precipitableWater, albedo]
   */
  async getAtmosphereDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer,
    atmosphereTarget: THREE.WebGLRenderTarget
  ): Promise<{ atmosphericTemperature: number; pressure: number; precipitableWater: number }> {
    const coords = indexTo2D(cellIndex, this.textureWidth);
    const buffer = new Float32Array(4);

    renderer.readRenderTargetPixels(atmosphereTarget, coords.x, coords.y, 1, 1, buffer);

    return {
      atmosphericTemperature: buffer[0], // R channel = atmosphericTemperature
      pressure: buffer[1], // G channel = pressure (Pa)
      precipitableWater: buffer[2], // B channel = precipitableWater (mm)
    };
  }

  /**
   * Read back current auxiliary data (energy fluxes) for a specific cell
   * Format: RGBA = [solarFlux, surfaceNetPower, atmosphereNetPower, reserved]
   */
  async getAuxiliaryDataForCell(
    cellIndex: number,
    renderer: THREE.WebGLRenderer,
    auxiliaryTarget: THREE.WebGLRenderTarget
  ): Promise<{ solarFlux: number; surfaceNetPower: number; atmosphereNetPower: number }> {
    const coords = indexTo2D(cellIndex, this.textureWidth);
    const buffer = new Float32Array(4);

    renderer.readRenderTargetPixels(auxiliaryTarget, coords.x, coords.y, 1, 1, buffer);

    return {
      solarFlux: buffer[0],           // R channel = solar flux at TOA (W/m²)
      surfaceNetPower: buffer[1],     // G channel = surface net power (W/m²)
      atmosphereNetPower: buffer[2],  // B channel = atmosphere net power (W/m²)
      // A channel reserved for future use
    };
  }
}

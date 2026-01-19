/**
 * Visualisation mode types.
 * Used by the display system to configure different data views.
 */

import * as THREE from 'three';
import type { ColourmapDefinition } from '../rendering/colourmaps';
import type { DisplayConfig } from '../config/displayConfig';

// Forward declaration to avoid circular dependency
// TextureGridSimulation is imported dynamically in visualisationModes.ts
export type TextureGridSimulationLike = {
  terrainData: THREE.DataTexture;
  getHydrologyDataCurrent(): THREE.WebGLRenderTarget;
  getClimateDataCurrent(): THREE.WebGLRenderTarget;
  getAuxiliaryTarget(): THREE.WebGLRenderTarget;
  getLayerThermoCurrent(layerIndex: number): THREE.WebGLRenderTarget;
};

export type VisualisationModeId =
  | 'terrain'
  | 'elevation'
  | 'surfaceAltitude'
  | 'waterDepth'
  | 'iceThickness'
  | 'salinity'
  | 'albedo'
  | 'solarFlux'
  | 'waterState'
  | 'surfaceTemperature'
  | 'layer0Temperature'
  | 'layer1Temperature'
  | 'layer2Temperature'
  | 'layer0Humidity'
  | 'layer1Humidity'
  | 'layer2Humidity'
  | 'layer0Pressure'
  | 'layer1Pressure'
  | 'layer2Pressure';

/**
 * Configuration for a visualisation mode
 */
export interface VisualisationMode {
  id: VisualisationModeId;
  name: string;
  // Colourmap for this visualisation (used by accessor shaders to create texture)
  // Required for modes using createAccessorShader; optional for custom shaders
  colourmap?: ColourmapDefinition;
  // Get the display range (min/max values) for this visualisation mode
  getRange: (displayConfig: DisplayConfig) => { min: number; max: number };
  // Custom fragment shader source
  customFragmentShader: string;
  // Build uniforms for custom shader
  buildCustomUniforms: (
    simulation: TextureGridSimulationLike,
    displayConfig: DisplayConfig
  ) => Record<string, THREE.IUniform<unknown>>;
}

/**
 * Visualisation modes registry
 * Each visualisation mode declares its data source, display parameters, and colourmap
 * This replaces hardcoded switch statements in PlanetRenderer
 */

import * as THREE from 'three'
import type { TextureGridSimulation } from '../util/TextureGridSimulation'
import type { Colourmap } from './colourmaps'
import {
  COLOURMAP_FAST,
  COLOURMAP_GREYSCALE,
  COLOURMAP_WATERDEPTH,
  COLOURMAP_SALINITY,
  COLOURMAP_ICE,
  COLOURMAP_ALBEDO,
} from './colourmaps'
import type { DisplayConfig } from './displayConfig'

export interface VisualisationMode {
  id: 'temperature' | 'elevation' | 'waterDepth' | 'salinity' | 'iceThickness' | 'albedo'
  name: string
  // Get the texture source for this visualisation
  getTextureSource: (simulation: TextureGridSimulation) => THREE.Texture
  // Which RGBA channel to sample from the texture (0=R, 1=G, 2=B, 3=A)
  dataChannel: 0 | 1 | 2 | 3
  // Colourmap to use for this visualisation
  colourmap: Colourmap
  // Get the display range (min/max values) for this visualisation mode
  getRange: (displayConfig: DisplayConfig) => { min: number; max: number }
}

/**
 * Temperature visualisation mode
 * Shows global temperature from climate simulation using Fast colourmap
 */
export const VISUALISATION_TEMPERATURE: VisualisationMode = {
  id: 'temperature',
  name: 'Temperature',
  getTextureSource: (simulation) => simulation.getClimateDataCurrent().texture,
  dataChannel: 0, // Temperature in red channel
  colourmap: COLOURMAP_FAST,
  getRange: (displayConfig) => displayConfig.temperatureRange,
}

/**
 * Elevation visualisation mode
 * Shows terrain elevation using greyscale colourmap
 */
export const VISUALISATION_ELEVATION: VisualisationMode = {
  id: 'elevation',
  name: 'Elevation (greyscale)',
  getTextureSource: (simulation) => simulation.terrainData,
  dataChannel: 0, // Elevation in red channel
  colourmap: COLOURMAP_GREYSCALE,
  getRange: (displayConfig) => displayConfig.elevationRange,
}

/**
 * Water depth visualisation mode
 * Shows dynamic water depth from hydrology simulation
 */
export const VISUALISATION_WATER_DEPTH: VisualisationMode = {
  id: 'waterDepth',
  name: 'Water depth',
  getTextureSource: (simulation) => simulation.getHydrologyDataCurrent().texture,
  dataChannel: 2, // Water depth in blue channel
  colourmap: COLOURMAP_WATERDEPTH,
  getRange: (displayConfig) => displayConfig.waterDepthRange,
}

/**
 * Salinity visualisation mode
 * Shows ocean salinity from hydrology simulation
 */
export const VISUALISATION_SALINITY: VisualisationMode = {
  id: 'salinity',
  name: 'Salinity (greyscale)',
  getTextureSource: (simulation) => simulation.getHydrologyDataCurrent().texture,
  dataChannel: 3, // Salinity in alpha channel
  colourmap: COLOURMAP_SALINITY,
  getRange: (displayConfig) => displayConfig.salinityRange,
}

/**
 * Ice thickness visualisation mode
 * Shows ice sheet and sea ice thickness from hydrology simulation
 */
export const VISUALISATION_ICE_THICKNESS: VisualisationMode = {
  id: 'iceThickness',
  name: 'Ice thickness',
  getTextureSource: (simulation) => simulation.getHydrologyDataCurrent().texture,
  dataChannel: 0, // Ice thickness in red channel
  colourmap: COLOURMAP_ICE,
  getRange: (displayConfig) => displayConfig.iceThicknessRange,
}

/**
 * Albedo visualisation mode
 * Shows effective surface albedo computed from surface properties (rock/water/ice)
 */
export const VISUALISATION_ALBEDO: VisualisationMode = {
  id: 'albedo',
  name: 'Albedo (greyscale)',
  getTextureSource: (simulation) => simulation.getSurfaceDataCurrent().texture,
  dataChannel: 0, // Effective albedo in red channel
  colourmap: COLOURMAP_ALBEDO,
  getRange: (displayConfig) => displayConfig.albedoRange,
}

/**
 * Registry of all available visualisation modes
 * Maps mode ID to VisualisationMode configuration
 */
export const VISUALISATION_MODES: Record<string, VisualisationMode> = {
  temperature: VISUALISATION_TEMPERATURE,
  elevation: VISUALISATION_ELEVATION,
  waterDepth: VISUALISATION_WATER_DEPTH,
  salinity: VISUALISATION_SALINITY,
  iceThickness: VISUALISATION_ICE_THICKNESS,
  albedo: VISUALISATION_ALBEDO,
}

/**
 * Get a visualisation mode by ID
 */
export function getVisualisationMode(
  id: 'temperature' | 'elevation' | 'waterDepth' | 'salinity' | 'iceThickness' | 'albedo'
): VisualisationMode {
  return VISUALISATION_MODES[id]
}

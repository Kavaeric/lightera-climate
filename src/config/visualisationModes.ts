/**
 * Visualisation modes registry
 * Each visualisation mode declares its data source, display parameters, and colourmap
 * This replaces hardcoded switch statements in PlanetRenderer
 */

import * as THREE from 'three'
import type { TextureGridSimulation } from '../util/TextureGridSimulation'
import { createAccessorShader } from '../util/shaderLoader'
import type { DisplayConfig } from './displayConfig'
import type { Colourmap } from './colourmaps'
import {
  COLOURMAP_GREYSCALE,
  COLOURMAP_BLUE_B1,
  COLOURMAP_TEAL_C16,
  COLOURMAP_BLUE_SD,
  COLOURMAP_PLASMA,
  COLOURMAP_YELLOW_YEL15,
} from './colourmaps'
import terrainFragmentShader from '../shaders/display/terrain.frag'
import type { VisualisationModeId } from '../types/visualisationModes'

export interface VisualisationMode {
  id: VisualisationModeId
  name: string
  // Colourmap for this visualisation (used by simple accessor shaders)
  colourmap?: Colourmap
  // Get the display range (min/max values) for this visualisation mode
  getRange: (displayConfig: DisplayConfig) => { min: number; max: number }
  // Custom fragment shader source
  customFragmentShader: string
  // Build uniforms for custom shader
  buildCustomUniforms: (
    simulation: TextureGridSimulation,
    displayConfig: DisplayConfig
  ) => Record<string, THREE.IUniform<unknown>>
}

/**
 * Surface temperature visualisation mode
 * Shows global surface temperature from climate simulation
 *
 * Uses auto-generated accessor shader - getSurfaceTemperature() is called automatically
 */
export const VISUALISATION_SURFACE_TEMPERATURE: VisualisationMode = {
  id: 'surfaceTemperature',
  name: 'Surface temperature',
  colourmap: COLOURMAP_PLASMA,
  getRange: (displayConfig) => displayConfig.surfaceTemperatureRange,
  customFragmentShader: createAccessorShader('getSurfaceTemperature', COLOURMAP_PLASMA),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.surfaceTemperatureRange
    return {
      surfaceData: { value: simulation.getClimateDataCurrent().texture },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    }
  },
}

/**
 * Elevation visualisation mode
 * Shows terrain elevation using greyscale colourmap
 *
 * Uses auto-generated accessor shader - getElevation() is called automatically
 */
export const VISUALISATION_ELEVATION: VisualisationMode = {
  id: 'elevation',
  name: 'Elevation (greyscale)',
  colourmap: COLOURMAP_GREYSCALE,
  getRange: (displayConfig) => displayConfig.elevationRange,
  customFragmentShader: createAccessorShader('getElevation', COLOURMAP_GREYSCALE),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.elevationRange
    return {
      terrainData: { value: simulation.terrainData },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    }
  },
}

/**
 * Water depth visualisation mode
 * Shows dynamic water depth from hydrology simulation
 *
 * Uses auto-generated accessor shader - getWaterDepth() is called automatically
 */
export const VISUALISATION_WATER_DEPTH: VisualisationMode = {
  id: 'waterDepth',
  name: 'Water depth',
  colourmap: COLOURMAP_BLUE_B1,
  getRange: (displayConfig) => displayConfig.waterDepthRange,
  customFragmentShader: createAccessorShader('getWaterDepth', COLOURMAP_BLUE_B1),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.waterDepthRange
    return {
      hydrologyData: { value: simulation.getHydrologyDataCurrent().texture },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    }
  },
}

/**
 * Salinity visualisation mode
 * Shows ocean salinity from hydrology simulation
 *
 * Uses auto-generated accessor shader - getSalinity() is called automatically
 */
export const VISUALISATION_SALINITY: VisualisationMode = {
  id: 'salinity',
  name: 'Salinity (greyscale)',
  colourmap: COLOURMAP_TEAL_C16,
  getRange: (displayConfig) => displayConfig.salinityRange,
  customFragmentShader: createAccessorShader('getSalinity', COLOURMAP_TEAL_C16),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.salinityRange
    return {
      hydrologyData: { value: simulation.getHydrologyDataCurrent().texture },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    }
  },
}

/**
 * Ice thickness visualisation mode
 * Shows ice sheet and sea ice thickness from hydrology simulation
 *
 * Uses auto-generated accessor shader - getIceThickness() is called automatically
 */
export const VISUALISATION_ICE_THICKNESS: VisualisationMode = {
  id: 'iceThickness',
  name: 'Ice thickness',
  colourmap: COLOURMAP_BLUE_SD,
  getRange: (displayConfig) => displayConfig.iceThicknessRange,
  customFragmentShader: createAccessorShader('getIceThickness', COLOURMAP_BLUE_SD),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.iceThicknessRange
    return {
      hydrologyData: { value: simulation.getHydrologyDataCurrent().texture },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    }
  },
}

/**
 * Albedo visualisation mode
 * Shows effective surface albedo computed from surface properties (rock/water/ice)
 *
 * Uses auto-generated accessor shader - getSurfaceAlbedo() is called automatically
 */
export const VISUALISATION_ALBEDO: VisualisationMode = {
  id: 'albedo',
  name: 'Albedo (greyscale)',
  colourmap: COLOURMAP_GREYSCALE,
  getRange: (displayConfig) => displayConfig.albedoRange,
  customFragmentShader: createAccessorShader('getSurfaceAlbedo', COLOURMAP_GREYSCALE),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.albedoRange
    return {
      surfaceData: { value: simulation.getClimateDataCurrent().texture },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    }
  },
}

/**
 * Atmospheric temperature visualisation mode
 * Shows atmospheric temperature from climate simulation using Plasma colourmap
 *
 * Uses auto-generated accessor shader - getAtmosphereTemperature() is called automatically
 */
export const VISUALISATION_ATMOSPHERIC_TEMPERATURE: VisualisationMode = {
  id: 'atmosphericTemperature',
  name: 'Atmospheric temperature',
  colourmap: COLOURMAP_PLASMA,
  getRange: (displayConfig) => displayConfig.atmosphericTemperatureRange,
  customFragmentShader: createAccessorShader('getAtmosphereTemperature', COLOURMAP_PLASMA),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.atmosphericTemperatureRange
    return {
      atmosphereData: { value: simulation.getAtmosphereDataCurrent().texture },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    }
  },
}

/**
 * Solar flux visualisation mode
 * Shows incoming solar radiation at top of atmosphere (W/m²)
 *
 * Uses auto-generated accessor shader - getSolarFlux() is called automatically
 */
export const VISUALISATION_SOLAR_FLUX: VisualisationMode = {
  id: 'solarFlux',
  name: 'Solar flux',
  colourmap: COLOURMAP_YELLOW_YEL15,
  getRange: (displayConfig) => displayConfig.solarFluxRange,
  customFragmentShader: createAccessorShader('getSolarFlux', COLOURMAP_YELLOW_YEL15),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.solarFluxRange
    return {
      solarFluxData: { value: simulation.getSolarFluxTarget().texture },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    }
  },
}

/**
 * Terrain visualisation mode
 * Simple elevation heightmap with inlined colourmap
 * Uses custom shader for flexibility - colourmaps are hardcoded in terrain.frag
 */
export const VISUALISATION_TERRAIN: VisualisationMode = {
  id: 'terrain',
  name: 'Terrain',
  colourmap: COLOURMAP_GREYSCALE,
  getRange: (displayConfig) => displayConfig.elevationRange,
  customFragmentShader: terrainFragmentShader,
  buildCustomUniforms: (simulation, displayConfig) => {
    // Only pass the uniforms needed by terrain.frag
    // Colourmaps are inlined in the shader, so no colourmap uniforms needed
    const elevationRange = displayConfig.elevationRange
    const waterDepthRange = displayConfig.waterDepthRange
    return {
      terrainData: { value: simulation.terrainData },
      hydrologyData: { value: simulation.getHydrologyDataCurrent().texture },
      elevationMin: { value: elevationRange.min },
      elevationMax: { value: elevationRange.max },
      waterDepthMin: { value: waterDepthRange.min },
      waterDepthMax: { value: waterDepthRange.max },
    }
  },
}

/**
 * Registry of all available visualisation modes
 * Maps mode ID to VisualisationMode configuration
 */
export const VISUALISATION_MODES: Record<VisualisationModeId, VisualisationMode> = {
  surfaceTemperature: VISUALISATION_SURFACE_TEMPERATURE,
  atmosphericTemperature: VISUALISATION_ATMOSPHERIC_TEMPERATURE,
  elevation: VISUALISATION_ELEVATION,
  waterDepth: VISUALISATION_WATER_DEPTH,
  salinity: VISUALISATION_SALINITY,
  iceThickness: VISUALISATION_ICE_THICKNESS,
  albedo: VISUALISATION_ALBEDO,
  solarFlux: VISUALISATION_SOLAR_FLUX,
  terrain: VISUALISATION_TERRAIN,
}

/**
 * Get a visualisation mode by ID
 */
export function getVisualisationMode(
  id: VisualisationModeId
): VisualisationMode {
  const mode = VISUALISATION_MODES[id]
  if (!mode) {
    throw new Error(`Visualisation mode '${id}' not found in registry. Available modes: ${Object.keys(VISUALISATION_MODES).join(', ')}`)
  }
  return mode
}

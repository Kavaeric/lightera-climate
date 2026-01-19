/**
 * Visualisation modes registry
 * Each visualisation mode declares its data source, display parameters, and colourmap
 * This replaces hardcoded switch statements in PlanetRenderer
 */

import { createAccessorShader } from './shaderLoader';
import {
  COLOURMAP_GREYSCALE,
  COLOURMAP_BLUE_B1,
  COLOURMAP_BROWN_BROWNRI,
  COLOURMAP_TEAL_C16,
  COLOURMAP_VIOLET_SD,
  COLOURMAP_PLASMA,
  COLOURMAP_YELLOW_PEACHBR,
  COLOURMAP_WATER_STATE,
  COLOURMAP_TERRAIN_ELEVATION,
  COLOURMAP_TERRAIN_WATER,
  COLOURMAP_TERRAIN_ICE,
} from './colourmaps/colourmaps';
import { createColourmapTexture } from './colourmaps';
import terrainFragmentShader from './shaders/display/terrain.frag';
import surfaceAltitudeFragmentShader from './shaders/display/surfaceAltitude.frag';
import type { VisualisationModeId, VisualisationMode } from '../types/visualisationModes';

/**
 * Terrain visualisation mode
 * Simple true-ish colour view of the planet.
 *
 * Uses a custom visualisation shader.
 */
export const VISUALISATION_TERRAIN: VisualisationMode = {
  id: 'terrain',
  name: 'Terrain',
  getRange: (displayConfig) => displayConfig.elevationRange,
  customFragmentShader: terrainFragmentShader,
  buildCustomUniforms: (simulation, displayConfig) => {
    const elevationRange = displayConfig.elevationRange;
    const waterDepthRange = displayConfig.waterDepthRange;
    return {
      terrainData: { value: simulation.terrainData },
      hydrologyData: { value: simulation.getHydrologyDataCurrent().texture },
      elevationMin: { value: elevationRange.min },
      elevationMax: { value: elevationRange.max },
      waterDepthMin: { value: waterDepthRange.min },
      waterDepthMax: { value: waterDepthRange.max },
      elevationColourmapTexture: { value: createColourmapTexture(COLOURMAP_TERRAIN_ELEVATION) },
      waterDepthColourmapTexture: { value: createColourmapTexture(COLOURMAP_TERRAIN_WATER) },
      iceThicknessColourmapTexture: { value: createColourmapTexture(COLOURMAP_TERRAIN_ICE) },
    };
  },
};

/**
 * Elevation visualisation mode
 * Shows terrain elevation using greyscale colourmap.
 *
 * Uses auto-generated accessor shader - getElevation() is called automatically
 * Terrain texture: R = Elevation
 */
export const VISUALISATION_ELEVATION: VisualisationMode = {
  id: 'elevation',
  name: 'Elevation',
  colourmap: COLOURMAP_BROWN_BROWNRI,
  getRange: (displayConfig) => displayConfig.elevationRange,
  customFragmentShader: createAccessorShader(
    'getElevation',
    COLOURMAP_BROWN_BROWNRI,
    true,
    false
  ),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.elevationRange;
    return {
      terrainData: { value: simulation.terrainData },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_BROWN_BROWNRI) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

/**
 * Surface altitude visualisation mode
 * Shows surface altitude using greyscale colourmap, accounting for water depth and ice thickness.
 *
 * Uses a custom visualisation shader.
 */
export const VISUALISATION_SURFACE_ALTITUDE: VisualisationMode = {
  id: 'surfaceAltitude',
  name: 'Surface altitude',
  getRange: (displayConfig) => displayConfig.elevationRange,
  customFragmentShader: surfaceAltitudeFragmentShader,
  buildCustomUniforms: (simulation, displayConfig) => {
    const elevationRange = displayConfig.elevationRange;
    const waterDepthRange = displayConfig.waterDepthRange;
    const iceThicknessRange = displayConfig.iceThicknessRange;
    return {
      terrainData: { value: simulation.terrainData },
      hydrologyData: { value: simulation.getHydrologyDataCurrent().texture },
      elevationMin: { value: elevationRange.min },
      elevationMax: { value: elevationRange.max },
      waterDepthMin: { value: waterDepthRange.min },
      waterDepthMax: { value: waterDepthRange.max },
      iceThicknessMin: { value: iceThicknessRange.min },
      iceThicknessMax: { value: iceThicknessRange.max },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_BROWN_BROWNRI) },
    };
  },
};

/**
 * Surface temperature visualisation mode
 * Shows global surface temperature from climate simulation.
 *
 * Uses auto-generated accessor shader - getSurfaceTemperature() is called automatically
 * Thermal surface texture: R = Surface temperature
 */
export const VISUALISATION_SURFACE_TEMPERATURE: VisualisationMode = {
  id: 'surfaceTemperature',
  name: 'Surface: Temperature',
  colourmap: COLOURMAP_PLASMA,
  getRange: (displayConfig) => displayConfig.surfaceTemperatureRange,
  customFragmentShader: createAccessorShader(
    'getSurfaceTemperature',
    COLOURMAP_PLASMA,
    false,
    false
  ),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.surfaceTemperatureRange;
    return {
      surfaceData: { value: simulation.getClimateDataCurrent().texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_PLASMA) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

/**
 * Albedo visualisation mode
 * Shows effective surface albedo computed from surface properties (rock/water/ice)
 *
 * Uses auto-generated accessor shader - getSurfaceAlbedo() is called automatically
 * Thermal surface texture: A = Surface albedo
 */
export const VISUALISATION_ALBEDO: VisualisationMode = {
  id: 'albedo',
  name: 'Surface: Albedo',
  colourmap: COLOURMAP_GREYSCALE,
  getRange: (displayConfig) => displayConfig.albedoRange,
  customFragmentShader: createAccessorShader('getSurfaceAlbedo', COLOURMAP_GREYSCALE, true, true),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.albedoRange;
    return {
      surfaceData: { value: simulation.getClimateDataCurrent().texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_GREYSCALE) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

/**
 * Water depth visualisation mode
 * Shows water depth from hydrology simulation.
 *
 * Uses auto-generated accessor shader - getWaterDepth() is called automatically
 * Hydrology texture: R = Water depth
 */
export const VISUALISATION_WATER_DEPTH: VisualisationMode = {
  id: 'waterDepth',
  name: 'Hydrology: Water depth',
  colourmap: COLOURMAP_BLUE_B1,
  getRange: (displayConfig) => displayConfig.waterDepthRange,
  customFragmentShader: createAccessorShader('getWaterDepth', COLOURMAP_BLUE_B1, false, true),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.waterDepthRange;
    return {
      hydrologyData: { value: simulation.getHydrologyDataCurrent().texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_BLUE_B1) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

/**
 * Ice thickness visualisation mode
 * Shows ice sheet thickness from hydrology simulation.
 *
 * Uses auto-generated accessor shader - getIceThickness() is called automatically
 * Hydrology texture: G = Ice thickness
 */
export const VISUALISATION_ICE_THICKNESS: VisualisationMode = {
  id: 'iceThickness',
  name: 'Hydrology: Ice thickness',
  colourmap: COLOURMAP_VIOLET_SD,
  getRange: (displayConfig) => displayConfig.iceThicknessRange,
  customFragmentShader: createAccessorShader('getIceThickness', COLOURMAP_VIOLET_SD, false, false),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.iceThicknessRange;
    return {
      hydrologyData: { value: simulation.getHydrologyDataCurrent().texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_VIOLET_SD) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

/**
 * Salinity visualisation mode
 * Shows ocean salinity from hydrology simulation.
 *
 * Uses auto-generated accessor shader - getSalinity() is called automatically
 * Hydrology texture: A = Salinity
 */
export const VISUALISATION_SALINITY: VisualisationMode = {
  id: 'salinity',
  name: 'Hydrology: Salinity',
  colourmap: COLOURMAP_TEAL_C16,
  getRange: (displayConfig) => displayConfig.salinityRange,
  customFragmentShader: createAccessorShader('getSalinity', COLOURMAP_TEAL_C16, false, false),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.salinityRange;
    return {
      hydrologyData: { value: simulation.getHydrologyDataCurrent().texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_TEAL_C16) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

/**
 * Solar flux visualisation mode
 * Shows incoming solar radiation at top of atmosphere (W/m²).
 *
 * Uses auto-generated accessor shader - getSolarFlux() is called automatically
 * Solar flux texture: R = Solar flux
 */
export const VISUALISATION_SOLAR_FLUX: VisualisationMode = {
  id: 'solarFlux',
  name: 'Auxiliary: Solar flux',
  colourmap: COLOURMAP_YELLOW_PEACHBR,
  getRange: (displayConfig) => displayConfig.solarFluxRange,
  customFragmentShader: createAccessorShader('getSolarFlux', COLOURMAP_YELLOW_PEACHBR, true, true),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.solarFluxRange;
    return {
      auxiliaryData: { value: simulation.getAuxiliaryTarget().texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_YELLOW_PEACHBR) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

/**
 * Water state visualisation mode
 * Shows computed regions of water (solid, liquid, or gas).
 *
 * Uses auto-generated accessor shader - getWaterState() is called automatically
 * Auxiliary texture: G = Water state (0 = solid, 0.5 = liquid, 1 = gas)
 */
export const VISUALISATION_WATER_STATE: VisualisationMode = {
  id: 'waterState',
  name: 'Auxiliary: Water state',
  colourmap: COLOURMAP_WATER_STATE,
  getRange: () => ({ min: 0, max: 1 }),
  customFragmentShader: createAccessorShader('getWaterState', COLOURMAP_WATER_STATE, true, true),
  buildCustomUniforms: (simulation) => {
    return {
      auxiliaryData: { value: simulation.getAuxiliaryTarget().texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_WATER_STATE) },
      valueMin: { value: 0 },
      valueMax: { value: 1 },
    };
  },
};

// ============================================================================
// MULTI-LAYER ATMOSPHERE VISUALISATION MODES
// ============================================================================

/**
 * Layer 0 (Boundary layer, 0-2km) temperature visualisation
 */
export const VISUALISATION_LAYER0_TEMPERATURE: VisualisationMode = {
  id: 'layer0Temperature',
  name: 'Layer 0: Temperature (0-2km)',
  colourmap: COLOURMAP_PLASMA,
  getRange: (displayConfig) => displayConfig.layerTemperatureRange,
  customFragmentShader: createAccessorShader('getLayer0Temperature', COLOURMAP_PLASMA, true, true),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.layerTemperatureRange;
    return {
      layer0ThermoData: { value: simulation.getLayerThermoCurrent(0).texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_PLASMA) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

export const VISUALISATION_LAYER1_TEMPERATURE: VisualisationMode = {
  id: 'layer1Temperature',
  name: 'Layer 1: Temperature (2-10km)',
  colourmap: COLOURMAP_PLASMA,
  getRange: (displayConfig) => displayConfig.layerTemperatureRange,
  customFragmentShader: createAccessorShader('getLayer1Temperature', COLOURMAP_PLASMA, true, true),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.layerTemperatureRange;
    return {
      layer1ThermoData: { value: simulation.getLayerThermoCurrent(1).texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_PLASMA) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

export const VISUALISATION_LAYER2_TEMPERATURE: VisualisationMode = {
  id: 'layer2Temperature',
  name: 'Layer 2: Temperature (10-50km)',
  colourmap: COLOURMAP_PLASMA,
  getRange: (displayConfig) => displayConfig.layerTemperatureRange,
  customFragmentShader: createAccessorShader('getLayer2Temperature', COLOURMAP_PLASMA, true, true),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.layerTemperatureRange;
    return {
      layer2ThermoData: { value: simulation.getLayerThermoCurrent(2).texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_PLASMA) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

export const VISUALISATION_LAYER0_HUMIDITY: VisualisationMode = {
  id: 'layer0Humidity',
  name: 'Layer 0: Humidity (0-2km)',
  colourmap: COLOURMAP_TEAL_C16,
  getRange: (displayConfig) => displayConfig.layerHumidityRange,
  customFragmentShader: createAccessorShader('getLayer0Humidity', COLOURMAP_TEAL_C16, false, false),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.layerHumidityRange;
    return {
      layer0ThermoData: { value: simulation.getLayerThermoCurrent(0).texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_TEAL_C16) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

export const VISUALISATION_LAYER1_HUMIDITY: VisualisationMode = {
  id: 'layer1Humidity',
  name: 'Layer 1: Humidity (2-10km)',
  colourmap: COLOURMAP_TEAL_C16,
  getRange: (displayConfig) => displayConfig.layerHumidityRange,
  customFragmentShader: createAccessorShader('getLayer1Humidity', COLOURMAP_TEAL_C16, false, false),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.layerHumidityRange;
    return {
      layer1ThermoData: { value: simulation.getLayerThermoCurrent(1).texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_TEAL_C16) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

export const VISUALISATION_LAYER2_HUMIDITY: VisualisationMode = {
  id: 'layer2Humidity',
  name: 'Layer 2: Humidity (10-50km)',
  colourmap: COLOURMAP_TEAL_C16,
  getRange: (displayConfig) => displayConfig.layerHumidityRange,
  customFragmentShader: createAccessorShader('getLayer2Humidity', COLOURMAP_TEAL_C16, false, false),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.layerHumidityRange;
    return {
      layer2ThermoData: { value: simulation.getLayerThermoCurrent(2).texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_TEAL_C16) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

export const VISUALISATION_LAYER0_PRESSURE: VisualisationMode = {
  id: 'layer0Pressure',
  name: 'Layer 0: Pressure (0-2km)',
  colourmap: COLOURMAP_GREYSCALE,
  getRange: (displayConfig) => displayConfig.layerPressureRange,
  customFragmentShader: createAccessorShader('getLayer0Pressure', COLOURMAP_GREYSCALE, false, false),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.layerPressureRange;
    return {
      layer0ThermoData: { value: simulation.getLayerThermoCurrent(0).texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_GREYSCALE) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

export const VISUALISATION_LAYER1_PRESSURE: VisualisationMode = {
  id: 'layer1Pressure',
  name: 'Layer 1: Pressure (2-10km)',
  colourmap: COLOURMAP_GREYSCALE,
  getRange: (displayConfig) => displayConfig.layerPressureRange,
  customFragmentShader: createAccessorShader('getLayer1Pressure', COLOURMAP_GREYSCALE, false, false),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.layerPressureRange;
    return {
      layer1ThermoData: { value: simulation.getLayerThermoCurrent(1).texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_GREYSCALE) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

export const VISUALISATION_LAYER2_PRESSURE: VisualisationMode = {
  id: 'layer2Pressure',
  name: 'Layer 2: Pressure (10-50km)',
  colourmap: COLOURMAP_GREYSCALE,
  getRange: (displayConfig) => displayConfig.layerPressureRange,
  customFragmentShader: createAccessorShader('getLayer2Pressure', COLOURMAP_GREYSCALE, false, false),
  buildCustomUniforms: (simulation, displayConfig) => {
    const range = displayConfig.layerPressureRange;
    return {
      layer2ThermoData: { value: simulation.getLayerThermoCurrent(2).texture },
      colourmapTexture: { value: createColourmapTexture(COLOURMAP_GREYSCALE) },
      valueMin: { value: range.min },
      valueMax: { value: range.max },
    };
  },
};

/**
 * Registry of all available visualisation modes
 * Maps mode ID to VisualisationMode configuration.
 */
export const VISUALISATION_MODES: Record<VisualisationModeId, VisualisationMode> = {
  terrain: VISUALISATION_TERRAIN,
  elevation: VISUALISATION_ELEVATION,
  surfaceAltitude: VISUALISATION_SURFACE_ALTITUDE,
  surfaceTemperature: VISUALISATION_SURFACE_TEMPERATURE,
  albedo: VISUALISATION_ALBEDO,
  waterDepth: VISUALISATION_WATER_DEPTH,
  iceThickness: VISUALISATION_ICE_THICKNESS,
  salinity: VISUALISATION_SALINITY,
  solarFlux: VISUALISATION_SOLAR_FLUX,
  waterState: VISUALISATION_WATER_STATE,
  layer0Temperature: VISUALISATION_LAYER0_TEMPERATURE,
  layer1Temperature: VISUALISATION_LAYER1_TEMPERATURE,
  layer2Temperature: VISUALISATION_LAYER2_TEMPERATURE,
  layer0Humidity: VISUALISATION_LAYER0_HUMIDITY,
  layer1Humidity: VISUALISATION_LAYER1_HUMIDITY,
  layer2Humidity: VISUALISATION_LAYER2_HUMIDITY,
  layer0Pressure: VISUALISATION_LAYER0_PRESSURE,
  layer1Pressure: VISUALISATION_LAYER1_PRESSURE,
  layer2Pressure: VISUALISATION_LAYER2_PRESSURE,
};

/**
 * Gets a visualisation mode by ID.
 * Throws an error if the mode is not found.
 */
export function getVisualisationMode(id: VisualisationModeId): VisualisationMode {
  const mode = VISUALISATION_MODES[id];
  if (!mode) {
    throw new Error(
      `Visualisation mode '${id}' not found in registry. Available modes: ${Object.keys(VISUALISATION_MODES).join(', ')}`
    );
  }
  return mode;
}

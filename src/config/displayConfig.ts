/**
 * Display configuration - visualisation and UI settings
 */

import type { VisualisationModeId } from '../types/visualisationModes'

export interface DisplayConfig {
  // Visualisation mode - what to display on the planet
  visualisationMode: VisualisationModeId

  // Surface temperature display range for colour mapping
  surfaceTemperatureRange: { min: number; max: number } // Kelvin

  // Atmospheric temperature display range for colour mapping
  atmosphericTemperatureRange: { min: number; max: number } // Kelvin

  // Elevation display range for greyscale mapping
  elevationRange: { min: number; max: number } // metres

  // Water depth display range (from hydrology - evolves with evaporation/freezing)
  waterDepthRange: { min: number; max: number } // metres

  // Salinity display range for greyscale mapping
  salinityRange: { min: number; max: number } // PSU (Practical Salinity Units)

  // Ice thickness display range for greyscale mapping
  iceThicknessRange: { min: number; max: number } // metres

  // Albedo display range for greyscale mapping
  albedoRange: { min: number; max: number } // 0-1 (fraction of light reflected)

  // Solar flux display range for greyscale mapping
  solarFluxRange: { min: number; max: number } // W/m² (incoming solar radiation at TOA)

  // Precipitable water display range for greyscale mapping
  precipitableWaterRange: { min: number; max: number } // mm (total column water vapour)

  // Surface pressure display range for greyscale mapping
  surfacePressureRange: { min: number; max: number } // Pa (surface atmospheric pressure)

  // Colour mapping - architecture allows future expansion to other colourmaps
  colourmap: 'fast' // Currently only 'fast' supported; will expand to 'viridis' | 'blackbody' later

  // Underflow/overflow colours (RGB values 0-1)
  underflowColour: [number, number, number] // Colour for surface temperatures below min (e.g., deep blue)
  overflowColour: [number, number, number] // Colour for surface temperatures above max (e.g., magenta)

  // Latitude/longitude grid overlay settings
  gridColour: string // Hex colour code
  latitudeLines: number // Number of horizontal grid lines
  longitudeLines: number // Number of vertical grid lines
  gridSegments: number // Resolution of grid line rendering

  // Cell highlighting threshold
  highlightThreshold: number // Distance threshold for detecting which cell is highlighted
}

/**
 * Default display configuration
 * Matches the previous hardcoded values from planetConfig.displayRange
 */
export const DISPLAY_CONFIG_DEFAULT: DisplayConfig = {
  visualisationMode: 'terrain',
  surfaceTemperatureRange: { min: 200, max: 350 }, // Kelvin colour scale range
  atmosphericTemperatureRange: { min: 200, max: 350 }, // Kelvin colour scale range
  elevationRange: { min: -5000, max: 10000 }, // metres (ocean depth to highest mountains in procedural generation)
  waterDepthRange: { min: 0, max: 5000 }, // metres (dynamic water from hydrology - evolves with evaporation)
  salinityRange: { min: 0, max: 50 }, // PSU (0 = fresh, 35 = ocean, 50+ = hypersaline)
  iceThicknessRange: { min: 0, max: 5000 }, // metres (typical ice sheet thickness)
  albedoRange: { min: 0, max: 1 }, // 0-1 (fraction of light reflected)
  solarFluxRange: { min: 0, max: 1500 }, // W/m² (0 = night, ~1367 = Earth solar constant)
  precipitableWaterRange: { min: 0, max: 70 }, // mm (Earth average ~25mm, range 0-70mm)
  surfacePressureRange: { min: 50000, max: 150000 }, // Pa (Earth ~101325 Pa, range for various altitudes)
  colourmap: 'fast',
  underflowColour: [0.0, 0.0, 0.2], // Navy blue for cold
  overflowColour: [1.0, 0.0, 1.0], // Magenta for hot
  gridColour: '#ffffff', // White for latitude/longitude grid
  latitudeLines: 8, // ~10 degree spacing
  longitudeLines: 24, // ~15 degree spacing
  gridSegments: 48,
  highlightThreshold: 0.0005, // Tighter threshold reduces z-fighting at cell boundaries
}

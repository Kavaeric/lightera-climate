/**
 * Display configuration - visualisation and UI settings
 */

export interface DisplayConfig {
  // Visualisation mode - what to display on the planet
  visualisationMode: 'temperature' | 'elevation' | 'waterDepth' | 'salinity' | 'iceThickness' | 'albedo'

  // Temperature display range for colour mapping
  temperatureRange: { min: number; max: number } // Kelvin

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

  // Colour mapping - architecture allows future expansion to other colourmaps
  colourmap: 'fast' // Currently only 'fast' supported; will expand to 'viridis' | 'blackbody' later

  // Underflow/overflow colours (RGB values 0-1)
  underflowColour: [number, number, number] // Colour for temperatures below min (e.g., deep blue)
  overflowColour: [number, number, number] // Colour for temperatures above max (e.g., magenta)

  // Latitude/longitude grid overlay settings
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
export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  visualisationMode: 'temperature',
  temperatureRange: { min: 200, max: 350 }, // Kelvin colour scale range
  elevationRange: { min: -5000, max: 10000 }, // metres (ocean depth to highest mountains in procedural generation)
  waterDepthRange: { min: 0, max: 5000 }, // metres (dynamic water from hydrology - evolves with evaporation)
  salinityRange: { min: 0, max: 50 }, // PSU (0 = fresh, 35 = ocean, 50+ = hypersaline)
  iceThicknessRange: { min: 0, max: 5000 }, // metres (typical ice sheet thickness)
  albedoRange: { min: 0, max: 1 }, // 0-1 (fraction of light reflected)
  colourmap: 'fast',
  underflowColour: [0.0, 0.0, 0.2], // Navy blue for cold
  overflowColour: [1.0, 0.0, 1.0], // Magenta for hot
  latitudeLines: 8, // ~10 degree spacing
  longitudeLines: 24, // ~15 degree spacing
  gridSegments: 48,
  highlightThreshold: 0.0005, // Tighter threshold reduces z-fighting at cell boundaries
}

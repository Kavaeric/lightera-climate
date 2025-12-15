/**
 * Display configuration - visualization and UI settings
 */

export interface DisplayConfig {
  // Temperature display range for color mapping
  temperatureRange: { min: number; max: number } // Kelvin

  // Color mapping - architecture allows future expansion to other colormaps
  colormap: 'fast' // Currently only 'fast' supported; will expand to 'viridis' | 'blackbody' later

  // Underflow/overflow colors (RGB values 0-1)
  underflowColor: [number, number, number] // Color for temperatures below min (e.g., deep blue)
  overflowColor: [number, number, number] // Color for temperatures above max (e.g., magenta)

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
  temperatureRange: { min: 100, max: 500 }, // Kelvin color scale range
  colormap: 'fast',
  underflowColor: [0.0, 0.0, 0.2], // Navy blue for cold
  overflowColor: [1.0, 0.0, 1.0], // Magenta for hot
  latitudeLines: 8, // ~10 degree spacing
  longitudeLines: 24, // ~15 degree spacing
  gridSegments: 48,
  highlightThreshold: 0.0005, // Tighter threshold reduces z-fighting at cell boundaries
}

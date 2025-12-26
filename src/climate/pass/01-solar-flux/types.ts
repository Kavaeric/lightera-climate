/**
 * Configuration for the solar flux pass
 */
export interface SolarFluxConfig {
  solarFlux: number // W/m² - solar constant at top of atmosphere
  baseSubsolarPoint: { lat: number; lon: number } // degrees
  axialTilt: number // degrees
}

/**
 * Runtime state for the solar flux pass
 */
export interface SolarFluxState {
  yearProgress: number // 0-1
}

/**
 * Default configuration for the solar flux pass
 */
export const SOLAR_FLUX_CONFIG_EARTH: SolarFluxConfig = {
  solarFlux: 1367, // W/m² - solar constant at top of atmosphere
  baseSubsolarPoint: { lat: 0, lon: 0 }, // degrees - subsolar point at vernal equinox
  axialTilt: 23.5, // degrees - planet's axial tilt
}
/**
 * Planet configuration - centralizes all physical and display parameters
 */

export interface PlanetConfig {
  // Orbital parameters
  solarConstant: number // W/m² - solar irradiance at planet's distance
  cosmicBackgroundTemp: number // K - temperature of the cosmic background, usually 2.7K
  yearLength?: number // seconds - orbital period (default: Earth's 31557600s = 365.25 days)

  // Surface properties
  albedo: number // 0-1 - fraction of sunlight reflected
  surfaceHeatCapacity?: number // J/(m²·K) - heat capacity per unit area (default: 1e5 for rock)

  // Rotational parameters
  subsolarPoint: { lat: number; lon: number } // degrees - where sun is directly overhead
  rotationsPerYear?: number // number of rotations the planet makes on its axis in one orbit around the sun
  axialTilt?: number // degrees (for future use with seasons)

  // Thermal properties
  thermalDiffusivity?: number // 0-1 - controls how quickly heat spreads laterally (0 = no diffusion, 1 = instant equilibrium)
  diffusionIterations?: number // number of diffusion smoothing passes to apply (more = smoother gradients)

  // Display settings
  displayRange: { min: number; max: number } // Kelvin - color scale range
}

/**
 * Default Earth-like configuration for tidally locked airless world
 */
export const DEFAULT_PLANET_CONFIG: PlanetConfig = {
  solarConstant: 9159, // Earth's solar constant is 1361 W/m²
  cosmicBackgroundTemp: 2.7, // Temperature of the cosmic background, usually 2.7K
  yearLength: 7603000, // Earth year: 365.25 days in seconds
  albedo: 0.10, // Earth-like average albedo is 0.3
  surfaceHeatCapacity: 1e5, // J/(m²·K) - typical for rocky surface (1e3 for loose dust, 1e6 for dense rock)
  subsolarPoint: { lat: 0, lon: 0 }, // Equator, prime meridian
  displayRange: { min: 0, max: 400 }, // 0K to 400K (covers 0°C to ~127°C)
  rotationsPerYear: 2,
  thermalDiffusivity: 0.001, // Moderate diffusion for realistic twilight zones
  diffusionIterations: 12, // 10 passes for smooth gradients
}

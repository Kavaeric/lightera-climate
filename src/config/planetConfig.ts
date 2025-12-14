/**
 * Planet configuration - centralizes all physical and display parameters
 */

export interface PlanetConfig {
  // Orbital parameters
  solarFlux: number // W/m² - solar irradiance at planet's distance
  cosmicBackgroundTemp: number // K - temperature of the cosmic background, usually 2.7K
  yearLength?: number // seconds - orbital period (default: Earth's 31557600s = 365.25 days)
  iterations?: number // number of iterations (in orbits) to simulate

  // Surface properties
  albedo: number // 0-1 - fraction of sunlight reflected
  emissivity?: number // 0-1 - thermal emissivity for blackbody radiation (default: 1.0 for perfect blackbody)
  surfaceHeatCapacity?: number // J/(m²·K) - heat capacity per unit area (default: 1e5 for rock)

  // Rotational parameters
  subsolarPoint: { lat: number; lon: number } // degrees - where sun is directly overhead
  rotationsPerYear?: number // number of rotations the planet makes on its axis in one orbit around the sun
  axialTilt?: number // degrees (for future use with seasons)

  // Thermal properties
  groundDiffusion?: number // 0-1 - controls how quickly heat spreads laterally (0 = no diffusion, 1 = instant equilibrium)
  groundDiffusionIterations?: number // number of diffusion smoothing passes to apply (more = smoother gradients)

  // Display settings
  displayRange: { min: number; max: number } // Kelvin - color scale range
}

/**
 * Default Earth-like configuration for tidally locked airless world
 */
export const DEFAULT_PLANET_CONFIG: PlanetConfig = {
  solarFlux: 1361, // Solar flux at the top of the atmosphere (W/m²) (Earth: 1361 W/m²)
  cosmicBackgroundTemp: 2.7, // Temperature of the cosmic background, usually 2.7K
  yearLength: 31540000, // 1 orbital year in seconds (Earth: 365.25 days, or 31540000 seconds)
  iterations: 128, // Run for many orbits to reach thermal equilibrium
  albedo: 0.30, // Albedo of the planet's surface (Earth: ~0.30)
  emissivity: 0.90, // Emissivity of the planet's surface (Earth: ~0.90)
  surfaceHeatCapacity: 2.927e8, // Heat capacity of the planet's crust/surface (Earth: 2.927e8 J/(m²·K))
  subsolarPoint: { lat: 0, lon: 0 }, // Location of the equator and prime meridian
  displayRange: { min: 150, max: 500 }, // Colour scale range for visualisation
  rotationsPerYear: 1, // Number of rotations per orbit; 0 means tidally locked
  groundDiffusion: 0.05, // Slow subsurface heat conduction through the ground
  groundDiffusionIterations: 16, // Minimal diffusion passes for subsurface conduction
}

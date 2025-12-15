/**
 * Planet configuration - physical parameters only
 * Separated from simulation and display parameters for clear separation of concerns
 */

export interface PlanetConfig {
  // Physical properties
  radius: number // meters - planet's radius (e.g., Earth: 6,371,000m)

  // Orbital parameters
  solarFlux: number // W/m² - solar irradiance at planet's distance
  cosmicBackgroundTemp: number // K - temperature of the cosmic background, usually 2.7K
  yearLength: number // seconds - orbital period (e.g., Earth: 31,540,000s = 365.25 days)

  // Surface properties
  albedo: number // 0-1 - fraction of sunlight reflected
  emissivity: number // 0-1 - thermal emissivity for blackbody radiation (e.g., rock: 0.90)
  surfaceHeatCapacity: number // J/(m²·K) - heat capacity per unit area (e.g., Earth: 2.927e8)

  // Rotational parameters
  subsolarPoint: { lat: number; lon: number } // degrees - where sun is directly overhead
  rotationsPerYear: number // rotations per orbit (e.g., 0 = tidally locked)
  axialTilt?: number // degrees (for future use with seasons)
}

/**
 * Default Earth-like configuration for tidally locked airless world
 */
export const DEFAULT_PLANET_CONFIG: PlanetConfig = {
  radius: 6371000, // Planet radius in meters (Earth: 6,371 km)
  solarFlux: 1361, // Solar flux at the top of the atmosphere (W/m²)
  cosmicBackgroundTemp: 2.7, // Temperature of the cosmic background, usually 2.7K
  yearLength: 31540000, // 1 orbital year in seconds (Earth: 365.25 days)
  albedo: 0.30, // Albedo of the planet's surface (Earth: ~0.30)
  emissivity: 0.90, // Emissivity of the planet's surface (Earth: ~0.90)
  surfaceHeatCapacity: 2.927e8, // Heat capacity of the planet's crust/surface (Earth: 2.927e8 J/(m²·K))
  subsolarPoint: { lat: 0, lon: 0 }, // Location of the equator and prime meridian
  rotationsPerYear: 365, // Number of rotations per orbit (0 = tidally locked)
  axialTilt: 23.44, // The angle of the planet's axis of rotation (Earth: 23.44°)
}

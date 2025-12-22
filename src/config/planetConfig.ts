import type { AtmosphereConfig } from './atmosphereConfig'
import { DEFAULT_ATMOSPHERE_CONFIG } from './atmosphereConfig'

/**
 * Planet configuration - physical parameters only
 * Separated from simulation and display parameters for clear separation of concerns
 */

export interface PlanetConfig {
  // Physical properties
  radius: number // metres - planet's radius (e.g., Earth: 6,371,000m)

  // Orbital parameters
  solarFlux: number // W/m² - solar irradiance at planet's distance
  cosmicBackgroundTemp: number // K - temperature of the cosmic background, usually 2.7K
  yearLength: number // seconds - orbital period (e.g., Earth: 31,540,000s = 365.25 days)

  // Surface properties
  albedo: number // 0-1 - fraction of sunlight reflected
  emissivity: number // 0-1 - thermal emissivity for blackbody radiation (e.g., rock: 0.90)
  surfaceHeatCapacity: number // J/(m²·K) - heat capacity per unit area (e.g., Earth: 2.927e8)
  groundConductivity: number // W/(m·K) - thermal conductivity of rock (shader uses physical constants for water/ice/rock)

  // Rotational parameters
  subsolarPoint: { lat: number; lon: number } // degrees - where sun is directly overhead
  rotationsPerYear: number // rotations per orbit (e.g., 0 = tidally locked)
  axialTilt?: number // degrees (for future use with seasons)

  // Atmospheric parameters
  atmosphereConfig?: AtmosphereConfig // optional - if omitted, no atmosphere
}

/**
 * Default configuration for Earth-like planet with atmosphere
 * Heat capacity is for exposed rock with ~1m effective thermal skin depth
 * For comparison: Ocean water at 4000m depth = 1.674e10 J/(m²·K) (57x higher!)
 */
export const DEFAULT_PLANET_CONFIG: PlanetConfig = {
  radius: 6371000, // Planet radius in metres (Earth: 6,371 km)
  // radius: 2439700, // Planet radius in metres (Mercury: 2,439.7 km)
  solarFlux: 1361, // Solar flux at the top of the atmosphere (W/m²)
  // solarFlux: 9159, // Solar flux at the top of the atmosphere (W/m²)
  cosmicBackgroundTemp: 2.7, // Temperature of the cosmic background, usually 2.7K
  yearLength: 365 * 60 * 60 * 24, // 365 days
  albedo: 0.10, // Albedo of the planet's surface (airless body)
  emissivity: 0.90, // Emissivity of rock surface
  surfaceHeatCapacity: 2.16e6, // Heat capacity of exposed rock (ρ=2700 kg/m³, c=800 J/kg·K, depth=1m)
  groundConductivity: 2.5, // Thermal conductivity of rock (W/(m·K)) - shader uses physical values: water=0.6, ice=2.2, rock=2.5
  subsolarPoint: { lat: 0, lon: 0 }, // Location of the equator and prime meridian
  rotationsPerYear: 365, // Number of rotations per orbit (0 = tidally locked)
  // rotationsPerYear: 88, // Number of rotations per orbit (0 = tidally locked)
  axialTilt: 23.44, // The angle of the planet's axis of rotation (Earth: 23.44°)
  // axialTilt: 0, // The angle of the planet's axis of rotation (0 = no tilt)
  atmosphereConfig: DEFAULT_ATMOSPHERE_CONFIG, // Earth-like atmosphere by default
}

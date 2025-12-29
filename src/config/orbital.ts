/**
 * Orbital configuration - user-configurable orbital parameters
 * These parameters define the planet's orbit, rotation, and stellar irradiance
 */

export interface OrbitalConfig {
  // Orbital period - how long one year is
  yearLength: number // seconds

  // Rotation rate - how many times the planet rotates per orbit
  // 0 = tidally locked (one side always faces the star)
  // 365 = Earth-like (one rotation per day)
  rotationsPerYear: number // dimensionless

  // Solar constant - total solar irradiance at planet's orbital distance (W/m²)
  solarFlux: number

  // Axial tilt - angle between rotation axis and orbital plane (degrees)
  // 0 = no seasons, 23.44 = Earth-like seasons
  axialTilt: number
}

/**
 * Earth-like orbital configuration
 * 365.25 day year, one rotation per day, 23.44° axial tilt
 */
export const ORBITAL_CONFIG_EARTH: OrbitalConfig = {
  yearLength: 365.25 * 24 * 60 * 60, // 365.25 days in seconds
  rotationsPerYear: 365.25, // One rotation per day
  solarFlux: 1361, // W/m² - Earth's solar constant at 1 AU
  axialTilt: 23.44, // degrees - Earth's axial tilt (causes seasons)
}

/**
 * Mars-like orbital configuration
 * 687 day year, one rotation per day
 */
export const ORBITAL_CONFIG_MARS: OrbitalConfig = {
  yearLength: 687 * 24 * 60 * 60, // 687 days in seconds
  rotationsPerYear: 687, // One rotation per year
  solarFlux: 586, // W/m² - Mars's solar constant at 1.524 AU
  axialTilt: 25.19, // degrees - Mars's axial tilt (causes seasons)
}

/**
 * Venus-like orbital configuration
 * 225 day year, one rotation per year
 */
export const ORBITAL_CONFIG_VENUS: OrbitalConfig = {
  yearLength: 225 * 24 * 60 * 60, // 225 days in seconds
  rotationsPerYear: 1, // One rotation per year
  solarFlux: 2610, // W/m² - Venus's solar constant at 0.723 AU
  axialTilt: 2.64, // degrees - Venus's axial tilt
}
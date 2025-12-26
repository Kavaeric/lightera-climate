/**
 * Planetary configuration - user-configurable planetary properties
 * These parameters define the basic physical characteristics of the planet
 */

export interface PlanetaryConfig {
  // Planet radius
  radius: number // metres

  // Planet mass
  mass: number // kg

  // Surface gravity (can be derived from mass and radius, but stored for convenience)
  surfaceGravity: number // m/s²
}

/**
 * Calculate surface gravity from mass and radius
 * g = GM / r²
 */
export function calculateSurfaceGravity(mass: number, radius: number): number {
  const G = 6.67430e-11 // Gravitational constant (m³/(kg·s²))
  return (G * mass) / (radius * radius)
}

/**
 * Earth planetary configuration
 */
export const PLANETARY_CONFIG_EARTH: PlanetaryConfig = {
  radius: 6371000, // 6,371 km
  mass: 5.972e24, // kg
  surfaceGravity: 9.81, // m/s²
}

/**
 * Mars planetary configuration
 */
export const PLANETARY_CONFIG_MARS: PlanetaryConfig = {
  radius: 3389500, // 3,389.5 km
  mass: 6.4171e23, // kg
  surfaceGravity: 3.71, // m/s²
}

/**
 * Mercury planetary configuration
 */
export const PLANETARY_CONFIG_MERCURY: PlanetaryConfig = {
  radius: 2439700, // 2,439.7 km
  mass: 3.3011e23, // kg
  surfaceGravity: 3.7, // m/s²
}

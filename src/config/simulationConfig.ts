/**
 * Simulation configuration - solver parameters and grid settings
 */

/**
 * Depth quantisation constant (metres)
 * All elevation, water depth, and ice thickness values are quantised to this increment
 * This prevents floating point drift and ensures depths are either meaningful or exactly zero
 */
export const DEPTH_QUANTUM = 0.1 // metres (10cm increments)

/**
 * Surface simulation depth (metres)
 * The depth of the surface layer that is simulated.
 * Beyond 50m, the planet's surface is assumed to have a negligible effect on the climate.
 */
export const SURFACE_DEPTH = 50 // metres (surface simulation depth)

export interface SimulationConfig {
  // Grid resolution
  resolution: number // geodesic subdivisions (e.g., 16 creates ~2,560 cells)

  // Solver parameters
  stepsPerOrbit: number // physics steps per orbit (controls timestep granularity)
}

/**
 * Default simulation configuration
 * These values control the accuracy and speed of the simulation
 */
export const SIMULATION_CONFIG_DEFAULT: SimulationConfig = {
  resolution: 16, // Geodesic subdivisions (128 creates too many cells and crashes)
  stepsPerOrbit: 1024, // Physics steps per orbit (controls timestep granularity)
}

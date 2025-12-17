/**
 * Simulation configuration - solver parameters and grid settings
 */

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
export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  resolution: 16, // Geodesic subdivisions (128 creates too many cells and crashes)
  stepsPerOrbit: 1024, // Physics steps per orbit (controls timestep granularity)
}

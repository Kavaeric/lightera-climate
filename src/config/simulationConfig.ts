/**
 * Simulation configuration - solver parameters and grid settings
 */

export interface SimulationConfig {
  // Grid resolution
  resolution: number // geodesic subdivisions (e.g., 16 creates ~2,560 cells)
  timeSamples: number // number of time samples to save per orbit (e.g., 60)

  // Solver parameters
  iterations: number // number of orbits to simulate before saving (spin-up for equilibrium)
  physicsStepsPerSample: number // sub-steps per time sample for numerical stability

  // Thermal properties
  groundDiffusion: number // lateral heat conduction coefficient (0-1, 0 = no diffusion)
}

/**
 * Default simulation configuration
 * These values control the accuracy and speed of the simulation
 */
export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  resolution: 64, // Geodesic subdivisions (128 creates too many cells and crashes)
  timeSamples: 365, // Save 60 temperature samples per orbit
  iterations: 64, // Run for 128 orbits to reach thermal equilibrium
  physicsStepsPerSample: 1, // 10 physics steps between each saved sample
  groundDiffusion: 0.05, // Slow subsurface heat conduction
}

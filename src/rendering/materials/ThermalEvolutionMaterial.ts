/**
 * Thermal evolution material factory - creates shader material for physics simulation
 * Solves energy balance equation on GPU to evolve temperatures over time
 */

import * as THREE from 'three'
import { TextureGridSimulation } from '../../util/TextureGridSimulation'
import type { PlanetConfig } from '../../config/planetConfig'
import type { SimulationConfig } from '../../config/simulationConfig'
import fullscreenVertexShader from '../../shaders/fullscreen.vert?raw'
import thermalEvolutionFragmentShader from '../../shaders/thermalEvolution.frag?raw'

/**
 * Create thermal evolution material for climate physics computation
 */
export function createThermalEvolutionMaterial(
  simulation: TextureGridSimulation,
  planetConfig: PlanetConfig,
  simulationConfig: SimulationConfig,
  dt: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: fullscreenVertexShader,
    fragmentShader: thermalEvolutionFragmentShader,
    uniforms: {
      // State texture (set per timestep)
      previousTemperature: { value: null },

      // Grid data
      cellPositions: { value: simulation.cellPositions },
      neighbourIndices1: { value: simulation.neighbourIndices1 },
      neighbourIndices2: { value: simulation.neighbourIndices2 },
      neighbourCounts: { value: simulation.neighbourCounts },

      // Solar parameters
      subsolarPoint: {
        value: new THREE.Vector2(planetConfig.subsolarPoint.lat, planetConfig.subsolarPoint.lon),
      },
      solarFlux: { value: planetConfig.solarFlux },
      albedo: { value: planetConfig.albedo },
      emissivity: { value: planetConfig.emissivity },

      // Thermal parameters
      surfaceHeatCapacity: { value: planetConfig.surfaceHeatCapacity },
      thermalConductivity: { value: simulationConfig.groundDiffusion },

      // Physics timestep
      dt: { value: dt },

      // Texture dimensions
      textureWidth: { value: simulation.getTextureWidth() },
      textureHeight: { value: simulation.getTextureHeight() },

      // Background temperature
      cosmicBackgroundTemp: { value: planetConfig.cosmicBackgroundTemp },
    },
  })
}

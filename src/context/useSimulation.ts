import { useContext, createContext } from 'react'
import type { PlanetConfig } from '../config/planetConfig'
import type { SimulationConfig } from '../config/simulationConfig'
import type { SimulationOrchestrator } from '../util/SimulationOrchestrator'

export interface SimulationContextType {
  // Active configuration (only updated when simulation runs)
  activeSimulationConfig: SimulationConfig
  activePlanetConfig: PlanetConfig

  // Simulation state
  simulationKey: number
  isRunning: boolean

  // Methods to update state
  setActiveSimulationConfig: (config: SimulationConfig) => void
  setActivePlanetConfig: (config: PlanetConfig) => void
  setSimulationKey: (key: number | ((prev: number) => number)) => void

  // Control methods (delegate to orchestrator)
  newSimulation: (simConfig: SimulationConfig, planetConfig: PlanetConfig) => void
  play: () => void
  pause: () => void
  stepOnce: () => void
  step: (numSteps: number) => void

  // Orchestrator access
  registerOrchestrator: (orchestrator: SimulationOrchestrator | null) => void
  getOrchestrator: () => SimulationOrchestrator | null
}

export const SimulationContext = createContext<SimulationContextType | undefined>(undefined)


export function useSimulation() {
  const context = useContext(SimulationContext)
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider')
  }
  return context
}

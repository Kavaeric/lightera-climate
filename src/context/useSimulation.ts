import { useContext, createContext } from 'react'
import type { PlanetConfig } from '../config/planetConfig'
import type { SimulationConfig } from '../config/simulationConfig'
import type { SimulationOrchestrator } from '../util/SimulationOrchestrator'
import type { SimulationRecorder } from '../util/SimulationRecorder'

export interface SimulationContextType {
  // Active configuration (only updated when simulation runs)
  activeSimulationConfig: SimulationConfig
  activePlanetConfig: PlanetConfig

  // Simulation state
  simulationKey: number
  isRunning: boolean
  error: Error | null

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

  // Error handling
  setError: (error: Error | null) => void
  clearError: () => void

  // Orchestrator access
  registerOrchestrator: (orchestrator: SimulationOrchestrator | null) => void
  getOrchestrator: () => SimulationOrchestrator | null

  // Recorder access
  registerRecorder: (recorder: SimulationRecorder | null) => void
  getRecorder: () => SimulationRecorder | null
}

export const SimulationContext = createContext<SimulationContextType | undefined>(undefined)


export function useSimulation() {
  const context = useContext(SimulationContext)
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider')
  }
  return context
}

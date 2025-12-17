import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { PlanetConfig } from '../config/planetConfig'
import type { SimulationConfig } from '../config/simulationConfig'
import { DEFAULT_PLANET_CONFIG } from '../config/planetConfig'
import { DEFAULT_SIMULATION_CONFIG } from '../config/simulationConfig'

interface SimulationContextType {
  // Active configuration (only updated when simulation runs)
  activeSimulationConfig: SimulationConfig
  activePlanetConfig: PlanetConfig

  // Simulation status
  simulationStatus: string

  // Simulation state
  simulationKey: number
  isRunning: boolean
  shouldStepOnce: boolean

  // Methods to update state
  setActiveSimulationConfig: (config: SimulationConfig) => void
  setActivePlanetConfig: (config: PlanetConfig) => void
  setSimulationStatus: (status: string) => void
  setSimulationKey: (key: number | ((prev: number) => number)) => void

  // Control methods
  newSimulation: (simConfig: SimulationConfig, planetConfig: PlanetConfig) => void
  play: () => void
  pause: () => void
  stepOnce: () => void
  clearStepOnce: () => void
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined)

interface SimulationProviderProps {
  children: ReactNode
}

export function SimulationProvider({ children }: SimulationProviderProps) {
  const [activeSimulationConfig, setActiveSimulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG)
  const [activePlanetConfig, setActivePlanetConfig] = useState<PlanetConfig>(DEFAULT_PLANET_CONFIG)
  const [simulationStatus, setSimulationStatus] = useState<string>('Ready')
  const [simulationKey, setSimulationKey] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [shouldStepOnce, setShouldStepOnce] = useState(false)

  const newSimulation = (simConfig: SimulationConfig, planetConfig: PlanetConfig) => {
    setActiveSimulationConfig(simConfig)
    setActivePlanetConfig(planetConfig)
    setSimulationStatus('Ready')
    setIsRunning(false)
    setShouldStepOnce(false)
    setSimulationKey((prev) => prev + 1)
  }

  const play = () => {
    setIsRunning(true)
    setSimulationStatus('Running...')
  }

  const pause = () => {
    setIsRunning(false)
    setSimulationStatus('Paused')
  }

  const stepOnce = () => {
    setShouldStepOnce(true)
  }

  const clearStepOnce = () => {
    setShouldStepOnce(false)
  }

  return (
    <SimulationContext.Provider
      value={{
        activeSimulationConfig,
        activePlanetConfig,
        simulationStatus,
        simulationKey,
        isRunning,
        shouldStepOnce,
        setActiveSimulationConfig,
        setActivePlanetConfig,
        setSimulationStatus,
        setSimulationKey,
        newSimulation,
        play,
        pause,
        stepOnce,
        clearStepOnce,
      }}
    >
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation() {
  const context = useContext(SimulationContext)
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider')
  }
  return context
}

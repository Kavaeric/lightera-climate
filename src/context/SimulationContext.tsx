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
  shouldRunSimulation: boolean

  // Methods to update state
  setActiveSimulationConfig: (config: SimulationConfig) => void
  setActivePlanetConfig: (config: PlanetConfig) => void
  setSimulationStatus: (status: string) => void
  setSimulationKey: (key: number | ((prev: number) => number)) => void

  // Run simulation with given configs
  runSimulation: (simConfig: SimulationConfig, planetConfig: PlanetConfig) => void
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
  const [shouldRunSimulation, setShouldRunSimulation] = useState(false)

  const runSimulation = (simConfig: SimulationConfig, planetConfig: PlanetConfig) => {
    setActiveSimulationConfig(simConfig)
    setActivePlanetConfig(planetConfig)
    setSimulationStatus('Running...')
    setShouldRunSimulation(true)
    setSimulationKey((prev) => prev + 1)
  }

  return (
    <SimulationContext.Provider
      value={{
        activeSimulationConfig,
        activePlanetConfig,
        simulationStatus,
        simulationKey,
        shouldRunSimulation,
        setActiveSimulationConfig,
        setActivePlanetConfig,
        setSimulationStatus,
        setSimulationKey,
        runSimulation,
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

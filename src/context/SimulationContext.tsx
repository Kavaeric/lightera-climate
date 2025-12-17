import { useState, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { PlanetConfig } from '../config/planetConfig'
import type { SimulationConfig } from '../config/simulationConfig'
import { DEFAULT_PLANET_CONFIG } from '../config/planetConfig'
import { DEFAULT_SIMULATION_CONFIG } from '../config/simulationConfig'
import { SimulationContext } from './useSimulation'
import type { SimulationOrchestrator } from '../util/SimulationOrchestrator'

interface SimulationProviderProps {
  children: ReactNode
}

export function SimulationProvider({ children }: SimulationProviderProps) {
  const [activeSimulationConfig, setActiveSimulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG)
  const [activePlanetConfig, setActivePlanetConfig] = useState<PlanetConfig>(DEFAULT_PLANET_CONFIG)
  const [simulationKey, setSimulationKey] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const orchestratorRef = useRef<SimulationOrchestrator | null>(null)

  // Helper to sync isRunning from orchestrator (single source of truth)
  const syncIsRunning = useCallback(() => {
    setIsRunning(orchestratorRef.current?.isRunning() ?? false)
  }, [])

  const newSimulation = (simConfig: SimulationConfig, planetConfig: PlanetConfig) => {
    setActiveSimulationConfig(simConfig)
    setActivePlanetConfig(planetConfig)
    orchestratorRef.current = null
    setSimulationKey((prev) => prev + 1)
  }

  const play = useCallback(() => {
    orchestratorRef.current?.play()
    syncIsRunning()
  }, [syncIsRunning])

  const pause = useCallback(() => {
    orchestratorRef.current?.pause()
    syncIsRunning()
  }, [syncIsRunning])

  const stepOnce = useCallback(() => {
    orchestratorRef.current?.stepOnce()
  }, [])

  const step = useCallback((numSteps: number) => {
    orchestratorRef.current?.requestSteps(numSteps)
  }, [])

  const registerOrchestrator = useCallback((orchestrator: SimulationOrchestrator | null) => {
    orchestratorRef.current = orchestrator
    syncIsRunning()
  }, [syncIsRunning])

  const getOrchestrator = useCallback(() => {
    return orchestratorRef.current
  }, [])

  return (
    <SimulationContext.Provider
      value={{
        activeSimulationConfig,
        activePlanetConfig,
        simulationKey,
        isRunning,
        setActiveSimulationConfig,
        setActivePlanetConfig,
        setSimulationKey,
        newSimulation,
        play,
        pause,
        stepOnce,
        step,
        registerOrchestrator,
        getOrchestrator,
      }}
    >
      {children}
    </SimulationContext.Provider>
  )
}

import { useState, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { OrbitalConfig } from '../config/orbitalConfig'
import type { PlanetaryConfig } from '../config/planetaryConfig'
import type { SimulationConfig } from '../config/simulationConfig'
import { ORBITAL_CONFIG_EARTH } from '../config/orbitalConfig'
import { PLANETARY_CONFIG_EARTH } from '../config/planetaryConfig'
import { SIMULATION_CONFIG_DEFAULT } from '../config/simulationConfig'
import { SimulationContext } from './useSimulation'
import type { SimulationOrchestrator } from '../climate/engine/SimulationOrchestrator'
import type { SimulationRecorder } from '../climate/engine/SimulationRecorder'

interface SimulationProviderProps {
  children: ReactNode
}

export function SimulationProvider({ children }: SimulationProviderProps) {
  const [activeSimulationConfig, setActiveSimulationConfig] = useState<SimulationConfig>(SIMULATION_CONFIG_DEFAULT)
  const [activeOrbitalConfig, setActiveOrbitalConfig] = useState<OrbitalConfig>(ORBITAL_CONFIG_EARTH)
  const [activePlanetaryConfig, setActivePlanetaryConfig] = useState<PlanetaryConfig>(PLANETARY_CONFIG_EARTH)
  const [simulationKey, setSimulationKey] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const orchestratorRef = useRef<SimulationOrchestrator | null>(null)
  const recorderRef = useRef<SimulationRecorder | null>(null)

  // Helper to sync isRunning from orchestrator (single source of truth)
  const syncIsRunning = useCallback(() => {
    setIsRunning(orchestratorRef.current?.isRunning() ?? false)
  }, [])

  const newSimulation = (
    simConfig: SimulationConfig,
    orbitalConfig: OrbitalConfig,
    planetaryConfig: PlanetaryConfig
  ) => {
    setActiveSimulationConfig(simConfig)
    setActiveOrbitalConfig(orbitalConfig)
    setActivePlanetaryConfig(planetaryConfig)
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

  const registerOrchestrator = useCallback((orchestrator: SimulationOrchestrator | null) => {
    orchestratorRef.current = orchestrator
    syncIsRunning()
  }, [syncIsRunning])

  const getOrchestrator = useCallback(() => {
    return orchestratorRef.current
  }, [])

  const registerRecorder = useCallback((recorder: SimulationRecorder | null) => {
    recorderRef.current = recorder
  }, [])

  const getRecorder = useCallback(() => {
    return recorderRef.current
  }, [])

  return (
    <SimulationContext.Provider
      value={{
        simulationKey,
        isRunning,
        activeSimulationConfig,
        activeOrbitalConfig,
        activePlanetaryConfig,
        setActiveSimulationConfig,
        setActiveOrbitalConfig,
        setActivePlanetaryConfig,
        setSimulationKey,
        newSimulation,
        play,
        pause,
        registerOrchestrator,
        getOrchestrator,
        registerRecorder,
        getRecorder,
      }}
    >
      {children}
    </SimulationContext.Provider>
  )
}

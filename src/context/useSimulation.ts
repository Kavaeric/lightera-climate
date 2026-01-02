import { useContext, createContext } from 'react';
import type { OrbitalConfig } from '../config/orbitalConfig';
import type { PlanetaryConfig } from '../config/planetaryConfig';
import type { SimulationConfig } from '../config/simulationConfig';
import type { SimulationOrchestrator } from '../climate/engine/SimulationOrchestrator';
import type { SimulationRecorder } from '../climate/engine/SimulationRecorder';
import type { TextureGridSimulation } from '../climate/engine/TextureGridSimulation';

export interface SimulationContextType {
  // Active configuration (only updated when simulation runs)
  activeSimulationConfig: SimulationConfig;
  activeOrbitalConfig: OrbitalConfig;
  activePlanetaryConfig: PlanetaryConfig;

  // Simulation state
  simulationKey: number;
  isRunning: boolean;

  // Methods to update state
  setActiveSimulationConfig: (config: SimulationConfig) => void;
  setActiveOrbitalConfig: (config: OrbitalConfig) => void;
  setActivePlanetaryConfig: (config: PlanetaryConfig) => void;
  setSimulationKey: (key: number | ((prev: number) => number)) => void;

  // Control methods (delegate to orchestrator)
  newSimulation: (
    simConfig: SimulationConfig,
    orbitalConfig: OrbitalConfig,
    planetaryConfig: PlanetaryConfig
  ) => void;
  play: () => void;
  pause: () => void;

  // Orchestrator access
  registerOrchestrator: (orchestrator: SimulationOrchestrator | null) => void;
  getOrchestrator: () => SimulationOrchestrator | null;

  // Recorder access
  registerRecorder: (recorder: SimulationRecorder | null) => void;
  getRecorder: () => SimulationRecorder | null;

  // Simulation access
  registerSimulation: (simulation: TextureGridSimulation | null) => void;
  getSimulation: () => TextureGridSimulation | null;
}

export const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
}

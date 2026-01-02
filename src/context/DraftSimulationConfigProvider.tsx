import { useState, type ReactNode } from 'react';
import { SIMULATION_CONFIG_DEFAULT, type SimulationConfig } from '../config/simulationConfig';
import { DraftSimulationConfigContext } from './useDraftSimulationConfig';

interface DraftSimulationConfigProviderProps {
  children: ReactNode;
}

export function DraftSimulationConfigProvider({ children }: DraftSimulationConfigProviderProps) {
  const [draftSimulationConfig, setDraftSimulationConfig] =
    useState<SimulationConfig>(SIMULATION_CONFIG_DEFAULT);

  return (
    <DraftSimulationConfigContext.Provider
      value={{
        draftSimulationConfig,
        setDraftSimulationConfig,
      }}
    >
      {children}
    </DraftSimulationConfigContext.Provider>
  );
}


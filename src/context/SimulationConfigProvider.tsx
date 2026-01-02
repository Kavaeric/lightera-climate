import { useState, type ReactNode } from 'react';
import { SIMULATION_CONFIG_DEFAULT, type SimulationConfig } from '../config/simulationConfig';
import { SimulationConfigContext } from './useSimulationConfig';

interface SimulationConfigProviderProps {
  children: ReactNode;
}

export function SimulationConfigProvider({ children }: SimulationConfigProviderProps) {
  const [pendingSimulationConfig, setPendingSimulationConfig] =
    useState<SimulationConfig>(SIMULATION_CONFIG_DEFAULT);

  return (
    <SimulationConfigContext.Provider
      value={{
        pendingSimulationConfig,
        setPendingSimulationConfig,
      }}
    >
      {children}
    </SimulationConfigContext.Provider>
  );
}


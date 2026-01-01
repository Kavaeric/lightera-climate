import { createContext, useContext, useState, type ReactNode } from 'react';
import { SIMULATION_CONFIG_DEFAULT, type SimulationConfig } from '../config/simulationConfig';

interface SimulationConfigContextType {
  pendingSimulationConfig: SimulationConfig;
  setPendingSimulationConfig: (config: SimulationConfig) => void;
}

const SimulationConfigContext = createContext<SimulationConfigContextType | null>(null);

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

export function useSimulationConfig() {
  const context = useContext(SimulationConfigContext);
  if (!context) {
    throw new Error('useSimulationConfig must be used within a SimulationConfigProvider');
  }
  return context;
}

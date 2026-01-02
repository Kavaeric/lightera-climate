import { useContext, createContext } from 'react';
import type { SimulationConfig } from '../config/simulationConfig';

export interface SimulationConfigContextType {
  pendingSimulationConfig: SimulationConfig;
  setPendingSimulationConfig: (config: SimulationConfig) => void;
}

export const SimulationConfigContext = createContext<SimulationConfigContextType | undefined>(undefined);

export function useSimulationConfig() {
  const context = useContext(SimulationConfigContext);
  if (context === undefined) {
    throw new Error('useSimulationConfig must be used within a SimulationConfigProvider');
  }
  return context;
}

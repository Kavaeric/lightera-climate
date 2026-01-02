import { useContext, createContext } from 'react';
import type { SimulationConfig } from '../config/simulationConfig';

export interface DraftSimulationConfigContextType {
  draftSimulationConfig: SimulationConfig;
  setDraftSimulationConfig: (config: SimulationConfig) => void;
}

export const DraftSimulationConfigContext = createContext<DraftSimulationConfigContextType | undefined>(undefined);

export function useDraftSimulationConfig() {
  const context = useContext(DraftSimulationConfigContext);
  if (context === undefined) {
    throw new Error('useDraftSimulationConfig must be used within a DraftSimulationConfigProvider');
  }
  return context;
}

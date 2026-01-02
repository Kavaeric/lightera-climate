import { useContext, createContext } from 'react';
import type { OrbitalConfig } from '../config/orbitalConfig';

export interface DraftOrbitalConfigContextType {
  draftOrbitalConfig: OrbitalConfig;
  setDraftOrbitalConfig: (config: OrbitalConfig) => void;
}

export const DraftOrbitalConfigContext = createContext<DraftOrbitalConfigContextType | undefined>(undefined);

export function useDraftOrbitalConfig() {
  const context = useContext(DraftOrbitalConfigContext);
  if (context === undefined) {
    throw new Error('useDraftOrbitalConfig must be used within a DraftOrbitalConfigProvider');
  }
  return context;
}

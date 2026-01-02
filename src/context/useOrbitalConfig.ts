import { useContext, createContext } from 'react';
import type { OrbitalConfig } from '../config/orbitalConfig';

export interface OrbitalConfigContextType {
  orbitalConfig: OrbitalConfig;
  setOrbitalConfig: (config: OrbitalConfig) => void;
}

export const OrbitalConfigContext = createContext<OrbitalConfigContextType | undefined>(undefined);

export function useOrbitalConfig() {
  const context = useContext(OrbitalConfigContext);
  if (context === undefined) {
    throw new Error('useOrbitalConfig must be used within an OrbitalConfigProvider');
  }
  return context;
}

import { useState, type ReactNode } from 'react';
import { ORBITAL_CONFIG_EARTH, type OrbitalConfig } from '../config/orbitalConfig';
import { DraftOrbitalConfigContext } from './useDraftOrbitalConfig';

interface DraftOrbitalConfigProviderProps {
  children: ReactNode;
}

export function DraftOrbitalConfigProvider({ children }: DraftOrbitalConfigProviderProps) {
  const [draftOrbitalConfig, setDraftOrbitalConfig] = useState<OrbitalConfig>(ORBITAL_CONFIG_EARTH);

  return (
    <DraftOrbitalConfigContext.Provider
      value={{
        draftOrbitalConfig,
        setDraftOrbitalConfig,
      }}
    >
      {children}
    </DraftOrbitalConfigContext.Provider>
  );
}

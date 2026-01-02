import { useState, type ReactNode } from 'react';
import { ORBITAL_CONFIG_EARTH, type OrbitalConfig } from '../config/orbitalConfig';
import { OrbitalConfigContext } from './useOrbitalConfig';

interface OrbitalConfigProviderProps {
  children: ReactNode;
}

export function OrbitalConfigProvider({ children }: OrbitalConfigProviderProps) {
  const [orbitalConfig, setOrbitalConfig] = useState<OrbitalConfig>(ORBITAL_CONFIG_EARTH);

  return (
    <OrbitalConfigContext.Provider
      value={{
        orbitalConfig,
        setOrbitalConfig,
      }}
    >
      {children}
    </OrbitalConfigContext.Provider>
  );
}

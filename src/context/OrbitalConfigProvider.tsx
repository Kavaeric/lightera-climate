import { createContext, useContext, useState, type ReactNode } from 'react'
import { ORBITAL_CONFIG_EARTH, type OrbitalConfig } from '../config/orbitalConfig'

interface OrbitalConfigContextType {
  orbitalConfig: OrbitalConfig
  setOrbitalConfig: (config: OrbitalConfig) => void
}

const OrbitalConfigContext = createContext<OrbitalConfigContextType | null>(null)

interface OrbitalConfigProviderProps {
  children: ReactNode
}

export function OrbitalConfigProvider({ children }: OrbitalConfigProviderProps) {
  const [orbitalConfig, setOrbitalConfig] = useState<OrbitalConfig>(ORBITAL_CONFIG_EARTH)

  return (
    <OrbitalConfigContext.Provider value={{
      orbitalConfig,
      setOrbitalConfig,
    }}>
      {children}
    </OrbitalConfigContext.Provider>
  )
}

export function useOrbitalConfig() {
  const context = useContext(OrbitalConfigContext)
  if (!context) {
    throw new Error('useOrbitalConfig must be used within an OrbitalConfigProvider')
  }
  return context
}
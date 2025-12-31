import { useContext, createContext } from 'react'
import type { DisplayConfig } from '../config/displayConfig'

export interface DisplayConfigContextType {
  displayConfig: DisplayConfig
  setDisplayConfig: (config: DisplayConfig | ((prev: DisplayConfig) => DisplayConfig)) => void
  showLatLonGrid: boolean
  setShowLatLonGrid: (show: boolean) => void
}

export const DisplayConfigContext = createContext<DisplayConfigContextType | undefined>(undefined)

export function useDisplayConfig() {
  const context = useContext(DisplayConfigContext)
  if (context === undefined) {
    throw new Error('useDisplayConfig must be used within a DisplayConfigProvider')
  }
  return context
}

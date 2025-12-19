import { useState, useCallback, type ReactNode } from 'react'
import { DEFAULT_DISPLAY_CONFIG, type DisplayConfig } from '../config/displayConfig'
import { DisplayConfigContext } from './useDisplayConfig'

interface DisplayConfigProviderProps {
  children: ReactNode
}

export function DisplayConfigProvider({ children }: DisplayConfigProviderProps) {
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG)

  const handleSetDisplayConfig = useCallback((config: DisplayConfig | ((prev: DisplayConfig) => DisplayConfig)) => {
    setDisplayConfig(config)
  }, [])

  return (
    <DisplayConfigContext.Provider
      value={{
        displayConfig,
        setDisplayConfig: handleSetDisplayConfig,
      }}
    >
      {children}
    </DisplayConfigContext.Provider>
  )
}

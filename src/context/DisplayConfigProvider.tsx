import { useState, useCallback, type ReactNode } from 'react';
import { DISPLAY_CONFIG_DEFAULT, type DisplayConfig } from '../config/displayConfig';
import { DisplayConfigContext } from './useDisplayConfig';

interface DisplayConfigProviderProps {
  children: ReactNode;
}

export function DisplayConfigProvider({ children }: DisplayConfigProviderProps) {
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DISPLAY_CONFIG_DEFAULT);
  const [showLatLonGrid, setShowLatLonGrid] = useState(true);

  const handleSetDisplayConfig = useCallback(
    (config: DisplayConfig | ((prev: DisplayConfig) => DisplayConfig)) => {
      setDisplayConfig(config);
    },
    []
  );

  return (
    <DisplayConfigContext.Provider
      value={{
        displayConfig,
        setDisplayConfig: handleSetDisplayConfig,
        showLatLonGrid,
        setShowLatLonGrid,
      }}
    >
      {children}
    </DisplayConfigContext.Provider>
  );
}

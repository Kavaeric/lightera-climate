import { useState, type ReactNode } from 'react';
import { RuntimeControlsContext } from './useRuntimeControls';

interface RuntimeControlsProviderProps {
  children: ReactNode;
}

export function RuntimeControlsProvider({ children }: RuntimeControlsProviderProps) {
  const [stepsPerFrame, setStepsPerFrame] = useState(100);
  const [samplesPerOrbit, setSamplesPerOrbit] = useState(32);

  return (
    <RuntimeControlsContext.Provider
      value={{
        stepsPerFrame,
        setStepsPerFrame,
        samplesPerOrbit,
        setSamplesPerOrbit,
      }}
    >
      {children}
    </RuntimeControlsContext.Provider>
  );
}


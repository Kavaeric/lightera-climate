import { createContext, useContext, useState, type ReactNode } from 'react';

interface RuntimeControlsContextType {
  stepsPerFrame: number;
  setStepsPerFrame: (steps: number) => void;
  samplesPerOrbit: number;
  setSamplesPerOrbit: (samples: number) => void;
}

const RuntimeControlsContext = createContext<RuntimeControlsContextType | null>(null);

interface RuntimeControlsProviderProps {
  children: ReactNode;
}

export function RuntimeControlsProvider({ children }: RuntimeControlsProviderProps) {
  const [stepsPerFrame, setStepsPerFrame] = useState(500);
  const [samplesPerOrbit, setSamplesPerOrbit] = useState(50);

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

export function useRuntimeControls() {
  const context = useContext(RuntimeControlsContext);
  if (!context) {
    throw new Error('useRuntimeControls must be used within a RuntimeControlsProvider');
  }
  return context;
}

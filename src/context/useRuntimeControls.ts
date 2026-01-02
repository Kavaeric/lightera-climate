import { useContext, createContext } from 'react';

export interface RuntimeControlsContextType {
  stepsPerFrame: number;
  setStepsPerFrame: (steps: number) => void;
  samplesPerOrbit: number;
  setSamplesPerOrbit: (samples: number) => void;
}

export const RuntimeControlsContext = createContext<RuntimeControlsContextType | undefined>(undefined);

export function useRuntimeControls() {
  const context = useContext(RuntimeControlsContext);
  if (context === undefined) {
    throw new Error('useRuntimeControls must be used within a RuntimeControlsProvider');
  }
  return context;
}

import { createContext, useContext } from 'react';

// Create the context for automatic heading level management
export interface HeadingContextType {
  readonly level: number;
}

export const HeadingContext = createContext<HeadingContextType>({ level: 1 });

// Hook to use the heading context
export const useHeadingContext = (): HeadingContextType => {
  return useContext(HeadingContext);
};

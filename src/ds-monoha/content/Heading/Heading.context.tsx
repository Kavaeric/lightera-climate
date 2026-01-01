import { type FC, type ReactNode, useMemo } from 'react';
import { HeadingContext, useHeadingContext } from './Heading.hooks';

// Props for the HeadingContext provider
export interface HeadingContextProviderProps {
  /**
   * The child components that will inherit the heading context
   */
  readonly children: ReactNode;

  /**
   * Optional offset to apply to the current heading level.
   * If provided, adds this offset to the parent context level.
   * Useful for creating nested heading hierarchies with specific level relationships.
   */
  readonly level?: number;
}

/**
 * HeadingContext provider that automatically manages heading levels for nested headings.
 *
 * Refer to the README.md for more information.
 */
export const HeadingContextProvider: FC<HeadingContextProviderProps> = ({ children, level }) => {
  const parentContext = useHeadingContext();
  // If level is provided, use it as an absolute level; otherwise increment by 1
  const currentLevel = level ? Math.min(level, 6) : Math.min(parentContext.level + 1, 6);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ level: currentLevel }), [currentLevel]);

  return <HeadingContext.Provider value={contextValue}>{children}</HeadingContext.Provider>;
};

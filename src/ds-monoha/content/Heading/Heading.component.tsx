import {
  type ElementType,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { type NonInteractiveProps } from '../../core/types';
import { type HeadingSizeTokens, type SemanticColorTokens } from '../../tokens/types';
import { useHeadingContext } from './Heading.hooks';
import styles from './Heading.module.scss';

// Props for the Heading component - excluding interactive attributes
export interface HeadingProps extends NonInteractiveProps<HTMLAttributes<HTMLElement>> {
  /**
   * The text content to display as a heading
   */
  readonly children: ReactNode;

  /**
   * Specify the semantic HTML element (h1-h6) or use custom levels (h7-h9).
   * When not specified, the component automatically determines the level from `<HeadingContextProvider>`.
   */
  readonly as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'h7' | 'h8' | 'h9';

  /**
   * Visual size variant that controls typography scale.
   * Choose from the following sizes:
   * - `3xl`
   * - `2xl`
   * - `xl`
   * - `lg`
   * - `md`
   * - `sm`
   * - `xs`
   * - `2xs`
   */
  readonly size?: HeadingSizeTokens;

  /**
   * Semantic colour token for the heading text.
   * Choose from the following colours:
   * - `neutral`
   * - `bold`
   * - `subtle`
   * - `brand`
   * - `brand-bold`
   * - `brand-inverse`
   */
  readonly color?: SemanticColorTokens;
}

/**
 * Heading component that provides controlled but flexible styling for heading styles
 * defined in the design system's tokens, with automatic semantic level management.
 *
 * Refer to the README.md for more information.
 */
export const Heading = forwardRef<HTMLElement, HeadingProps>(
  ({ children, as, size, color, className = '', ...props }, ref) => {
    const context = useHeadingContext();

    // Determine the semantic level - use explicit 'as' prop or context level
    const semanticLevel = as ? Number.parseInt(as.slice(1), 10) : context.level;

    // Infer size from semantic level if not explicitly provided
    const sizeVariant =
      size ||
      (() => {
        switch (semanticLevel) {
          case 1: {
            return 'xl';
          }

          case 2: {
            return 'lg';
          }

          default: {
            return 'md';
          }
        }
      })();

    // Build CSS classes based on size variant and color
    const headingClasses = [
      styles['heading'],
      styles[`heading-${sizeVariant}`],
      color && styles[`heading-${color}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Determine the element to render based on semantic level
    let Component: ElementType;
    let additionalProps: Record<string, unknown> = {};

    if (semanticLevel >= 7) {
      // For levels 7-9, render as span with ARIA attributes
      Component = 'span';
      additionalProps = {
        role: 'heading',
        'aria-level': semanticLevel,
      };
    } else {
      // For levels 1-6, render as the appropriate h1-h6 element
      Component = `h${semanticLevel}` as ElementType;
    }

    return (
      <Component className={headingClasses} ref={ref} {...additionalProps} {...props}>
        {children}
      </Component>
    );
  },
);

Heading.displayName = 'Heading';

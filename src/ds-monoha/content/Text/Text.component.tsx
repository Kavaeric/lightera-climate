import { type ElementType, type HTMLAttributes, type ReactNode, type JSX } from 'react';
import { type NonInteractiveProps } from '../../core/types';
import { type BodyTextSizeTokens, type SemanticColorTokens } from '../../tokens/types';
import styles from './Text.module.scss';

// Props for the Text component
export interface TextProps<T extends ElementType = 'span'> extends NonInteractiveProps<
  HTMLAttributes<HTMLElement>
> {
  /** The text content to display. */
  readonly children: ReactNode;
  /** Additional CSS classes to apply to the text element. */
  readonly className?: string;
  /** HTML element to render the text as. */
  readonly as?: T;
  /** Body text size variant that controls typography scale. */
  readonly size?: BodyTextSizeTokens;
  /** Semantic colour token for the text. */
  readonly color?: SemanticColorTokens;
}

/**
 * Text component that provides controlled but flexible styling for body text styles
 * defined in the design system's tokens.
 *
 * Refer to the README.md for more information.
 */
export const Text = <T extends ElementType = 'span'>({
  children,
  className = '',
  as,
  size,
  color,
  ...props
}: TextProps<T>): JSX.Element => {
  const Component = as || 'span';

  // Build CSS classes based on size variant and color
  const textClasses = [
    styles['text'],
    size && styles[`text-${size}`],
    color && styles[`text-${color}`],
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <Component className={textClasses} {...props}>
      {children}
    </Component>
  );
};

import React, { type ElementType, forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { type FlexElement, type NonInteractiveProps } from '../../core/types';
import { type SpacingTokens } from '../../tokens/types';
import styles from './Stack.module.scss';

export interface StackProps<T extends ElementType = 'div'>
  extends NonInteractiveProps<HTMLAttributes<HTMLElement>> {
  /** Content to be laid out vertically. */
  readonly children?: ReactNode;
  /** Additional CSS classes to apply to the stack element. */
  readonly className?: string;
  /** HTML element to render the component as. */
  readonly as?: T;
  /** Space between child elements in the block direction. */
  readonly gap?: SpacingTokens;
  /** Alignment of children in the block direction (main-axis). */
  readonly alignBlock?: 'start' | 'center' | 'end' | 'stretch';
  /** Distribution of children along the inline direction (cross-axis). */
  readonly alignInline?: 'start' | 'center' | 'end' | 'spread';
  /** Whether the component should expand to fill its container. */
  readonly fill?: boolean;
  /** Whether the component should size itself to fit its content. */
  readonly hug?: boolean;
  /** Whether content should wrap to new columns when exceeding container height. */
  readonly wrap?: boolean;
  /** Space between wrapped columns when wrap is enabled. */
  readonly wrapGap?: SpacingTokens;
  /** Padding on all sides using design system spacing tokens. */
  readonly padding?: SpacingTokens;
  /** Padding on left and right sides. */
  readonly paddingInline?: SpacingTokens;
  /** Padding on block start and end sides. */
  readonly paddingBlock?: SpacingTokens;
  /** Padding on the left side only. */
  readonly paddingInlineStart?: SpacingTokens;
  /** Padding on the right side only. */
  readonly paddingInlineEnd?: SpacingTokens;
  /** Padding on the top side only. */
  readonly paddingBlockStart?: SpacingTokens;
  /** Padding on the bottom side only. */
  readonly paddingBlockEnd?: SpacingTokens;
}

/**
 * Stack component for block-axis (vertical) layouts.
 * Polymorphic component that can render as various semantic HTML elements.
 *
 * Refer to the README.md for more information.
 */
export const Stack = forwardRef(
  <T extends FlexElement = 'div'>(
    {
      children,
      className,
      as,
      gap,
      alignBlock,
      alignInline,
      fill,
      hug,
      wrap,
      wrapGap,
      padding,
      paddingInline,
      paddingBlock,
      paddingInlineStart,
      paddingInlineEnd,
      paddingBlockStart,
      paddingBlockEnd,
      style,
      ...props
    }: StackProps<T>,
    ref: React.ForwardedRef<HTMLElement>,
  ): React.JSX.Element => {
    const Component = (as || 'div') as ElementType;

    const gapStyle = gap ? { gap: `var(--spacing-${gap})` } : {};
    const wrapGapStyle = wrapGap ? { '--wrap-gap': `var(--spacing-${wrapGap})` } : {};

    // Padding styles using spacing tokens
    const paddingStyle = padding ? { padding: `var(--spacing-${padding})` } : {};
    const paddingInlineStyle = paddingInline
      ? { paddingInline: `var(--spacing-${paddingInline})` }
      : {};

    const paddingBlockStyle = paddingBlock
      ? { paddingBlock: `var(--spacing-${paddingBlock})` }
      : {};

    const paddingInlineStartStyle = paddingInlineStart
      ? { paddingInlineStart: `var(--spacing-${paddingInlineStart})` }
      : {};

    const paddingInlineEndStyle = paddingInlineEnd
      ? { paddingInlineEnd: `var(--spacing-${paddingInlineEnd})` }
      : {};

    const paddingBlockStartStyle = paddingBlockStart
      ? { paddingBlockStart: `var(--spacing-${paddingBlockStart})` }
      : {};

    const paddingBlockEndStyle = paddingBlockEnd
      ? { paddingBlockEnd: `var(--spacing-${paddingBlockEnd})` }
      : {};

    const combinedStyle = {
      ...gapStyle,
      ...wrapGapStyle,
      ...paddingStyle,
      ...paddingInlineStyle,
      ...paddingBlockStyle,
      ...paddingInlineStartStyle,
      ...paddingInlineEndStyle,
      ...paddingBlockStartStyle,
      ...paddingBlockEndStyle,
      ...style,
    };

    const stackClasses = [
      styles['stack'],
      hug && styles['stack--hug'],
      fill && styles['stack--fill'],
      wrap && styles['stack--wrap'],
      alignBlock && styles[`stack--align-block-${alignBlock}`],
      alignInline && styles[`stack--align-inline-${alignInline}`],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Component className={stackClasses} ref={ref} style={combinedStyle} {...props}>
        {children}
      </Component>
    );
  },
);

Stack.displayName = 'Stack';

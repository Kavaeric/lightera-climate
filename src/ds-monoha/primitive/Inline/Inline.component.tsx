import React, { type ElementType, forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { type FlexElement, type NonInteractiveProps } from '../../core/types';
import { type BorderRadiusTokens, type SpacingTokens } from '../../tokens/types';
import styles from './Inline.module.scss';

export interface InlineProps<T extends ElementType = 'div'> extends NonInteractiveProps<
  HTMLAttributes<HTMLElement>
> {
  /** Content to be laid out horizontally. */
  readonly children?: ReactNode;
  /** Additional CSS classes to apply to the inline element. */
  readonly className?: string;
  /** HTML element to render the component as. */
  readonly as?: T;
  /** Space between child elements in the inline direction. */
  readonly gap?: SpacingTokens;
  /** Alignment of children in the block direction (cross-axis). */
  readonly alignBlock?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  /** Distribution of children along the inline direction (main-axis). */
  readonly alignInline?: 'start' | 'center' | 'end' | 'spread';
  /** Whether the component should expand to fill its container. */
  readonly fill?: boolean;
  /** Whether the component should size itself to fit its content. */
  readonly hug?: boolean;
  /** Whether content should wrap to new lines when exceeding container width. */
  readonly wrap?: boolean;
  /** Space between wrapped rows when wrap is enabled. */
  readonly wrapGap?: SpacingTokens;
  /** Padding on all sides using design system spacing tokens. */
  readonly padding?: SpacingTokens;
  /** Padding on start and end sides (left and right in English). */
  readonly paddingInline?: SpacingTokens;
  /** Padding on block start and end sides (top and bottom in English). */
  readonly paddingBlock?: SpacingTokens;
  /** Padding on the start side only (left in English). */
  readonly paddingInlineStart?: SpacingTokens;
  /** Padding on the end side only (right in English). */
  readonly paddingInlineEnd?: SpacingTokens;
  /** Padding on the top side only. */
  readonly paddingBlockStart?: SpacingTokens;
  /** Padding on the bottom side only. */
  readonly paddingBlockEnd?: SpacingTokens;
  /** Border radius for the container using design system tokens. */
  readonly borderRadius?: BorderRadiusTokens;
}

/**
 * Inline component for inline-axis (horizontal) layouts.
 * Polymorphic component that can render as various semantic HTML elements.
 */
export const Inline = forwardRef(
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
      borderRadius,
      style,
      ...props
    }: InlineProps<T>,
    ref: React.ForwardedRef<HTMLElement>
  ): React.JSX.Element => {
    const Component = (as || 'div') as ElementType;

    const gapStyle = gap ? { gap: `var(--spacing-${gap})` } : {};
    const wrapGapStyle = wrapGap ? { rowGap: `var(--spacing-${wrapGap})` } : {};

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

    const borderRadiusStyle = borderRadius
      ? { borderRadius: `var(--border-radius-${borderRadius})` }
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
      ...borderRadiusStyle,
      ...style,
    };

    const inlineClasses = [
      styles['inline'],
      hug && styles['inline--hug'],
      fill && styles['inline--fill'],
      wrap && styles['inline--wrap'],
      alignBlock && styles[`inline--align-block-${alignBlock}`],
      alignInline && styles[`inline--align-inline-${alignInline}`],
      className,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return (
      <Component className={inlineClasses} ref={ref} style={combinedStyle} {...props}>
        {children}
      </Component>
    );
  }
);

Inline.displayName = 'Inline';

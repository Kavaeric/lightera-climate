import { type ButtonHTMLAttributes, type ForwardedRef, forwardRef, type ReactNode } from 'react';
import { filterInteractiveProps } from '../../util/filterInteractiveProps';
import styles from './Action.module.scss';

export interface ActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /** Content to render inside the action element. */
  readonly children: ReactNode;
  /** Additional CSS classes to apply to the action element. */
  readonly className?: string;
  /** HTML button type attribute. */
  readonly type?: 'button' | 'submit' | 'reset';
  /** Whether the action is disabled and cannot be interacted with. */
  readonly disabled?: boolean;
  /** Accessible label for screen readers. */
  readonly 'aria-label'?: string;
  /** Reference to an element that describes the action. */
  readonly 'aria-describedby'?: string;
  /** Whether the action is in a pressed state. */
  readonly 'aria-pressed'?: boolean | 'mixed';
  /** Whether the action controls an expanded element. */
  readonly 'aria-expanded'?: boolean;
  /** ID of element controlled by this action. */
  readonly 'aria-controls'?: string;
  /** Use inset focus ring instead of default outside focus ring. */
  readonly inset?: 'outside' | 'inside' | 'inset';
}

/**
 * Action component for interactive elements that perform actions (buttons, form submissions, etc.)
 *
 * This component provides basic accessibility and focus styling while preventing accidental
 * form submissions by defaulting to type="button".
 */
export const Action = forwardRef<HTMLButtonElement | HTMLSpanElement, ActionProps>(
  (
    {
      children,
      className,
      type = 'button',
      disabled = false,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedby,
      'aria-pressed': ariaPressed,
      'aria-expanded': ariaExpanded,
      'aria-controls': ariaControls,
      inset = 'outside',
      ...props
    },
    ref,
  ) => {
    // Build CSS classes - basic action class for focus styling + any custom classes
    // Include inset focus ring class if specified
    const mergedClassNames =
      `${styles['action']} ${inset ? styles[`focus-${inset}`] : ''} ${className ?? ''}`.trim();

    // When disabled, render a tabbable span instead of a button
    if (disabled) {
      // Filter out interactive event handlers when disabled
      const nonInteractiveProps = filterInteractiveProps(props);

      return (
        <span
          aria-controls={ariaControls}
          aria-describedby={ariaDescribedby}
          aria-disabled="true"
          aria-expanded={ariaExpanded}
          aria-label={ariaLabel}
          aria-pressed={ariaPressed}
          className={mergedClassNames}
          ref={ref as ForwardedRef<HTMLSpanElement>}
          role="button"
          tabIndex={0}
          {...nonInteractiveProps}
        >
          {children}
        </span>
      );
    }

    return (
      <button
        aria-controls={ariaControls}
        aria-describedby={ariaDescribedby}
        aria-expanded={ariaExpanded}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        className={mergedClassNames}
        ref={ref as ForwardedRef<HTMLButtonElement>}
        type={type}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Action.displayName = 'Action';

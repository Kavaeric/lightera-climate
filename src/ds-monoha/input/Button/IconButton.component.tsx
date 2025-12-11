import { forwardRef } from 'react';
import { Icon, Spinner } from '../../graphic';
import { Action, type ActionProps } from '../../primitive';
import baseStyles from './ButtonBase.module.scss';
import styles from './IconButton.module.scss';

export interface IconButtonProps
  extends Partial<
    Pick<
      ActionProps,
      | 'id'
      | 'disabled'
      | 'onClick'
      | 'className'
      | 'type'
      | 'aria-label'
      | 'aria-describedby'
      | 'aria-pressed'
      | 'aria-expanded'
      | 'aria-controls'
    >
  > {
  /** Material Symbol icon name to display on the button. */
  readonly icon: string;
  /** Visual style variant of the button. */
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  /** Whether the button should use danger styling. */
  readonly danger?: boolean;
  /** Size variant of the button. */
  readonly size?: 'sm' | 'md' | 'lg';
  /** Whether the button is in a loading state. */
  readonly loading?: boolean;
  /** Whether the button is in a selected/pressed state. */
  readonly selected?: boolean;
  /** Whether the button is in a pressed state. */
  readonly pressed?: boolean;
}

/**
 * IconButton component for icon-only interactive actions.
 *
 * Refer to the README.md for more information.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      id,
      icon,
      variant = 'secondary',
      danger = false,
      size = 'md',
      disabled = false,
      loading = false,
      selected,
      pressed,
      onClick,
      className,
      type = 'button',
      'aria-label': ariaLabelProp,
      'aria-describedby': ariaDescribedby,
    },
    ref,
  ) => {

    const buttonClassNames = [
      baseStyles.button,
      baseStyles[`button-${variant}`],
      styles[`icon-button-${size}`],
      danger && baseStyles['button-danger'],
      className,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Prevent onClick when loading
    const handleClick = loading ? undefined : onClick;

    // When loading, announce to screen readers
    const ariaLabel = loading ? `${ariaLabelProp} loading...` : ariaLabelProp;

    return (
      <Action
        aria-busy={loading}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        aria-pressed={pressed ?? undefined}
        aria-selected={selected ?? undefined}
        className={buttonClassNames}
        disabled={disabled || loading}
        id={id}
        inset={variant === 'primary' ? 'inset' : 'inside'}
        onClick={handleClick}
        ref={ref}
        type={type}
      >
        {/* Icon content - centered in middle column */}
        <div
          className={`${baseStyles['button-middle']} ${styles['icon-button-icon-wrapper']}`}
          data-button-middle-icon
        >
          <Icon name={icon} size="sm" />
        </div>

        {/* Loading overlay - absolutely positioned and centred */}
        {loading && (
          <div className={baseStyles['loading-overlay']}>
            <Spinner size="sm" />
          </div>
        )}
      </Action>
    );
  },
);

IconButton.displayName = 'IconButton';

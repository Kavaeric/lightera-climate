import { forwardRef, type ReactNode } from 'react';
import { Icon, Spinner } from '../../graphic';
import { Action, type ActionProps } from '../../primitive';
import styles from './Button.module.scss';
import baseStyles from './ButtonBase.module.scss';

export interface ButtonProps
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
  /** Text label displayed on the button. */
  readonly label: string;
  /** Visual style variant of the button. */
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  /** Size variant of the button. */
  readonly size?: 'sm' | 'md' | 'lg';
  /** Whether the button is in a loading state. */
  readonly loading?: boolean;
  /** Whether the button is in a selected state. */
  readonly selected?: boolean;
  /** Whether the button is in a pressed state. */
  readonly pressed?: boolean;
  /** Content to display before the label. Can be a string (rendered as Icon) or React element. */
  readonly start?: string | ReactNode;
  /** Content to display after the label. Can be a string (rendered as Icon) or React element. */
  readonly end?: string | ReactNode;
  /** Whether the button should collapse its label on mobile screens. */
  readonly mobileCollapse?: boolean;
}

/**
 * Button component for primary interactive actions.
 *
 * Refer to the README.md for more information.
 */
export const Button = forwardRef<HTMLElement, ButtonProps>(
  (
    {
      id,
      label,
      variant = 'secondary',
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
      start,
      end,
      mobileCollapse = false,
    },
    ref,
  ) => {

    // TODO: Use classNames util once we can properly type CSS modules
    const buttonClassNames = [
      baseStyles['button'],
      baseStyles[`button-${variant}`],
      styles[`button-${size}`],
      mobileCollapse && styles['button-mobile-collapse'],
      className,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Prevent onClick when loading
    const handleClick = loading ? undefined : onClick;

    // When loading, announce to screen readers
    const ariaLabel = loading ? `${ariaLabelProp ?? ''} loading...` : ariaLabelProp;

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
        {start && (
          <div
            className={`${baseStyles['button-start']} ${styles['button-start']}`}
            data-button-start
          >
            {typeof start === 'string' ? (
              mobileCollapse ? (
                <>
                  {/* Mobile icon with explicit small size */}
                  <Icon name={start} size="sm" className={styles['icon-mobile']} />
                  {/* Desktop icon with normal sizing */}
                  <Icon
                    name={start}
                    size={size === 'lg' ? 'sm' : undefined}
                    className={styles['icon-desktop']}
                  />
                </>
              ) : (
                /* Single icon for non-responsive mode */
                <Icon name={start} size={size === 'lg' ? 'sm' : undefined} />
              )
            ) : (
              start
            )}
          </div>
        )}

        <div
          className={`${baseStyles['button-middle']} ${styles['button-middle']} ${
            mobileCollapse ? styles['button-middle-mobile-collapse'] : ''
          }`}
          data-button-middle
        >
          <span className={`${styles['button-middle-label']}`}>{label}</span>
        </div>

        {end && (
          <div className={`${baseStyles['button-end']} ${styles['button-end']}`} data-button-end>
            {typeof end === 'string' ? <Icon name={end} /> : end}
          </div>
        )}

        {/* Loading overlay - absolutely positioned and centred */}
        {loading && (
          <div className={baseStyles['loading-overlay']} data-loading-overlay>
            {mobileCollapse ? (
              <>
                {/* Mobile spinner with explicit small size */}
                <Spinner size="sm" className={styles['spinner-mobile']} />
                {/* Desktop spinner with normal sizing */}
                <Spinner
                  size={size === 'lg' ? 'sm' : undefined}
                  className={styles['spinner-desktop']}
                />
              </>
            ) : (
              /* Single spinner for non-responsive mode */
              <Spinner size={size === 'lg' ? 'sm' : undefined} />
            )}
          </div>
        )}
      </Action>
    );
  },
);

Button.displayName = 'Button';

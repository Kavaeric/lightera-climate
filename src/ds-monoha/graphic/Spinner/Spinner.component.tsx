import { useEffect, useRef, useState } from 'react';
import type { IconSizeTokens } from '../../tokens/types';
import styles from './Spinner.module.scss';

export interface SpinnerProps {
  /** Additional CSS classes to apply to the spinner. */
  readonly className?: string;
  /** Whether to use the emphasised (bold) spinner variant. */
  readonly em?: boolean;
  /** Predefined size variant for the spinner. */
  readonly size?: IconSizeTokens;
  /** Additional inline styles to apply to the spinner. */
  readonly style?: React.CSSProperties;
}

export const Spinner = ({ className, em = false, size, style }: SpinnerProps) => {
  const spinnerRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(16);
  const [fontWeight, setFontWeight] = useState(500);

  // Read computed font size and weight, similar to Icon component
  useEffect(() => {
    if (spinnerRef.current) {
      const computedFontSize = Number.parseFloat(
        window.getComputedStyle(spinnerRef.current).fontSize,
      );

      const computedFontWeight = Number.parseInt(
        window.getComputedStyle(spinnerRef.current).fontWeight,
        10,
      );

      setFontSize(computedFontSize);
      setFontWeight(computedFontWeight);
    }
  }, [className]);

  /* Bar width in percentage, to match Material Symbols keyline spec */
  const barWidth = (fontWeight / 400) * 0.1 + (em ? 0.02 : 0);

  return (
    <span
      aria-hidden="true"
      className={`${styles['spinner']} ${size ? styles[`spinner--size-${size}`] : ''} ${className ?? ''}`}
      ref={spinnerRef}
      role="status"
      style={{
        height: size ? undefined : `${fontSize}px`,
        width: size ? undefined : `${fontSize}px`,
        ...style,
      }}
    >
      <span className={styles['spinner-bar']} style={{ width: `${barWidth}em` }} />
      <span className={styles['spinner-bar']} style={{ width: `${barWidth}em` }} />
      <span className={styles['spinner-bar']} style={{ width: `${barWidth}em` }} />
    </span>
  );
};

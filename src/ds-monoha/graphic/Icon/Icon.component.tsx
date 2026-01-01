import React, { type FC, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type IconSizeTokens,
  type SemanticColorTokens,
  type TextWeightTokens,
} from '../../tokens/types';
import styles from './Icon.module.scss';

/* Our selected body typefaces (Atkinson Hyperlegible Next and Outfit) are a little weightier than normal */
/* We can use this as a base for the grade value to compensate for this */
/* TODO: Probably move this to the context provider or as tokens if we can get that to work with typescript */
const GRAD_BASE = 100;
const GRAD_EM = 200;
const WEIGHT_BASE = 400;
const SIZE_BASE = 16;
const COMP_FACTOR = 1;

// In development, log a warning if wght is out of bounds; otherwise, do nothing.
// TODO: This should probably be a flag in the config or something, check with engies to see if there's a better way.
const IS_DEV = window.location.hostname === 'localhost';

export interface IconProps {
  /** Material Symbol icon name to display. */
  readonly name: string;
  /** Additional CSS classes to apply to the icon. */
  readonly className?: string;
  /** Whether to use the filled icon variant instead of the default outlined style. */
  readonly fill?: boolean;
  /** Whether to use the emphasised (bold) icon variant. */
  readonly em?: boolean;
  /** Predefined size variant that overrides the default font-size adaptation. */
  readonly size?: IconSizeTokens;
  /** Text weight token for the icon. */
  readonly weight?: TextWeightTokens;
  /** Semantic colour token for the icon. */
  readonly color?: SemanticColorTokens;
  /** Additional inline styles to apply to the icon. */
  readonly style?: React.CSSProperties;
}

/**
 * Icon component that displays a Material Symbol icon with customisable styling.
 *
 * Refer to the README.md for more information.
 */
export const Icon: FC<IconProps> = ({
  name,
  className,
  fill = false,
  em = false,
  size: sizeProp,
  weight: weightProp,
  color,
  style,
}) => {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [opticalSize, setOpticalSize] = useState(24);
  const [wght, setWght] = useState(WEIGHT_BASE);

  // Memoize the font variation settings to avoid string concatenation on every render
  const fontVariationSettings = useMemo(
    () =>
      `'opsz' ${opticalSize}, 'wght' ${wght}, 'FILL' ${fill ? 1 : 0}, 'GRAD' ${em ? GRAD_EM : GRAD_BASE}`,
    [opticalSize, wght, fill, em]
  );

  /*
   * <Icon> uses useLayoutEffect instead of useEffect for DOM calculations to eliminate visual "twitching" during page navigation and component mounting
   * caused by the icon calculating its weight and size before the DOM is ready.
   *
   * It eliminates jarring icon jumps during navigation, making the app feel more polished and responsive.
   *
   * Naturally, useLayoutEffect is not as performant as useEffect, hence why I have stress-tested the performance impact to ensure it's not a major bottleneck.
   *
   * Performance metrics (based on Lighthouse testing with 2000+ icons on a single page):
   *
   * Desktop, useEffect:
   *  - Performance: 86-87
   *  - LCP: 2.0-2.1s
   *  - TBT: 150-160ms
   *  - SI: 1.0-1.1s
   *
   * Desktop, useLayoutEffect:
   *  - Performance: 79-80
   *  - LCP: 1.9-2.1s
   *  - TBT: 230-250ms
   *  - SI: 1.2-1.4s
   *
   * Mobile, useEffect:
   *  - Performance: 55
   *  - LCP: 28.5-28.6s
   *  - TBT: 0ms
   *  - SI: 21.4-21.6s
   *
   * Mobile, useLayoutEffect:
   *  - Performance: 55
   *  - LCP: 28.4-28.5s
   *  - TBT: 0ms
   *  - SI: 21.4-21.5s
   *
   * I believe the performance cost is acceptable because:
   *
   * 1. The bottlenecks are from other factors (e.g. bundle size, simple sheer number of elements in the DOM), not <Icon>.
   * 2. It is unlikely that we will have 2000 icons on a single page. When testing with 150 icons, impact is hardly noticable.
   * 3. Mobile performance is unaffected either way.
   * 4. User experience is significantly improved.
   */
  useLayoutEffect(() => {
    if (iconRef.current) {
      // Get self font size
      const fontSize = Number.parseFloat(window.getComputedStyle(iconRef.current).fontSize);

      // opsz is always the actual rendered size
      setOpticalSize(fontSize);

      // Read parent element's font weight and size
      const { parentElement } = iconRef.current;
      const parentFontSize = parentElement
        ? Number.parseFloat(window.getComputedStyle(parentElement).fontSize)
        : SIZE_BASE;

      const parentFontWeight = parentElement
        ? Number.parseInt(window.getComputedStyle(parentElement).fontWeight, 10)
        : WEIGHT_BASE;

      // Get self font weight
      const computedWeight = Number.parseInt(
        window.getComputedStyle(iconRef.current).fontWeight,
        10
      );

      // wght calculation considers all four parameters
      const sizeDifference = fontSize - parentFontSize;
      const weight = weightProp ? computedWeight : parentFontWeight;

      if (sizeDifference === 0) {
        // Icon is same size - use weight as-is
        setWght(weight);
      } else {
        // Icon is different size than context, so adjust weight proportionally
        // COMP_FACTOR controls the strength: 1 = normal, 0 = off, 2 = double strength
        const baseRatio = parentFontSize / fontSize;
        const compensationAmount = (baseRatio - 1) * COMP_FACTOR;
        const compensatedWeight = weight * (1 + compensationAmount);
        setWght(compensatedWeight);
      }
    }
  }, [className, sizeProp, weightProp, name]);

  // Log warnings in development when weight changes
  useLayoutEffect(() => {
    if (IS_DEV) {
      if (wght < 100) {
        const weightDifference = 100 - wght;

        console.warn(
          `[Icon ${name}] Font weight (${wght.toFixed(2)}) is less than 100. Weight of ${weightDifference} is not supported, so it may not appear to match the surrounding text.`
        );
      }

      if (wght > 700) {
        const weightDifference = wght - 700;

        console.warn(
          `[Icon ${name}] Font weight (${wght.toFixed(2)}) is greater than 700. Weight of ${weightDifference} is not supported, so it may not appear to match the surrounding text.`
        );
      }
    }
  }, [wght, name]);

  // Build CSS classes based on size variant and color
  const iconClasses = useMemo(
    () =>
      [
        'material-symbols',
        styles.icon,
        sizeProp && styles[`icon--size-${sizeProp}`],
        weightProp && styles[`icon--weight-${weightProp}`],
        color && styles[`icon--${color}`],
        className,
      ]
        .filter(Boolean)
        .join(' ')
        .trim(),
    [sizeProp, weightProp, color, className]
  );

  return (
    <span
      aria-hidden="true"
      className={iconClasses}
      ref={iconRef}
      style={{
        fontVariationSettings,
        ...style,
      }}
    >
      {name}
    </span>
  );
};

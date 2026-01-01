/**
 * Design system token types
 * These define the valid values for various design tokens used throughout the system.
 */

/**
 * Valid spacing token values used throughout the design system.
 * These correspond to the --spacing-* CSS custom properties.
 */
export type SpacingTokens =
  | 0
  | 25
  | 50
  | 75
  | 100
  | 150
  | 200
  | 250
  | 300
  | 400
  | 500
  | 600
  | 800
  | 1000;

/**
 * Valid body text size token values used throughout the design system.
 * These correspond to the --font-body-* CSS custom properties.
 */
export type BodyTextSizeTokens = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Valid heading size token values used throughout the design system.
 * These correspond to the --font-heading-* CSS custom properties.
 */
export type HeadingSizeTokens = '3xl' | '2xl' | 'xl' | 'lg' | 'md' | 'sm' | 'xs' | '2xs';

/**
 * Valid icon size token values used throughout the design system.
 * These correspond to the --icon-size-* CSS custom properties.
 */
export type IconSizeTokens = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

/**
 * Valid semantic colour token values used throughout the design system.
 * These correspond to various semantic colour tokens defined in the design system's tokens.
 */
export type SemanticColorTokens =
  | 'neutral'
  | 'bold'
  | 'subtle'
  | 'brand'
  | 'brand-bold'
  | 'brand-inverse';

/**
 * Valid text weight token values used throughout the design system.
 * These correspond to the --font-weight-* CSS custom properties.
 */
export type TextWeightTokens = 'normal' | 'medium' | 'semibold' | 'bold';

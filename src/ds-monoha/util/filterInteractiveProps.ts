import { type NonInteractiveProps } from '../core/types';

/**
 * Interactive event handler property names that should be filtered out when disabled
 */
export const INTERACTIVE_PROPS = [
  'onClick',
  'onDoubleClick',
  'onMouseDown',
  'onMouseUp',
  'onMouseEnter',
  'onMouseLeave',
  'onMouseMove',
  'onMouseOver',
  'onMouseOut',
  'onKeyDown',
  'onKeyUp',
  'onKeyPress',
  'onFocus',
  'onBlur',
  'onSubmit',
  'onReset',
  'onChange',
  'onInput',
  'onSelect',
  'onDrag',
  'onDragStart',
  'onDragEnd',
  'onDragEnter',
  'onDragLeave',
  'onDragOver',
  'onDrop',
] as const;

/**
 * Filters out interactive event handlers from props object
 *
 * This utility is used by primitive components like Action and Anchor
 * to ensure disabled elements don't receive interactive event handlers.
 */
export const filterInteractiveProps = <T extends Record<string, unknown>>(
  props: T
): NonInteractiveProps<T> => {
  return Object.fromEntries(
    Object.entries(props).filter(
      ([key]) => !INTERACTIVE_PROPS.includes(key as (typeof INTERACTIVE_PROPS)[number])
    )
  ) as NonInteractiveProps<T>;
};

/** Type utilities for the design system */

/**
 * Excludes interactive props from HTML attributes, making them appropriate for non-interactive elements
 * like headings, paragraphs, and other semantic content elements.
 */
export type NonInteractiveProps<T> = Omit<
  T,
  | 'onClick'
  | 'onDoubleClick'
  | 'onMouseDown'
  | 'onMouseUp'
  | 'onMouseEnter'
  | 'onMouseLeave'
  | 'onMouseMove'
  | 'onMouseOver'
  | 'onMouseOut'
  | 'onKeyDown'
  | 'onKeyUp'
  | 'onKeyPress'
  | 'onFocus'
  | 'onBlur'
  | 'onSubmit'
  | 'onReset'
  | 'onChange'
  | 'onInput'
  | 'onSelect'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDragEnter'
  | 'onDragLeave'
  | 'onDragOver'
  | 'onDrop'
>;

/**
 * Valid semantic elements that the Stack and Inline component can render as.
 */
export type FlexElement =
  | 'div'
  | 'span'
  | 'ul'
  | 'ol'
  | 'dl'
  | 'li'
  | 'dt'
  | 'dd'
  | 'menu'
  | 'menuitem'
  | 'article'
  | 'aside'
  | 'footer'
  | 'header'
  | 'main'
  | 'nav'
  | 'section'
  | 'time';

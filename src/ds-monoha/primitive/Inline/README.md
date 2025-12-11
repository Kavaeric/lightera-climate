# `<Inline>`

`<Inline>` is a primitive component for laying out content in a horizontal flow. This replaces the `<HorizontalStack>` component.

- For laying content out vertically, use `<Stack>`.

## UX & behaviour

To ensure consistency in layout across languages and writing directions, an increasing proportion of the web have started to adopt CSS logical
properties. Instead of physical direction (`top`, `bottom`, `left`, `right`), logical properties are used instead to describe these directions in a way that adapts to the writing mode of the document, making layouts more robust across different languages and scripts.

- **Learn more:** [CSS Logical Properties and Values](https://css-tricks.com/css-logical-properties-and-values/)

The **inline** direction refers to the primary flow of text and content in a line, which is typically left-to-right in English and most Western languages, but can be right-to-left or even vertical in others.

The **block** direction is perpendicular to the inline direction. In English and most Western languages, this refers to the top-to-bottom direction.

### Polymorphic rendering

The `as` prop allows you to render the component as different HTML elements while maintaining all the layout behavior. This is useful for semantic HTML and accessibility.

```tsx
<Inline as="nav" gap={100}>
  <Link to="/home">Home</Link>
  <Link to="/about">About</Link>
  <Link to="/contact">Contact</Link>
</Inline>
```

### Spacing & padding

The `gap` property controls the space between child elements in the inline direction. This creates consistent spacing without needing to add margins to individual children.

```tsx
<Inline gap={100}>
  <IconButton icon="edit" aria-label="Edit" />
  <IconButton icon="visibility_off" aria-label="Hide" />
  <IconButton icon="delete" aria-label="Delete" />
</Inline>
```

Similarly, padding can be applied in several ways:

- **`padding`**: Applies equal padding to all sides.
- **`paddingInline`**: Applies padding to the start and end of the inline direction (in English, the left and right).
- **`paddingBlock`**: Applies padding to the start and end of the block direction (in English, the top and bottom).
- Individual sides through `paddingInlineStart`, `paddingInlineEnd`, `paddingBlockStart`, `paddingBlockEnd`.

```tsx
<Inline padding={200} gap={100}>
  <Icon name="info" color="info" />
  <Text color="info">Information message</Text>
</Inline>
```

### Alignment

`<Inline>` provides two alignment axes that work with logical properties:

`alignBlock` Controls how children are aligned in the block direction. In English this corresponds to the top-bottom direction.

- **`start`**: Aligns children to the start of the block axis.
- **`center`**: Centers children in the block axis.
- **`end`**: Aligns children to the end of the block axis.
- **`stretch`**: Stretches children to fill the block axis.
- **`baseline`**: Aligns children to their text baseline.

The `baseline` option is unique to `<Inline>` and is particularly useful for text-heavy layouts where you want to align text elements by their baseline rather than their container edges.

`alignInline` controls how children are distributed along the inline axis. In English this corresponds to the left-right direction.

- **`start`**: Groups children at the start.
- **`center`**: Centers children in the available space.
- **`end`**: Groups children at the end.
- **`spread`**: Distributes children evenly across the available space.

```tsx
<Inline alignInline="center" gap={200}>
  <Link to="/home">Home</Link>
  <Link to="/about">About</Link>
  <Link to="/contact">Contact</Link>
</Inline>
```

### Wrapping

When `wrap` is enabled, children will wrap to new lines when they exceed the container's width.

By default the gap between new rows is the same as `gap`. You can use `wrapGap` to have different spacing between items on the same line versus between lines when `wrap` is enabled.

### Sizing

The `hug` and `fill` props can be used to control how the component sizes itself:

- **`hug`**: The component will size itself to fit its content, taking up only the space it needs.
- **`fill`**: The component will expand to fill its container, taking up all available space.

### Border radius

The `borderRadius` prop allows you to apply rounded corners to the container using the design system's border radius tokens. This is useful for creating cards, panels, or other UI elements that need rounded corners.

## Props

The component also accepts all standard HTML div attributes (excluding interactive events) via props spreading.

| Prop                 | Type                                                      | Default     | Description                                     |
| -------------------- | --------------------------------------------------------- | ----------- | ----------------------------------------------- |
| `children`           | `ReactNode`                                               | `undefined` | Content to be laid out horizontally             |
| `as`                 | `ElementType`                                             | `'div'`     | HTML element to render                          |
| `gap`                | `SpacingTokens`                                           | `undefined` | Space between child elements                    |
| `alignBlock`         | `'start' \| 'center' \| 'end' \| 'stretch' \| 'baseline'` | `undefined` | Alignment in the block direction (cross-axis)   |
| `alignInline`        | `'start' \| 'center' \| 'end' \| 'spread'`                | `undefined` | Alignment in the inline direction (main-axis)   |
| `fill`               | `boolean`                                                 | `false`     | Whether the component should fill its container |
| `hug`                | `boolean`                                                 | `false`     | Whether the component should hug its content    |
| `wrap`               | `boolean`                                                 | `false`     | Whether content should wrap to new lines        |
| `wrapGap`            | `SpacingTokens`                                           | `undefined` | Space between wrapped rows                      |
| `padding`            | `SpacingTokens`                                           | `undefined` | Padding on all sides                            |
| `paddingInline`      | `SpacingTokens`                                           | `undefined` | Padding on start and end sides                  |
| `paddingBlock`       | `SpacingTokens`                                           | `undefined` | Padding on top and bottom sides                 |
| `paddingInlineStart` | `SpacingTokens`                                           | `undefined` | Padding on the start side only                  |
| `paddingInlineEnd`   | `SpacingTokens`                                           | `undefined` | Padding on the end side only                    |
| `paddingBlockStart`  | `SpacingTokens`                                           | `undefined` | Padding on the top side only                    |
| `paddingBlockEnd`    | `SpacingTokens`                                           | `undefined` | Padding on the bottom side only                 |
| `borderRadius`       | `BorderRadiusTokens`                                      | `undefined` | Border radius for the container                 |
| `className`          | `string`                                                  | `undefined` | Additional CSS classes                          |
| `style`              | `CSSProperties`                                           | `undefined` | Additional inline styles                        |
| `ref`                | `Ref<HTMLElement>`                                        | `undefined` | Forwarded ref to the rendered element           |

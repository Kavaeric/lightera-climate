# `<Stack>`

`<Stack>` is a primitive component for laying out content in a vertical flow. This replaces the `<VerticalStack>` component.

- For laying content out horizontally, use `<Inline>`.

## UX & behaviour

To ensure consistency in layout across languages and writing directions, an increasing proportion of the web have started to adopt CSS logical
properties. Instead of physical direction (`top`, `bottom`, `left`, `right`), logical properties are used instead to describe these directions in a way that adapts to the writing mode of the document, making layouts more robust across different languages and scripts.

- **Learn more:** [CSS Logical Properties and Values](https://css-tricks.com/css-logical-properties-and-values/)

The **block** direction refers to the primary flow of content in a vertical layout, which is typically top-to-bottom in English and most Western languages, but can be bottom-to-top or even horizontal in others.

The **inline** direction is perpendicular to the block direction. In English and most Western languages, this refers to the left-to-right direction.

### Polymorphic rendering

The `as` prop allows you to render the component as different HTML elements while maintaining all the layout behavior. This is useful for semantic HTML and accessibility.

```tsx
<Stack as="section" gap={200}>
  <Heading>Plex the Robot</Heading>
  <Text as="p">
    Plex is the friendly, yellow robot from the children's television show <i>Yo Gabba Gabba!</i>,
    known for his helpful nature and love of music.
  </Text>
  <Text as="p">
    With his antenna and glowing chest panel, Plex is always ready to dance, sing, and encourage
    everyone to try their best. As the group's resident DJ and problem-solver, Plex uses his
    advanced technology to play music, beam up snacks, and help his friends learn new things.
  </Text>
</Stack>
```

### Spacing & padding

The `gap` property controls the space between child elements in the block direction. This creates consistent spacing without needing to add margins to individual children.

```tsx
<Stack gap={100}>
  <Icon name="info" color="info" />
  <Text color="info">Information message</Text>
  <Button variant="secondary">Dismiss</Button>
</Stack>
```

Similarly, padding can be applied in several ways:

- **`padding`**: Applies equal padding to all sides.
- **`paddingBlock`**: Applies padding to the start and end of the block direction (in English, the top and bottom).
- **`paddingInline`**: Applies padding to the start and end of the inline direction (in English, the left and right).
- Individual sides through `paddingBlockStart`, `paddingBlockEnd`, `paddingInlineStart`, `paddingInlineEnd`.

```tsx
<Stack padding={200} gap={100}>
  <Heading>Section Title</Heading>
  <Text>Section content with consistent spacing</Text>
</Stack>
```

### Alignment

`<Stack>` provides two alignment axes that work with logical properties:

`alignBlock` Controls how children are aligned in the block direction. In English this corresponds to the top-bottom direction.

- **`start`**: Aligns children to the start of the block axis.
- **`center`**: Centers children in the block axis.
- **`end`**: Aligns children to the end of the block axis.
- **`stretch`**: Stretches children to fill the block axis.

`alignInline` controls how children are distributed along the inline axis. In English this corresponds to the left-right direction.

- **`start`**: Groups children at the start.
- **`center`**: Centers children in the available space.
- **`end`**: Groups children at the end.
- **`spread`**: Distributes children evenly across the available space.

```tsx
<Stack alignInline="center" gap={200}>
  <Heading>Centered Title</Heading>
  <Text>Centered content that spans multiple lines</Text>
</Stack>
```

### Wrapping

When `wrap` is enabled, children will wrap to new columns when they exceed the container's height. This is less common in vertical layouts but can be useful for creating grid-like arrangements.

By default the gap between new columns is the same as `gap`. You can use `wrapGap` to have different spacing between items in the same column versus between columns when `wrap` is enabled.

### Sizing

The `hug` and `fill` props can be used to control how the component sizes itself:

- **`hug`**: The component will size itself to fit its content, taking up only the space it needs.
- **`fill`**: The component will expand to fill its container, taking up all available space.

### Border radius

The `borderRadius` prop allows you to apply rounded corners to the container using the design system's border radius tokens. This is useful for creating cards, panels, or other UI elements that need rounded corners.

## Props

The component also accepts all standard HTML div attributes (excluding interactive events) via props spreading.

| Prop                 | Type                                        | Default     | Description                                     |
| -------------------- | ------------------------------------------- | ----------- | ----------------------------------------------- |
| `children`           | `ReactNode`                                 | `undefined` | Content to be laid out vertically               |
| `as`                 | `ElementType`                               | `'div'`     | HTML element to render                          |
| `gap`                | `SpacingTokens`                             | `undefined` | Space between child elements                    |
| `alignBlock`         | `'start' \| 'center' \| 'end' \| 'stretch'` | `undefined` | Alignment in the block direction (main-axis)    |
| `alignInline`        | `'start' \| 'center' \| 'end' \| 'spread'`  | `undefined` | Alignment in the inline direction (cross-axis)  |
| `fill`               | `boolean`                                   | `false`     | Whether the component should fill its container |
| `hug`                | `boolean`                                   | `false`     | Whether the component should hug its content    |
| `wrap`               | `boolean`                                   | `false`     | Whether content should wrap to new columns      |
| `wrapGap`            | `SpacingTokens`                             | `undefined` | Space between wrapped columns                   |
| `padding`            | `SpacingTokens`                             | `undefined` | Padding on all sides                            |
| `paddingBlock`       | `SpacingTokens`                             | `undefined` | Padding on top and bottom sides                 |
| `paddingInline`      | `SpacingTokens`                             | `undefined` | Padding on left and right sides                 |
| `paddingBlockStart`  | `SpacingTokens`                             | `undefined` | Padding on the top side only                    |
| `paddingBlockEnd`    | `SpacingTokens`                             | `undefined` | Padding on the bottom side only                 |
| `paddingInlineStart` | `SpacingTokens`                             | `undefined` | Padding on the left side only                   |
| `paddingInlineEnd`   | `SpacingTokens`                             | `undefined` | Padding on the right side only                  |
| `borderRadius`       | `BorderRadiusTokens`                        | `undefined` | Border radius for the container                 |
| `className`          | `string`                                    | `undefined` | Additional CSS classes                          |
| `style`              | `CSSProperties`                             | `undefined` | Additional inline styles                        |
| `ref`                | `Ref<HTMLElement>`                          | `undefined` | Forwarded ref to the rendered element           |

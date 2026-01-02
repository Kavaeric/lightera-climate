# Colourmap System

This directory contains the colourmap system for GPU-based data visualization in the Light Era climate simulation.

## Overview

Colourmaps are used to convert scalar data values into colors for visualization. Each colourmap is defined as a series of **position-based color stops** that are interpolated to create smooth gradients.

The system supports:
- **Position-based stops**: Colors can be placed at arbitrary positions (e.g., 0.0, 0.39, 0.58, 0.89, 1.0) rather than being evenly spaced
- **GPU texture sampling**: Colourmaps are converted to 1D textures for efficient shader sampling
- **Underflow/overflow colors**: Special colors for out-of-range values
- **JSON file format**: Each colourmap is stored as a separate JSON file for easy editing

## Directory Structure

```
colourmaps/
├── data/               # JSON colourmap definitions
│   ├── schema.json     # JSON schema for validation
│   ├── plasma.json     # Example: matplotlib plasma colourmap
│   ├── greyscale.json  # Example: simple black-to-white
│   └── ...
├── ColourmapTexture.ts # Core texture generation
├── loader.ts           # JSON loading utilities
├── definitions.ts      # Legacy TypeScript definitions (deprecated)
├── index.ts            # Public API
└── README.md           # This file
```

## JSON Format

Each colourmap is defined as a JSON file with the following structure:

```json
{
  "name": "plasma",
  "stops": [
    { "position": 0.0, "color": [0.05, 0.03, 0.53] },
    { "position": 0.5, "color": [0.80, 0.19, 0.31] },
    { "position": 1.0, "color": [0.94, 0.98, 0.65] }
  ],
  "underflowColour": [0.0, 0.0, 0.0],
  "overflowColour": [1.0, 0.0, 1.0],
  "metadata": {
    "source": "matplotlib",
    "description": "Perceptually uniform plasma colourmap"
  }
}
```

### Fields

- **name**: Unique identifier for the colourmap
- **stops**: Array of color stops (must be sorted by position)
  - **position**: Normalized position (0.0 to 1.0)
  - **color**: RGB values in 0-1 range `[r, g, b]` (can exceed 1.0 for HDR)
- **underflowColour**: RGB color for values below minimum
- **overflowColour**: RGB color for values above maximum
- **interpolationSpace** (optional): Color space for interpolation (`"rgb"` or `"lab"`)
- **metadata** (optional): Additional information about the colourmap

## Usage

### Using Pre-defined Colourmaps (Recommended)

All built-in colourmaps are available as constants, loaded from JSON files at bundle time:

```typescript
import { COLOURMAP_PLASMA, createColourmapTexture } from './colourmaps';

const texture = createColourmapTexture(COLOURMAP_PLASMA);
material.uniforms.colourmapTexture.value = texture;
```

Available constants:
- `COLOURMAP_GREYSCALE` - Simple black to white
- `COLOURMAP_PLASMA` - Matplotlib plasma (perceptually uniform)
- `COLOURMAP_BLUE_B1`, `COLOURMAP_BLUE_SD` - Blue gradients
- `COLOURMAP_TEAL_C16` - Teal gradient
- `COLOURMAP_YELLOW_YEL15` - Yellow gradient
- `COLOURMAP_WATER_STATE` - Water phase visualization
- `COLOURMAP_TR4` - Diverging brown to orange
- `COLOURMAP_EXTENDED_KINDLMANN` - Extended Kindlmann
- `COLOURMAP_FAST` - Fast colourmap by Moreland
- `COLOURMAP_TERRAIN_ELEVATION` - Grey rocky appearance
- `COLOURMAP_TERRAIN_WATER` - Ocean blues
- `COLOURMAP_TERRAIN_ICE` - Ice sheet whites

### Loading Custom Colourmaps Dynamically

For custom colourmaps not bundled with the application:

```typescript
import { loadColourmapJSON, createColourmapTexture } from './colourmaps';

// Load from external JSON file (async)
const colourmap = await loadColourmapJSON('/path/to/custom.json');
const texture = createColourmapTexture(colourmap);

// Use in shader material
material.uniforms.colourmapTexture.value = texture;
```

## Creating New Colourmaps

### Option 1: Write JSON Directly

Create a new JSON file in `data/` following the schema:

```json
{
  "name": "my_colourmap",
  "stops": [
    { "position": 0.0, "color": [0.0, 0.0, 0.0] },
    { "position": 0.4, "color": [0.5, 0.2, 0.1] },
    { "position": 1.0, "color": [1.0, 1.0, 1.0] }
  ],
  "underflowColour": [0.0, 0.0, 0.2],
  "overflowColour": [1.0, 0.0, 1.0]
}
```

### Option 2: Convert from Reference Files

If you have CSV or XML colourmap files (e.g., from ParaView, sciviscolor.org):

1. Place them in `refs/colourmaps/`
2. Create a conversion script or manually extract the data
3. Format as JSON following the schema

### Validation

Use the provided schema for validation:

```typescript
import { validateColourmapJSON, parseColourmapJSON } from './colourmaps';

const jsonText = await fetch('/path/to/colourmap.json').then(r => r.text());
const colourmap = parseColourmapJSON(jsonText); // Throws if invalid
```

## How It Works

### Texture Generation

1. **Input**: Colourmap with position-based stops
2. **Sampling**: The `sampleColourmap` function interpolates between stops based on position
3. **Texture Creation**: A 256-pixel 1D texture is generated with:
   - First pixel (u=0): underflow color
   - Last pixel (u=1): overflow color
   - Inner pixels: sampled gradient

### Shader Sampling

In shaders, the colourmap is sampled as a 1D texture:

```glsl
uniform sampler2D colourmapTexture;

vec3 sampleColourmapTexture(float t) {
  float u = 0.00390625 + clamp(t, 0.0, 1.0) * 0.9921875;
  return texture(colourmapTexture, vec2(u, 0.5)).rgb;
}
```

## Position Stops vs. Evenly-Spaced

### Why Position Stops Matter

Many scientifically-designed colourmaps use non-uniform stop positions to ensure perceptual uniformity. For example, the blackbody colourmap has stops at:

- 0.0 (black)
- 0.39 (dark red) ← not 0.25!
- 0.58 (orange) ← not 0.5!
- 0.89 (yellow) ← not 0.75!
- 1.0 (white)

Using evenly-spaced interpolation would distort the perceptual properties of these carefully-designed colourmaps.

### Legacy vs. New Format

**Legacy (evenly-spaced):**
```typescript
colours: [color1, color2, color3]
// Implicitly at positions [0.0, 0.5, 1.0]
```

**New (position-based):**
```json
"stops": [
  { "position": 0.0, "color": [...] },
  { "position": 0.39, "color": [...] },
  { "position": 1.0, "color": [...] }
]
```

## Migration Status

✅ **Migration Complete!**

All colourmaps have been successfully migrated to the JSON-based system:

- ✅ All 13 built-in colourmaps converted to JSON files
- ✅ Position-based stops fully supported
- ✅ Visualization modes updated to use new system
- ✅ Legacy `definitions.ts` removed
- ✅ Backwards compatibility maintained (same API)

The system now:
- Loads all colourmaps from JSON files at bundle time
- Supports non-uniform position stops (e.g., blackbody: 0.0, 0.39, 0.58, 0.89, 1.0)
- Provides the same constants (`COLOURMAP_PLASMA`, etc.) with cleaner implementation
- Enables easy addition of new colourmaps via JSON files

## References

- [sciviscolor.org](https://sciviscolor.org/) - Scientific visualization colormaps
- [Kenneth Moreland's Advice](https://www.kennethmoreland.com/color-advice/) - Color map advice for scientific visualization
- [Matplotlib Colormaps](https://matplotlib.org/stable/users/explain/colors/colormaps.html) - Perceptually uniform colormaps

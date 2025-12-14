# Climate Simulation Architecture

## Overview

This document describes the MVVM-inspired architecture used in the climate simulation codebase. The architecture is organized into four distinct layers: Configuration, Model, ViewModel, and View.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                      View Layer                          │
│  (React Components - rendering only)                     │
│                                                           │
│  ┌──────────────────┐  ┌─────────────────┐              │
│  │  PlanetRenderer  │  │ ReferenceGrid   │              │
│  │  (3D planet)     │  │ Overlay         │              │
│  └──────────────────┘  └─────────────────┘              │
│                                                           │
│  ┌──────────────────┐  ┌─────────────────┐              │
│  │ PlanetInteraction│  │ ClimateDataChart│              │
│  │  (mouse input)   │  │ (time series)   │              │
│  └──────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ reads data
                            │
┌───────────────────────────┼─────────────────────────────┐
│                   ViewModel Layer                        │
│  (Shader Materials - transform data for display)        │
│                                                           │
│  ┌──────────────────┐  ┌─────────────────┐              │
│  │  DisplayMaterial │  │ LatLonMaterial  │              │
│  └──────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ reads textures
                            │
┌───────────────────────────┼─────────────────────────────┐
│                      Model Layer                         │
│  (Data structures and physics computation)               │
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │     TextureGridSimulation                │             │
│  │  (GPU texture storage, neighbor lookup) │             │
│  └─────────────────────────────────────────┘             │
│                            ▲                              │
│                            │ writes to                    │
│  ┌─────────────────────────┴───────────────┐             │
│  │  ClimateSimulationEngine                 │             │
│  │  (executes physics over time)            │             │
│  └─────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ configured by
                            │
┌───────────────────────────┼─────────────────────────────┐
│                  Configuration Layer                     │
│                                                           │
│  ┌──────────────┐ ┌─────────────────┐ ┌──────────────┐  │
│  │ PlanetConfig │ │ SimulationConfig│ │DisplayConfig │  │
│  └──────────────┘ └─────────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Configuration Layer

**Files:** `src/config/`

Immutable data objects that define all simulation parameters. No logic, only data.

#### PlanetConfig
Defines physical properties of the simulated planet:
- **Orbital parameters:** `solarFlux`, `cosmicBackgroundTemp`, `yearLength`
- **Surface properties:** `albedo`, `emissivity`, `surfaceHeatCapacity`
- **Rotational parameters:** `subsolarPoint`, `rotationsPerYear`, `axialTilt`

#### SimulationConfig
Defines solver and physics parameters:
- **Grid resolution:** `resolution` (geodesic subdivisions)
- **Time sampling:** `timeSamples` (number of samples per orbit)
- **Solver control:** `iterations` (orbits to reach equilibrium)
- **Physics timesteps:** `physicsStepsPerSample` (sub-stepping)
- **Thermal diffusion:** `groundDiffusion`, `groundDiffusionIterations`

#### DisplayConfig
Defines visualization parameters:
- **Temperature display:** `temperatureRange` (min/max Kelvin)
- **Color mapping:** `colormap` type and colors (`underflowColor`, `overflowColor`)
- **Grid overlay:** `latitudeLines`, `longitudeLines`, `gridSegments`
- **Cell highlighting:** `highlightThreshold` (distance threshold for cell selection)

### Model Layer

**Files:** `src/util/`, `src/components/ClimateSimulationEngine.tsx`

Manages data structures and performs physics computation on the GPU.

#### TextureGridSimulation
- **Responsibility:** GPU texture storage and spatial queries
- **Constructor:** Accepts `SimulationConfig` to initialize resolution and time sampling
- **GPU Resources:**
  - `neighbourIndices1`, `neighbourIndices2`: Store neighbor cell indices (for thermal diffusion)
  - `neighbourCounts`: Number of neighbors per cell (5 or 6)
  - `cellPositions`: Latitude/longitude for each cell
  - `climateDataTargets`: Array of render targets (one per time sample) storing temperature, humidity, pressure
- **Key Methods:**
  - `getClimateDataForCell()`: Read back temperature data for selected cell
  - `getCellLatLon()`: Convert cell index to geographic coordinates
  - `getCellUV()`: Convert cell index to texture UV coordinates

#### ClimateSimulationEngine
- **Responsibility:** Execute physics computation across multiple orbits
- **Process:**
  1. Spin-up phase: Run `iterations` complete orbits to reach thermal equilibrium
  2. Data recording: Sample temperature at `physicsStepsPerSample` intervals per orbit
  3. GPU compute: Uses `ThermalEvolutionMaterial` for parallel temperature updates
- **Uniforms Passed:**
  - From `PlanetConfig`: `solarFlux`, `albedo`, `emissivity`, `subsolarPoint`, etc.
  - From `SimulationConfig`: `groundDiffusion`, physics timestep
- **Output:** Temperature data written to `climateDataTargets` textures

### ViewModel Layer

**Files:** `src/rendering/materials/`

Factory functions that create shader materials, bridging configuration and GPU rendering.

#### DisplayMaterial
- **Purpose:** Transform climate data textures into visual representation
- **Inputs:**
  - Climate data texture (`stateTex`)
  - Cell position data (`cellPositions`)
  - Display config (`temperatureRange`, colors)
  - User interaction state (`hoveredCellIndex`, `selectedCellIndex`)
- **Shader:** `src/shaders/display.frag` with Fast colormap (32 control points)
- **Output:** RGB color for each pixel based on temperature and cell selection state

#### ThermalEvolutionMaterial
- **Purpose:** GPU physics shader for temperature evolution
- **Inputs:**
  - Previous temperature state texture
  - Neighbor indices and counts
  - Planet and simulation parameters
  - Timestep `dt`
- **Shader:** `src/shaders/thermalEvolution.frag`
- **Physics:**
  - Solar radiation: Depends on latitude and subsolar point
  - Blackbody radiation: Based on cell temperature
  - Thermal conduction: Heat transport between adjacent cells
- **Output:** Updated temperature texture

#### LatLonMaterial
- **Purpose:** Render latitude/longitude reference grid
- **Inputs:** Display config (`latitudeLines`, `longitudeLines`)
- **Shader:** `src/shaders/latlon.frag`
- **Output:** Grid lines for geographic reference

### View Layer

**Files:** `src/components/`, `src/App.tsx`

React components for rendering and user interaction. Pure presentation logic with minimal state.

#### PlanetRenderer (formerly TextureGeodesicPolyhedron)
- **Responsibility:** 3D planet visualization
- **Inputs:**
  - `simulation`: Access to climate data and geometry
  - `displayConfig`: Temperature range and highlighting parameters
  - `hoveredCellIndex`, `selectedCellIndex`: User interaction state
- **Rendering:** Uses `DisplayMaterial` for color mapping
- **Output:** Three.js mesh with interactive color-coded cells

#### PlanetInteraction (formerly CellPicker)
- **Responsibility:** Mouse interaction with planet
- **Mechanism:** Raycasting to detect cell selection
- **Process:**
  1. Convert mouse position to world coordinates
  2. Raycast against planet mesh
  3. Extract UV coordinates from intersection
  4. Find cell index from UV coordinates
- **Output:** Callbacks (`onHoverCell`, `onCellClick`) to parent component

#### ReferenceGridOverlay (formerly LatLonGrid)
- **Responsibility:** Display geographic reference grid
- **Inputs:** `displayConfig.latitudeLines`, `displayConfig.longitudeLines`
- **Output:** Visible grid overlay for geographic context

#### ClimateDataChart (formerly ClimateGraph)
- **Responsibility:** Time-series visualization of climate data
- **Inputs:** Climate data for selected cell from `TextureGridSimulation`
- **Display:** Temperature, humidity, pressure over time
- **Interaction:** Close button to deselect cell

#### ClimateDataFetcher
- **Responsibility:** Internal helper for GPU readback
- **Process:**
  1. Triggered when cell is selected
  2. Calls `simulation.getClimateDataForCell()`
  3. Passes data to parent via callback
- **Location:** Inside Canvas for WebGL context access

## Data Flow

### Simulation Initialization
```
App.tsx
  ↓
new TextureGridSimulation(DEFAULT_SIMULATION_CONFIG)
  ├─ Creates geodesic grid with resolution = simulationConfig.resolution
  ├─ Creates neighbor lookup textures
  ├─ Creates cell position texture
  └─ Creates climateDataTargets array (one per simulationConfig.timeSamples)

↓
<ClimateSimulationEngine planetConfig={...} simulationConfig={...} />
  ├─ Creates ThermalEvolutionMaterial
  ├─ Renders to texture for each timestep
  └─ Fills climateDataTargets with temperature data
```

### Visualization
```
ClimateSimulationEngine outputs
  ↓
climateDataTargets textures
  ├─ Read by DisplayMaterial
  │   ├─ Maps temperature → color
  │   ├─ Applies highlighting for hovered/selected cells
  │   └─ Outputs RGB values
  │
  └─ Read by PlanetRenderer
      ├─ Creates mesh with colored vertices
      ├─ Applies DisplayMaterial shader
      └─ Displays on screen
```

### User Interaction
```
User clicks on planet
  ↓
PlanetInteraction.handleClick()
  ├─ Raycasts against mesh
  ├─ Extracts UV from intersection
  ├─ Finds cell index from UV
  └─ Calls onCellClick(cellIndex)

↓
App.handleCellClick()
  ├─ Updates selectedCell state
  └─ Triggers ClimateDataFetcher

↓
ClimateDataFetcher
  ├─ Calls simulation.getClimateDataForCell()
  ├─ Reads GPU textures back to CPU
  └─ Passes data to ClimateDataChart

↓
ClimateDataChart displays time-series graph
```

## Key Design Principles

### Separation of Concerns
- **Configuration:** Immutable parameter objects, no logic
- **Model:** GPU data storage and physics, no rendering
- **ViewModel:** Shader materials bridge config and GPU, no business logic
- **View:** React components for presentation, minimal state

### Type Safety
- **Type-only imports:** Configuration types imported as `import type` to avoid circular dependencies
- **Interface composition:** Large props interfaces broken down logically (e.g., `SceneProps`, `PlanetInteractionProps`)
- **Strict TypeScript:** Enabled with `strict: true` in `tsconfig.app.json`

### GPU Efficiency
- **Texture storage:** Climate data stored as GPU textures to avoid CPU/GPU transfers during simulation
- **Render-to-texture:** Physics computation outputs directly to textures for next iteration
- **Neighbor lookup:** Pre-computed neighbor indices stored in textures for O(1) lookups in shader

### Configurability
- **No magic numbers:** All hardcoded values moved to config objects
- **Shader uniforms:** Uniform values passed from config through material factories
- **Extensible colormap:** Display config allows future colormap types (currently 'fast', extensible to 'viridis', 'blackbody', etc.)

## File Structure

```
src/
├── config/
│   ├── planetConfig.ts           # Physical planet parameters
│   ├── simulationConfig.ts       # Solver and physics parameters
│   └── displayConfig.ts          # Visualization parameters
│
├── simulation/
│   └── geometry/
│       └── geodesic.ts           # Geodesic grid generation
│
├── util/
│   └── TextureGridSimulation.ts  # GPU texture storage and queries
│
├── rendering/
│   ├── materials/
│   │   ├── DisplayMaterial.ts              # Temperature → color shader
│   │   ├── ThermalEvolutionMaterial.ts    # Physics computation shader
│   │   └── LatLonMaterial.ts               # Grid rendering shader
│   │
│   └── colormaps/
│       ├── colorMaps.ts          # Fast colormap and utilities
│       └── blackbodyToRgb.ts     # Blackbody color conversion
│
├── components/
│   ├── PlanetRenderer.tsx              # 3D planet visualization
│   ├── ClimateSimulationEngine.tsx    # Physics computation
│   ├── PlanetInteraction.tsx           # Mouse interaction
│   ├── ReferenceGridOverlay.tsx        # Geographic grid
│   ├── ClimateDataChart.tsx            # Time-series graph
│   └── ClimateDataFetcher.tsx          # GPU data readback
│
├── shaders/
│   ├── display.vert              # Planet vertex shader
│   ├── display.frag              # Planet fragment shader (temperature → color)
│   ├── thermalEvolution.frag     # Physics computation shader
│   ├── latlon.vert               # Grid vertex shader
│   ├── latlon.frag               # Grid fragment shader
│   ├── fullscreen.vert           # Utility: fullscreen quad
│   └── copy.frag                 # Utility: texture copy
│
├── utils/
│   └── cellMapping.ts            # UV → cell index conversion
│
├── debug/ (optional)
│   ├── DebugTextureView.tsx      # Texture visualization utility
│   └── TextureSimulationRenderer.tsx  # Future experimental rendering
│
├── ds-monoha/                    # Design system (for future UI)
│
└── App.tsx                       # Root component
```

## Configuration Usage Example

```typescript
// Creating simulation with full configuration
const simulation = new TextureGridSimulation(DEFAULT_SIMULATION_CONFIG);

// Passing configs to components
<Scene
  simulation={simulation}
  planetConfig={planetConfig}
  simulationConfig={simulationConfig}
  displayConfig={displayConfig}
  {...}
/>

// Physics computation
<ClimateSimulationEngine
  simulation={simulation}
  solarFlux={planetConfig.solarFlux}
  albedo={planetConfig.albedo}
  // ... other planet parameters
  iterations={simulationConfig.iterations}
  groundDiffusion={simulationConfig.groundDiffusion}
/>

// Visualization
<PlanetRenderer
  simulation={simulation}
  valueRange={displayConfig.temperatureRange}
  hoveredCellIndex={hoveredCell}
  selectedCellIndex={selectedCell}
/>
```

## Future Extensions

### Color Mapping
The `DisplayConfig.colormap` field is designed for future expansion:
- Current: 'fast' (32 control points for performance)
- Planned: 'viridis', 'blackbody' (perceptually uniform colormaps)
- Implementation: Add new colormap arrays to `src/rendering/colormaps/` and update shader uniforms

### Atmospheric Simulation
Future features can be added to SimulationConfig and ThermalEvolutionMaterial:
- Wind patterns
- Precipitation
- Cloud formation
- Atmospheric circulation

### Interactive Configuration
Future UI components can read/write to config state:
- Solar flux slider
- Albedo adjustment
- Thermal conductivity controls
- Animation playback controls

### Performance Optimization
Current baseline: 1,427 KB gzipped
- Monitor bundle size with future additions
- Consider code-splitting for debug utilities
- Profile GPU memory usage during long simulations

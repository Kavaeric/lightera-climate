# Configuration Architecture Proposal

## Problem

The current `PlanetConfig` is a grab-bag of unrelated concerns:
- Orbital parameters (solar flux, year length, subsolar point, axial tilt)
- Physical planet properties (radius, rotations per year)
- Surface thermal properties (albedo, emissivity, heat capacity, conductivity)
- Atmosphere (nested AtmosphereConfig with composition)
- Universal constants (cosmic background temperature)

This creates confusion because:
1. It's unclear what each parameter controls
2. Parameters from different physics domains are mixed together
3. UI needs to understand the entire nested structure
4. Adding new passes requires modifying the central config object

## Proposed Solution

With the new pass-based architecture, separate **user-configurable parameters** (config) from **physical constants** (constants).

- **Config**: User-definable aspects that might change between simulations (planet size, orbital parameters, etc.)
- **Constants**: Physical properties of materials that don't change (thermal conductivity of water, Stefan-Boltzmann constant, etc.)

### New Structure

```
src/climate/pass/
├── 01-solar-flux/
│   ├── config.ts          # SolarFluxConfig (user-configurable)
│   ├── solarFlux.frag
│   └── types.ts
├── 02-surface-heating/
│   ├── config.ts          # SurfaceHeatingConfig (user-configurable albedos)
│   ├── constants.ts       # Physical constants for surface materials
│   └── ...
├── 05-temperature-diffusion/
│   ├── constants.ts       # ThermalConstants (heat capacity, conductivity of materials)
│   └── ...
└── ...

src/config/
├── orbital.ts             # OrbitalConfig (user-configurable: year length, rotation rate)
├── planetary.ts           # PlanetaryConfig (user-configurable: radius, mass)
├── physics.ts             # PhysicsConstants (universal: Stefan-Boltzmann, cosmic background temp)
└── simulationConfig.ts    # SimulationConfig (timestep, recording, etc.)
```

### Example: Solar Flux Config (User-Configurable)

Already implemented:

```typescript
// src/climate/pass/01-solar-flux/config.ts
export interface SolarFluxConfig {
  solarFlux: number        // W/m² - solar constant (varies by star distance)
  subsolarPoint: {
    lat: number           // degrees - initial position
    lon: number           // degrees - initial position
  }
  axialTilt: number       // degrees - varies by planet
}
```

### Example: Surface Heating Config (User-Configurable)

Future implementation:

```typescript
// src/climate/pass/02-surface-heating/config.ts
export interface SurfaceHeatingConfig {
  rockAlbedo: number      // 0-1 - varies by surface composition
  waterAlbedo: number     // 0-1 - can be adjusted for different conditions
  iceAlbedo: number       // 0-1 - can vary with age/dirt
  cloudAlbedo: number     // 0-1 - adjustable
}
```

### Example: Thermal Constants (Physical Constants)

Future implementation:

```typescript
// src/climate/pass/05-temperature-diffusion/constants.ts
export const THERMAL_CONSTANTS = {
  // Heat capacities (J/(m³·K)) - physical properties of materials
  rockHeatCapacity: 2.16e6,     // Granite: ρ=2700 kg/m³, c=800 J/kg·K
  waterHeatCapacity: 4.18e6,    // Water: ρ=1000 kg/m³, c=4180 J/kg·K
  iceHeatCapacity: 1.93e6,      // Ice: ρ=917 kg/m³, c=2100 J/kg·K

  // Thermal conductivities (W/(m·K)) - physical properties
  rockConductivity: 2.5,        // Typical rock
  waterConductivity: 0.6,       // Liquid water
  iceConductivity: 2.2,         // Ice
} as const
```

### Example: Universal Physics Constants

```typescript
// src/config/physics.ts
export const PHYSICS_CONSTANTS = {
  stefanBoltzmann: 5.670374419e-8,  // W/(m²·K⁴) - Stefan-Boltzmann constant
  cosmicBackgroundTemp: 2.7,         // K - CMB temperature
  speedOfLight: 299792458,           // m/s
} as const
```

### Shared Config: Orbital Parameters (User-Configurable)

Some parameters are used by multiple passes:

```typescript
// src/config/orbital.ts
export interface OrbitalConfig {
  yearLength: number        // seconds - varies by orbital distance
  rotationsPerYear: number  // dimensionless - varies by planet
}
```

### Shared Config: Planetary Properties (User-Configurable)

Basic physical properties that vary by planet:

```typescript
// src/config/planetary.ts
export interface PlanetaryConfig {
  radius: number           // metres - varies by planet
  mass: number             // kg - varies by planet
  surfaceGravity: number   // m/s² - derived from mass and radius
}
```

## Benefits

1. **Clear separation of concerns**: Each config controls one aspect of physics, constants are separate
2. **Config vs Constants distinction**: Users configure planet properties, not physical laws
3. **Easy to understand**: No nested structures or mixed concerns
4. **UI simplification**: Each panel configures one pass, constants are not exposed in UI
5. **Extensible**: Adding Pass 7 doesn't require modifying existing configs
6. **Type safety**: TypeScript ensures each pass gets exactly what it needs
7. **Testability**: Easy to test individual passes with different configs
8. **No magic numbers**: Physical constants are documented and centralized

## Migration Strategy

1. ✅ **Pass 1 (Solar Flux)**: Already has dedicated config
2. **Create physics constants file**: Extract universal constants (Stefan-Boltzmann, cosmic background temp)
3. **Create shared configs**: OrbitalConfig, PlanetaryConfig for parameters used across multiple passes
4. **Pass 2-6**: Create dedicated configs + constants files as each pass is implemented
5. **Remove PlanetConfig**: Once all passes have their own configs, delete the old monolithic structure
6. **Simplify UI**: Each panel configures one pass, physical constants are not exposed
7. **Update ClimateSimulationEngine**: Accept individual configs instead of PlanetConfig, import constants directly

## Example: How ClimateSimulationEngine Would Look

### Before (Current - Confusing):
```typescript
interface ClimateSimulationEngineProps {
  simulation: TextureGridSimulation
  planetConfig: PlanetConfig  // Giant nested object
  simulationConfig: SimulationConfig
  stepsPerFrame: number
  samplesPerOrbit: number
}

// Inside component:
const {
  radius,
  solarFlux,
  albedo,
  emissivity,
  subsolarPoint,
  rotationsPerYear,
  cosmicBackgroundTemp,
  yearLength,
  surfaceHeatCapacity,
  axialTilt,
  groundConductivity,
  atmosphereConfig,
} = planetConfig  // 12+ destructured fields!
```

### After (Proposed - Clear):
```typescript
interface ClimateSimulationEngineProps {
  simulation: TextureGridSimulation
  // User-configurable parameters
  solarFluxConfig: SolarFluxConfig
  surfaceHeatingConfig: SurfaceHeatingConfig
  orbitalConfig: OrbitalConfig
  planetaryConfig: PlanetaryConfig
  simulationConfig: SimulationConfig
  stepsPerFrame: number
  samplesPerOrbit: number
}

// Inside component - physical constants imported directly
import { THERMAL_CONSTANTS } from '../climate/pass/05-temperature-diffusion/constants'
import { PHYSICS_CONSTANTS } from '../config/physics'

// Use constants directly without passing through props
const { rockHeatCapacity, waterHeatCapacity } = THERMAL_CONSTANTS
const { stefanBoltzmann, cosmicBackgroundTemp } = PHYSICS_CONSTANTS
```

## Summary

**Key principle**:
- **Config** = user-adjustable parameters that vary between simulations (planet radius, axial tilt, albedo)
- **Constants** = physical properties and universal constants (heat capacity of water, Stefan-Boltzmann constant)

This keeps the UI focused on what users actually want to configure, while keeping physical laws and material properties as importable constants.

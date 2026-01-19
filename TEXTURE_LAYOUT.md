# Texture layout reference

## Static textures

### Cell information texture
- **R**: Latitude (degrees)
- **G**: Longitude (degrees)
- **B**: Surface area (m²)
- **A**: Reserved

### Terrain texture
- **R**: Elevation (m)
- **G**: Reserved
- **B**: Reserved
- **A**: Reserved

## Dynamic surface textures (ping-pong)

### Surface thermal texture
- **R**: Surface temperature (K)
- **G**: Reserved
- **B**: Reserved
- **A**: Surface albedo (0-1)

### Hydrology texture
- **R**: Water depth (m)
- **G**: Ice thickness (m)
- **B**: Reserved
- **A**: Salinity (PSU)

### Auxiliary texture
Not used in physics pipeline, but available for visualisation/diagnostics.
- **R**: Incoming solar flux at top of atmosphere (W/m²)
- **G**: Water state (0 = solid/frozen, 0.5 = liquid, 1 = gas/above boiling)
- **B**: Reserved
- **A**: Reserved

## Multi-layer atmosphere textures (ping-pong)

The atmosphere is divided into 3 vertical layers, each with two texture types (thermodynamic and dynamics). Each texture type uses ping-pong buffering for frame-to-frame updates.

**Total textures**: 3 layers × 2 types × 2 (ping-pong) = 12 render targets

### Layer definitions

- **Layer 0 (Boundary layer)**: 0-2 km altitude, reference pressure ~950 hPa
- **Layer 1 (Troposphere)**: 2-10 km altitude, reference pressure ~500 hPa
- **Layer 2 (Stratosphere)**: 10-50 km altitude, reference pressure ~100 hPa

### Thermodynamic state textures (per layer)

One texture per layer, storing thermodynamic properties:
- **R**: Layer temperature (K)
- **G**: Layer pressure (Pa)
- **B**: Specific humidity (kg/kg, mass mixing ratio)
- **A**: Cloud fraction (0-1)

**Uniform names**: `layer0ThermoData`, `layer1ThermoData`, `layer2ThermoData`

### Dynamics state textures (per layer)

One texture per layer, storing wind and vertical motion:
- **R**: Eastward wind component (m/s)
- **G**: Northward wind component (m/s)
- **B**: Vertical velocity in pressure coordinates (Pa/s, omega)
- **A**: Reserved

**Uniform names**: `layer0DynamicsData`, `layer1DynamicsData`, `layer2DynamicsData`

## Multiple render target (MRT) passes

Several passes use multiple render targets to output multiple textures simultaneously:

### Initialisation pass (8 outputs)
- Attachment 0: Surface state (temperature, albedo)
- Attachment 1: Hydrology state (water depth, ice, salinity)
- Attachment 2-4: Layer 0-2 thermo states
- Attachment 5-7: Layer 0-2 dynamics states

### Radiation pass (5 outputs)
- Attachment 0: Surface state (temperature, albedo)
- Attachment 1-3: Layer 0-2 thermo states (updated temperatures)
- Attachment 4: Auxiliary (TOA flux, surface net power, etc.)

### Hydrology pass (4 outputs)
- Attachment 0: Hydrology state (updated water/ice)
- Attachment 1: Auxiliary (water state update)
- Attachment 2: Surface state (with latent heat corrections)
- Attachment 3: Layer 0 thermo (updated humidity from evaporation)

### Vertical mixing pass (6 outputs)
- Attachment 0-2: Layer 0-2 thermo states
- Attachment 3-5: Layer 0-2 dynamics states

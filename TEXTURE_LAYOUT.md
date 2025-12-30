# Texture layout reference

## Cell information texture (static)
- **R**: Latitude (degrees)
- **G**: Longitude (degrees)
- **B**: Surface area (m²)
- **A**: Reserved

## Terrain texture (static)
- **R**: Elevation (m)
- **G**: Reserved
- **B**: Reserved
- **A**: Reserved

## Thermal surface texture
- **R**: Surface temperature (K)
- **G**: Unused
- **B**: Unused
- **A**: Surface albedo (0-1)

## Atmosphere texture
- **R**: Atmospheric temperature (K)
- **G**: Surface pressure (Pa)
- **B**: Precipitable water (mm)
- **A**: Atmospheric albedo/cloud cover (0-1)

## Hydrology texture
- **R**: Water depth (m)
- **G**: Ice thickness (m)
- **B**: Unused
- **A**: Salinity (PSU)

## Auxiliary texture
Not used in physics pipeline, but available for visualisation/diagnostics.
- **R**: Incoming solar flux at top of atmosphere (W/m²)
- **G**: Water state (0 = solid/frozen, 1 = liquid/above melting point)
- **B**: Unused
- **A**: Unused

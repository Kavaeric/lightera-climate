# Texture layout reference

## Cell information texture (static)
- **R**: Latitude (degrees)
- **G**: Longitude (degrees)
- **B**: Surface area (m²)
- **A**: Reserved

## Terrain texture (static)
To be reworked: Water depth, salinity, and surface albedo should likely just be written directly to the relevant working textures rather than stored in some initialisation texture that will need to be read from.
- **R**: Elevation (m)
- **G**: Water depth (m)
- **B**: Salinity (PSU)
- **A**: Base albedo (0-1)

## Thermal surface texture
- **R**: Surface temperature (K)
- **G**: Unused
- **B**: Unused
- **A**: Surface albedo (0-1)

## Thermal atmosphere texture
- **R**: Atmospheric temperature (K)
- **G**: Unused
- **B**: Unused
- **A**: Atmospheric albedo/cloud cover (0-1)

## Hydrology texture
To be deprecated.
- **R**: Ice thickness (m)
- **G**: Water thermal mass (J/K)
- **B**: Water depth (m)
- **A**: Salinity (PSU)

## Solar flux texture [Auxiliary]
Not used in physics pipeline - available for visualisation/diagnostics.
- **R**: Incoming solar flux at top of atmosphere (W/m²)
- **G**: Unused
- **B**: Unused
- **A**: Unused

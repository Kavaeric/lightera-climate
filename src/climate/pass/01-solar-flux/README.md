# Pass 1: Incident solar flux

Calculates the incoming solar radiation at the top of the atmosphere for each cell on the planet surface.

## Physics
Uses geometric calculation based on:
- Solar constant (W/m²)
- Cell position (latitude/longitude)
- Subsolar point (varies with orbital position and axial tilt)
- Lambert's cosine law: flux = solar_constant × cos(θ)

Where θ is the angle between the surface normal and the sun direction.

## Inputs
- `cellInformation` texture: Cell lat/lon coordinates
- Orbital parameters: subsolar point, axial tilt, year progress
- Solar constant (W/m²)

## Outputs
Texture with format: `[flux, reserved, reserved, reserved]`
- **R channel**: Solar flux in W/m² at top of atmosphere
- **G, B, A channels**: Reserved for future use

## Notes
- Nightside cells (sun below horizon) output 0 W/m².

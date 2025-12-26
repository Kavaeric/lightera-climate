# Pass 2: Surface incident heating

From the incoming solar energy, calculate how much energy reaches the planet's surface and how much it is heated up.

## Physics
In a single-layer atmospheric model, incident sunlight first passes through the atmosphere before reaching the ground. We can assume that all incoming solar energy is in the form of visible light, and that the atmosphere is transparent. Only cloud cover acts as an obstacle, which reflects light back out into space (which, in this model, is lost energy). For the purposes of this simulation, cloud cover is expressed as a percentage albedo figure that is estimated from the cell's humidity, though as of right now how humidity is stored in the data textures (relative humidity, precipitation, etc) is still to be decided.

The transmitted amount would then be calculated against the surface's visible light albedo to determine the amount reflected by the ground back to space.

The final absorbed amount is then used to update the ground temperature of the cell.

## Inputs
- Cell lat/lon coordinates
- Cell area
- Time step
- Surface simulation depth
- Local incoming solar flux
- Local humidity
- Local surface albedo (visible light spectrum)
- Local surface heat capacity (for now, dry rock/ground vs water vs ice)

## Outputs
- **Surface texture**: temperature

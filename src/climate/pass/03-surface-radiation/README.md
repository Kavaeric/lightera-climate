# Pass 3: Surface emission

From the temperature and properties of the surface and atmosphere, calculate the amount of heat lost by the surface that is transmitted into or through the atmosphere.

## Physics
While the ground mostly receives energy from the sun in the form of visible light, it re-radiates this heat back out as infrared light. The thermal energy emitted would be calculated as a standard black- (or grey-) body emission.

Because of this change to infrared, however, the atmosphere (normally transparent to visible light) is now able to absorb this energy, assuming the planet has one of course.

The atmosphere's thermal absorptivity can be calculated from its composition, and in a single-layer model like this one it's assumed that the atmosphere is even in its composition, save for water vapour/humidity which will be added in future.

The transmitted amount would be lost to space, and the remainder used to calculate and then update the atmospheric temperature of the cell.

## Inputs
- Cell lat/lon coordinates
- Cell area
- Time step
- Surface simulation depth
- Local humidity
- Local surface emissivity
- Atmospheric thermal absorptivity (calculated from atmospheric composition)
- Some other things I forgot

## Outputs
- **Atmosphere texture**: temperature

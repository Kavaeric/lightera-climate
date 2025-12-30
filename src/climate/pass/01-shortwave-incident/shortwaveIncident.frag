/**
 * Pass 1: Shortwave incident (combined solar flux + surface incident)
 *
 * The pass calculates:
 * 1. Solar flux at top of atmosphere based on orbital geometry
 * 2. Surface heating after atmospheric and surface albedo reflection
 *
 * The solar flux calculation uses the subsolar point (the location where the
 * sun is directly overhead) to determine the angle of incidence for each cell.
 * Cells on the night side receive zero flux.
 */

precision highp float;

#include "../../../shaders/textureAccessors.glsl"
#include "../../constants.glsl"
#include "../../../shaders/surfaceThermal.glsl"

in vec2 vUv;

// Orbital parameters
uniform float axialTilt;          // degrees - planet's axial tilt
uniform float yearProgress;       // 0-1 - current position in orbit
uniform float subsolarLon;        // degrees - current subsolar longitude (changes with planet rotation)
uniform float solarFlux;          // W/m² - solar constant at top of atmosphere

// Physics parameters
uniform float dt;  // Timestep in seconds

// Outputs (MRT - Multiple Render Targets)
layout(location = 0) out vec4 outSurfaceState;  // Updated surface state (temperature and albedo)
layout(location = 1) out vec4 outSolarFlux;     // [Auxiliary] Solar flux at TOA - not used in physics pipeline

/**
 * Convert degrees to radians
 */
float deg2rad(float deg) {
	return deg * PI / 180.0;
}

/**
 * Calculate subsolar point latitude based on orbital position and axial tilt.
 *
 * The subsolar point is always at the equator (0°) during equinoxes.
 * During the year, the subsolar latitude oscillates due to axial tilt:
 * - At vernal/autumnal equinox (yearProgress = 0.0 or 0.5): subsolar_lat = 0°
 * - At summer solstice (yearProgress = 0.25): subsolar_lat = +axialTilt
 * - At winter solstice (yearProgress = 0.75): subsolar_lat = -axialTilt
 */
float calculateSubsolarLatitude(float tilt, float progress) {
	// Sun's latitude oscillates from -tilt to +tilt
	float orbitAngle = progress * 2.0 * PI;
	return tilt * sin(orbitAngle);
}

/**
 * Calculate solar flux on a surface element given its lat/lon and subsolar point.
 * Returns flux in W/m²
 */
float calculateSolarFluxAtCell(float lat, float lon, vec2 subsolar) {
	// Convert to radians
	float lat_rad = deg2rad(lat);
	float lon_rad = deg2rad(lon);
	float subsolar_lat_rad = deg2rad(subsolar.x);
	float subsolar_lon_rad = deg2rad(subsolar.y);
	// TODO: Maybe these should be passed in as radians to save the work of converting from degrees?

	// Calculate angle between surface normal and sun direction
	// Using spherical dot product: cos(angle) = sin(lat1)*sin(lat2) + cos(lat1)*cos(lat2)*cos(lon2-lon1)
	float cosAngle = sin(lat_rad) * sin(subsolar_lat_rad) +
	                 cos(lat_rad) * cos(subsolar_lat_rad) * cos(lon_rad - subsolar_lon_rad);
	// TODO: See if the above can be optimised by pre-computing the sin and cos of the subsolar latitude and longitude
	//       and then passing them in as uniforms, which would save doing all this trig on each fragment.

	// Flux = solarFlux * max(0, cosAngle)
	// If cosAngle < 0, the sun is below the horizon
	return solarFlux * max(0.0, cosAngle);
}

void main() {
	// Read cell position
	vec2 cellLatLon = getCellLatLon(vUv);

	// === SOLAR FLUX CALCULATION ===

	// Calculate subsolar point based on orbital position, axial tilt, and planet rotation
	// Latitude varies with seasons due to axial tilt
	float subsolarLat = calculateSubsolarLatitude(axialTilt, yearProgress);
	// Longitude advances as the planet rotates
	vec2 subsolarPoint = vec2(subsolarLat, subsolarLon);

	// Calculate incoming solar flux at top of atmosphere for this cell
	float toaFlux = calculateSolarFluxAtCell(cellLatLon.x, cellLatLon.y, subsolarPoint);

	// === SURFACE HEATING CALCULATION ===

	// Read atmosphere and surface properties
	float atmosphereAlbedo = getAtmosphereAlbedo(vUv);
	float surfaceTemperature = getSurfaceTemperature(vUv);
	float surfaceAlbedo = getSurfaceAlbedo(vUv);

	// Read hydrology state to determine heat capacity
	float waterDepth = getWaterDepth(vUv);
	float iceThickness = getIceThickness(vUv);

	// The amount of energy that reaches the surface is the solar flux
	// less the amount of energy reflected by the atmosphere (albedo)
	// less the amount of energy reflected by the surface (visible light albedo)
	float surfaceIncident = toaFlux * (1.0 - atmosphereAlbedo) * (1.0 - surfaceAlbedo);

	// Calculate energy absorbed per unit area (W/m² * s = J/m²)
	float energyAbsorbed = surfaceIncident * dt;

	// Calculate temperature change from solar heating
	// Heat capacity depends on surface type (rock vs water/ice)
	// ΔT = Energy / HeatCapacity = (J/m²) / (J/(m²·K)) = K
	float heatCapacity = getSurfaceHeatCapacity(waterDepth, iceThickness);
	float temperatureChange = energyAbsorbed / heatCapacity;

	// Calculate new surface temperature
	float newSurfaceTemperature = surfaceTemperature + temperatureChange;

	// Output 0: RGBA = [surfaceTemperature, reserved, reserved, albedo]
	outSurfaceState = packSurfaceData(newSurfaceTemperature, surfaceAlbedo);

	// Output 1 [Auxiliary]: RGBA = [solar flux at TOA (W/m²), reserved, reserved, reserved]
	outSolarFlux = vec4(toaFlux, 0.0, 0.0, 0.0);
}

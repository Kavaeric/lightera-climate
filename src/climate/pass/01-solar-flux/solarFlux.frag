precision highp float;

#include "../../../shaders/textureAccessors.glsl"
#include "../../constants.glsl"

in vec2 vUv;

// Orbital parameters
uniform float axialTilt;          // degrees - planet's axial tilt
uniform float yearProgress;       // 0-1 - current position in orbit
uniform float subsolarLon;        // degrees - current subsolar longitude (changes with planet rotation)
uniform float solarFlux;          // W/m² - solar constant at top of atmosphere

// Output: Solar flux at top of atmosphere
out vec4 outSolarFlux;

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
float calculateSolarFlux(float lat, float lon, vec2 subsolar) {
  // Convert to radians
  float lat_rad = deg2rad(lat);
  float lon_rad = deg2rad(lon);
  float subsolar_lat_rad = deg2rad(subsolar.x);
  float subsolar_lon_rad = deg2rad(subsolar.y);

  // Calculate angle between surface normal and sun direction
  // Using spherical dot product: cos(angle) = sin(lat1)*sin(lat2) + cos(lat1)*cos(lat2)*cos(lon2-lon1)
  float cosAngle = sin(lat_rad) * sin(subsolar_lat_rad) +
                   cos(lat_rad) * cos(subsolar_lat_rad) * cos(lon_rad - subsolar_lon_rad);

  // Flux = solarFlux * max(0, cosAngle)
  // If cosAngle < 0, the sun is below the horizon
  float flux = solarFlux * max(0.0, cosAngle);

  return flux;
}

void main() {
  // Read cell position
  vec2 cellLatLon = getCellLatLon(vUv);

  // Calculate subsolar point based on orbital position, axial tilt, and planet rotation
  // Latitude varies with seasons due to axial tilt
  float subsolarLat = calculateSubsolarLatitude(axialTilt, yearProgress);
  // Longitude advances as the planet rotates
  vec2 subsolarPoint = vec2(subsolarLat, subsolarLon);

  // Calculate incoming solar flux at top of atmosphere for this cell
  float flux = calculateSolarFlux(cellLatLon.x, cellLatLon.y, subsolarPoint);

  // Output for solar flux texture
  outSolarFlux = packSolarFluxData(flux);
}

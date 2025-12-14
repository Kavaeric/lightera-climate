// Energy balance shader for tidally locked airless world
// Computes equilibrium temperature from solar radiation

precision highp float;

varying vec2 vUv;

// Textures
uniform sampler2D cellPositions; // RG = [latitude, longitude] in degrees

// Planet parameters
uniform vec2 subsolarPoint; // [lat, lon] in degrees where sun is directly overhead
uniform float solarFlux; // Solar irradiance at planet's distance (W/m²)
uniform float albedo; // Surface reflectivity (0-1)

// Physical constants
const float STEFAN_BOLTZMANN = 5.670374419e-8; // W/(m²·K⁴)
const float PI = 3.14159265359;

// Convert degrees to radians
float deg2rad(float deg) {
  return deg * PI / 180.0;
}

// Calculate great circle distance (angle) between two lat/lon points on a sphere
// Returns cosine of the angle between the two points
float cosSolarAngle(vec2 cellLatLon, vec2 subsolar) {
  float lat1 = deg2rad(cellLatLon.x);
  float lon1 = deg2rad(cellLatLon.y);
  float lat2 = deg2rad(subsolar.x);
  float lon2 = deg2rad(subsolar.y);

  // Spherical law of cosines
  // cos(angle) = sin(lat1)*sin(lat2) + cos(lat1)*cos(lat2)*cos(lon2-lon1)
  float cosAngle = sin(lat1) * sin(lat2) +
                   cos(lat1) * cos(lat2) * cos(lon2 - lon1);

  return cosAngle;
}

void main() {
  // Read cell position (lat/lon)
  vec2 cellLatLon = texture2D(cellPositions, vUv).rg;

  // Calculate solar zenith angle (angle between sun and vertical at this point)
  float cosSunAngle = cosSolarAngle(cellLatLon, subsolarPoint);

  // Solar flux hitting the surface
  // Negative cos means sun is below horizon (nightside)
  float solarFlux = solarFlux * (1.0 - albedo) * max(0.0, cosSunAngle);

  // Energy balance: solarFlux = σ * T^4
  // Therefore: T = (solarFlux / σ)^0.25
  float temperature = pow(solarFlux / STEFAN_BOLTZMANN, 0.25);

  // Output: R = temperature (K), G/B/A = unused for now
  gl_FragColor = vec4(temperature, 0.0, 0.0, 1.0);
}

// =============================================================================
// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Generated from: src/climate/schema/atmosphereLayerSchema.ts
// Run "npm run generate:shaders" to regenerate
// =============================================================================

#ifndef ATMOSPHERE_LAYER_ACCESSORS_GLSL
#define ATMOSPHERE_LAYER_ACCESSORS_GLSL

// =============================================================================
// CONSTANTS
// =============================================================================

const int NUM_ATMOSPHERE_LAYERS = 3;

// Pressure fractions relative to surface pressure
const float LAYER_0_PRESSURE_BOTTOM = 1.000; // Fraction of surface pressure
const float LAYER_0_PRESSURE_TOP = 0.500; // Fraction of surface pressure
const float LAYER_0_REF_PRESSURE_FRACTION = 0.700; // Fraction of surface pressure
const float LAYER_1_PRESSURE_BOTTOM = 0.500; // Fraction of surface pressure
const float LAYER_1_PRESSURE_TOP = 0.100; // Fraction of surface pressure
const float LAYER_1_REF_PRESSURE_FRACTION = 0.220; // Fraction of surface pressure
const float LAYER_2_PRESSURE_BOTTOM = 0.100; // Fraction of surface pressure
const float LAYER_2_PRESSURE_TOP = 0.001; // Fraction of surface pressure
const float LAYER_2_REF_PRESSURE_FRACTION = 0.010; // Fraction of surface pressure

// =============================================================================
// ALTITUDE CALCULATION HELPERS
// =============================================================================

// Calculate altitude from pressure using barometric formula
// z = H * ln(P_surface / P) where H is scale height
float calculateAltitude(float pressure, float surfacePressure, float scaleHeight) {
  return scaleHeight * log(surfacePressure / pressure);
}

// =============================================================================
// UNIFORM DECLARATIONS
// =============================================================================

// Thermo textures: RGBA = [temperature, pressure, humidity, cloudFraction]
uniform sampler2D layer0ThermoData;
uniform sampler2D layer1ThermoData;
uniform sampler2D layer2ThermoData;

// Dynamics textures: RGBA = [windU, windV, omega, reserved]
uniform sampler2D layer0DynamicsData;
uniform sampler2D layer1DynamicsData;
uniform sampler2D layer2DynamicsData;

// =============================================================================
// LAYER 0: BOUNDARY LAYER (100-50.0% surface pressure)
// =============================================================================

// --- Thermo State (layer0ThermoData) ---
// Layer temperature [K]
float getLayer0Temperature(vec2 uv) {
  return texture(layer0ThermoData, uv).r;
}

// Layer pressure [Pa]
float getLayer0Pressure(vec2 uv) {
  return texture(layer0ThermoData, uv).g;
}

// Specific humidity (mass mixing ratio) [kg/kg]
float getLayer0Humidity(vec2 uv) {
  return texture(layer0ThermoData, uv).b;
}

// Cloud cover fraction [0-1]
float getLayer0CloudFraction(vec2 uv) {
  return texture(layer0ThermoData, uv).a;
}

// --- Dynamics State (layer0DynamicsData) ---
// Eastward wind component [m/s]
float getLayer0WindU(vec2 uv) {
  return texture(layer0DynamicsData, uv).r;
}

// Northward wind component [m/s]
float getLayer0WindV(vec2 uv) {
  return texture(layer0DynamicsData, uv).g;
}

// Vertical velocity in pressure coordinates [Pa/s]
float getLayer0Omega(vec2 uv) {
  return texture(layer0DynamicsData, uv).b;
}

// Wind vector [m/s]
vec2 getLayer0Wind(vec2 uv) {
  vec4 data = texture(layer0DynamicsData, uv);
  return vec2(data.r, data.g);
}

// Read all thermo state at once (more efficient for multiple reads)
struct Layer0ThermoState {
  float temperature;
  float pressure;
  float humidity;
  float cloudFraction;
};

Layer0ThermoState getLayer0ThermoState(vec2 uv) {
  vec4 data = texture(layer0ThermoData, uv);
  return Layer0ThermoState(data.r, data.g, data.b, data.a);
}

// Pack thermo state for output
vec4 packLayer0Thermo(float temperature, float pressure, float humidity, float cloudFraction) {
  return vec4(temperature, pressure, humidity, cloudFraction);
}

// Pack dynamics state for output
vec4 packLayer0Dynamics(float windU, float windV, float omega) {
  return vec4(windU, windV, omega, 0.0);
}

// =============================================================================
// LAYER 1: TROPOSPHERE (50-10.0% surface pressure)
// =============================================================================

// --- Thermo State (layer1ThermoData) ---
// Layer temperature [K]
float getLayer1Temperature(vec2 uv) {
  return texture(layer1ThermoData, uv).r;
}

// Layer pressure [Pa]
float getLayer1Pressure(vec2 uv) {
  return texture(layer1ThermoData, uv).g;
}

// Specific humidity (mass mixing ratio) [kg/kg]
float getLayer1Humidity(vec2 uv) {
  return texture(layer1ThermoData, uv).b;
}

// Cloud cover fraction [0-1]
float getLayer1CloudFraction(vec2 uv) {
  return texture(layer1ThermoData, uv).a;
}

// --- Dynamics State (layer1DynamicsData) ---
// Eastward wind component [m/s]
float getLayer1WindU(vec2 uv) {
  return texture(layer1DynamicsData, uv).r;
}

// Northward wind component [m/s]
float getLayer1WindV(vec2 uv) {
  return texture(layer1DynamicsData, uv).g;
}

// Vertical velocity in pressure coordinates [Pa/s]
float getLayer1Omega(vec2 uv) {
  return texture(layer1DynamicsData, uv).b;
}

// Wind vector [m/s]
vec2 getLayer1Wind(vec2 uv) {
  vec4 data = texture(layer1DynamicsData, uv);
  return vec2(data.r, data.g);
}

// Read all thermo state at once (more efficient for multiple reads)
struct Layer1ThermoState {
  float temperature;
  float pressure;
  float humidity;
  float cloudFraction;
};

Layer1ThermoState getLayer1ThermoState(vec2 uv) {
  vec4 data = texture(layer1ThermoData, uv);
  return Layer1ThermoState(data.r, data.g, data.b, data.a);
}

// Pack thermo state for output
vec4 packLayer1Thermo(float temperature, float pressure, float humidity, float cloudFraction) {
  return vec4(temperature, pressure, humidity, cloudFraction);
}

// Pack dynamics state for output
vec4 packLayer1Dynamics(float windU, float windV, float omega) {
  return vec4(windU, windV, omega, 0.0);
}

// =============================================================================
// LAYER 2: STRATOSPHERE (10-0.1% surface pressure)
// =============================================================================

// --- Thermo State (layer2ThermoData) ---
// Layer temperature [K]
float getLayer2Temperature(vec2 uv) {
  return texture(layer2ThermoData, uv).r;
}

// Layer pressure [Pa]
float getLayer2Pressure(vec2 uv) {
  return texture(layer2ThermoData, uv).g;
}

// Specific humidity (mass mixing ratio) [kg/kg]
float getLayer2Humidity(vec2 uv) {
  return texture(layer2ThermoData, uv).b;
}

// Cloud cover fraction [0-1]
float getLayer2CloudFraction(vec2 uv) {
  return texture(layer2ThermoData, uv).a;
}

// --- Dynamics State (layer2DynamicsData) ---
// Eastward wind component [m/s]
float getLayer2WindU(vec2 uv) {
  return texture(layer2DynamicsData, uv).r;
}

// Northward wind component [m/s]
float getLayer2WindV(vec2 uv) {
  return texture(layer2DynamicsData, uv).g;
}

// Vertical velocity in pressure coordinates [Pa/s]
float getLayer2Omega(vec2 uv) {
  return texture(layer2DynamicsData, uv).b;
}

// Wind vector [m/s]
vec2 getLayer2Wind(vec2 uv) {
  vec4 data = texture(layer2DynamicsData, uv);
  return vec2(data.r, data.g);
}

// Read all thermo state at once (more efficient for multiple reads)
struct Layer2ThermoState {
  float temperature;
  float pressure;
  float humidity;
  float cloudFraction;
};

Layer2ThermoState getLayer2ThermoState(vec2 uv) {
  vec4 data = texture(layer2ThermoData, uv);
  return Layer2ThermoState(data.r, data.g, data.b, data.a);
}

// Pack thermo state for output
vec4 packLayer2Thermo(float temperature, float pressure, float humidity, float cloudFraction) {
  return vec4(temperature, pressure, humidity, cloudFraction);
}

// Pack dynamics state for output
vec4 packLayer2Dynamics(float windU, float windV, float omega) {
  return vec4(windU, windV, omega, 0.0);
}

// =============================================================================
// COLUMN-INTEGRATED ACCESSORS
// =============================================================================

// Get temperature for any layer by index
float getLayerTemperature(vec2 uv, int layer) {
  if (layer == 0) return getLayer0Temperature(uv);
  if (layer == 1) return getLayer1Temperature(uv);
  if (layer == 2) return getLayer2Temperature(uv);
  return 0.0;
}

// Get pressure for any layer by index
float getLayerPressure(vec2 uv, int layer) {
  if (layer == 0) return getLayer0Pressure(uv);
  if (layer == 1) return getLayer1Pressure(uv);
  if (layer == 2) return getLayer2Pressure(uv);
  return 0.0;
}

// Get humidity for any layer by index
float getLayerHumidity(vec2 uv, int layer) {
  if (layer == 0) return getLayer0Humidity(uv);
  if (layer == 1) return getLayer1Humidity(uv);
  if (layer == 2) return getLayer2Humidity(uv);
  return 0.0;
}

// Get cloud fraction for any layer by index
float getLayerCloudFraction(vec2 uv, int layer) {
  if (layer == 0) return getLayer0CloudFraction(uv);
  if (layer == 1) return getLayer1CloudFraction(uv);
  if (layer == 2) return getLayer2CloudFraction(uv);
  return 0.0;
}

// Calculate column-integrated precipitable water (kg/m²)
// This sums humidity weighted by layer mass
float getColumnPrecipitableWater(vec2 uv, float surfacePressure, float gravity) {
  float total = 0.0;
  // Layer 0: boundary layer (~0-2km)
  float p0 = getLayer0Pressure(uv);
  float p1 = getLayer1Pressure(uv);
  float p2 = getLayer2Pressure(uv);
  float q0 = getLayer0Humidity(uv);
  float q1 = getLayer1Humidity(uv);
  float q2 = getLayer2Humidity(uv);
  // Approximate layer masses from pressure differences
  float mass0 = (surfacePressure - p1) / gravity;
  float mass1 = (p0 - p2) / gravity;
  float mass2 = p1 / gravity;
  total = q0 * mass0 + q1 * mass1 + q2 * mass2;
  return total;
}

// Calculate effective cloud fraction (weighted by optical thickness)
// Higher clouds contribute less to total albedo
float getEffectiveCloudFraction(vec2 uv) {
  float c0 = getLayer0CloudFraction(uv);
  float c1 = getLayer1CloudFraction(uv);
  float c2 = getLayer2CloudFraction(uv);
  // Weight by approximate optical depth (lower layers thicker)
  return c0 * 0.6 + c1 * 0.3 + c2 * 0.1;
}

// Calculate mass-weighted average atmospheric temperature
float getColumnAverageTemperature(vec2 uv) {
  float t0 = getLayer0Temperature(uv);
  float t1 = getLayer1Temperature(uv);
  float t2 = getLayer2Temperature(uv);
  // Approximate weights based on typical mass distribution
  // Boundary layer ~20%, troposphere ~70%, stratosphere ~10%
  return t0 * 0.2 + t1 * 0.7 + t2 * 0.1;
}

#endif // ATMOSPHERE_LAYER_ACCESSORS_GLSL

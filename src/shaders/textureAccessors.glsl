// Texture Accessor Functions
// Provides semantic accessors for reading and writing simulation data
// This abstracts away the underlying texture channel layout AND texture uniform names
//
// Uniforms are declared here with standardized names.
// Just pass the correctly-named uniforms from TypeScript and call the accessor functions.
//
// NOTE: This file is included in GLSL ES 3.00 shaders - uses texture() instead of texture2D()

// ============================================================================
// UNIFORM DECLARATIONS
// ============================================================================

uniform sampler2D cellInformation;
uniform sampler2D terrainData;
uniform sampler2D hydrologyData;
uniform sampler2D auxiliaryData;
uniform sampler2D atmosphereData;
uniform sampler2D surfaceData;

// ============================================================================
// CELL INFORMATION TEXTURE
// Layout: RGBA = [latitude, longitude, surfaceArea, reserved]
// ============================================================================

vec2 getCellLatLon(vec2 uv) {
  vec4 data = texture(cellInformation, uv);
  return vec2(data.r, data.g); // [latitude, longitude]
}

float getCellArea(vec2 uv) {
  return texture(cellInformation, uv).b; // Surface area in m²
}


// ============================================================================
// TERRAIN TEXTURE
// Layout: RGBA = [elevation, waterDepth, salinity, baseAlbedo]
// Note: This is a static texture that doesn't change during simulation
// ============================================================================

float getElevation(vec2 uv) {
  return texture(terrainData, uv).r;
}

float getTerrainWaterDepth(vec2 uv) {
  return texture(terrainData, uv).g;
}

float getTerrainSalinity(vec2 uv) {
  return texture(terrainData, uv).b;
}

float getBaseAlbedo(vec2 uv) {
  return texture(terrainData, uv).a;
}

// ============================================================================
// HYDROLOGY TEXTURE
// Layout: RGBA = [waterDepth, iceThickness, unused, salinity]
// ============================================================================

float getWaterDepth(vec2 uv) {
  return texture(hydrologyData, uv).r;
}

float getIceThickness(vec2 uv) {
  return texture(hydrologyData, uv).g;
}

float getSalinity(vec2 uv) {
  return texture(hydrologyData, uv).a;
}

vec4 packHydrologyData(float waterDepth, float iceThickness, float salinity) {
  return vec4(waterDepth, iceThickness, 0.0, salinity);
}

// ============================================================================
// AUXILIARY TEXTURE
// Layout: RGBA = [solarFlux, waterState, reserved, reserved]
// Not used in physics pipeline - available for visualisation/diagnostics
// ============================================================================

float getSolarFlux(vec2 uv) {
  return texture(auxiliaryData, uv).r;
}

// Water state: 0.0 = solid (frozen), 1.0 = liquid (above melting point)
float getWaterState(vec2 uv) {
  return texture(auxiliaryData, uv).g;
}

vec4 packAuxiliaryData(float solarFlux, float waterState) {
  return vec4(solarFlux, waterState, 0.0, 0.0);
}

// ============================================================================
// ATMOSPHERE TEXTURE
// Layout: RGBA = [temperature, pressure, precipitableWater, albedo]
//
// pressure: Surface pressure in Pa (Earth ~101325 Pa)
// precipitableWater: Total column water vapour in mm (equivalent depth if condensed)
//                    Earth average ~25mm, range 0-70mm. 1mm = 1 kg/m²
// ============================================================================

float getAtmosphereTemperature(vec2 uv) {
  return texture(atmosphereData, uv).r;
}

float getAtmospherePressure(vec2 uv) {
  return texture(atmosphereData, uv).g;
}

float getPrecipitableWater(vec2 uv) {
  return texture(atmosphereData, uv).b;
}

float getAtmosphereAlbedo(vec2 uv) {
  return texture(atmosphereData, uv).a;
}

vec4 packAtmosphereData(float temperature, float pressure, float precipitableWater, float albedo) {
  return vec4(temperature, pressure, precipitableWater, albedo);
}

// ============================================================================
// SURFACE THERMAL TEXTURE
// Layout: RGBA = [temperature, albedo, reserved, reserved]
// ============================================================================

float getSurfaceTemperature(vec2 uv) {
  return texture(surfaceData, uv).r;
}

float getSurfaceAlbedo(vec2 uv) {
  return texture(surfaceData, uv).a;
}

vec4 packSurfaceData(float temperature, float albedo) {
  return vec4(temperature, 0.0, 0.0, albedo);
}

// Texture Accessor Functions
// Provides semantic accessors for reading and writing simulation data
// This abstracts away the underlying texture channel layout AND texture uniform names
//
// Uniforms are declared here with standardized names.
// Just pass the correctly-named uniforms from TypeScript and call the accessor functions.

// ============================================================================
// UNIFORM DECLARATIONS
// ============================================================================

uniform sampler2D cellInformation;
uniform sampler2D terrainData;
uniform sampler2D hydrologyData;
uniform sampler2D solarFluxData;
uniform sampler2D atmosphereData;
uniform sampler2D surfaceData;

// ============================================================================
// CELL INFORMATION TEXTURE
// Layout: RGBA = [latitude, longitude, surfaceArea, reserved]
// ============================================================================

vec2 getCellLatLon(vec2 uv) {
  vec4 data = texture2D(cellInformation, uv);
  return vec2(data.r, data.g); // [latitude, longitude]
}

float getCellArea(vec2 uv) {
  return texture2D(cellInformation, uv).b; // Surface area in m²
}


// ============================================================================
// TERRAIN TEXTURE
// Layout: RGBA = [elevation, waterDepth, salinity, baseAlbedo]
// Note: This is a static texture that doesn't change during simulation
// ============================================================================

float getElevation(vec2 uv) {
  return texture2D(terrainData, uv).r;
}

float getTerrainWaterDepth(vec2 uv) {
  return texture2D(terrainData, uv).g;
}

float getTerrainSalinity(vec2 uv) {
  return texture2D(terrainData, uv).b;
}

float getBaseAlbedo(vec2 uv) {
  return texture2D(terrainData, uv).a;
}

// ============================================================================
// HYDROLOGY TEXTURE
// Layout: RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
// ============================================================================

float getIceThickness(vec2 uv) {
  return texture2D(hydrologyData, uv).r;
}

float getWaterThermalMass(vec2 uv) {
  return texture2D(hydrologyData, uv).g;
}

float getWaterDepth(vec2 uv) {
  return texture2D(hydrologyData, uv).b;
}

float getSalinity(vec2 uv) {
  return texture2D(hydrologyData, uv).a;
}

vec4 packHydrologyData(float iceThickness, float waterThermalMass, float waterDepth, float salinity) {
  return vec4(iceThickness, waterThermalMass, waterDepth, salinity);
}

// ============================================================================
// SOLAR FLUX TEXTURE
// Layout: RGBA = [solarFlux, reserved, reserved, reserved]
// ============================================================================

float getSolarFlux(vec2 uv) {
  return texture2D(solarFluxData, uv).r;
}

vec4 packSolarFluxData(float solarFlux) {
  return vec4(solarFlux, 0.0, 0.0, 0.0);
}

// ============================================================================
// ATMOSPHERE THERMAL TEXTURE
// Layout: RGBA = [temperature, unused, unused, albedo]
// ============================================================================

float getAtmosphereTemperature(vec2 uv) {
  return texture2D(atmosphereData, uv).r;
}

float getAtmosphereAlbedo(vec2 uv) {
  return texture2D(atmosphereData, uv).a;
}

vec4 packAtmosphereData(float temperature, float albedo) {
  return vec4(temperature, 0.0, 0.0, albedo);
}

// ============================================================================
// SURFACE THERMAL TEXTURE
// Layout: RGBA = [temperature, albedo, reserved, reserved]
// ============================================================================

float getSurfaceTemperature(vec2 uv) {
  return texture2D(surfaceData, uv).r;
}

float getSurfaceAlbedo(vec2 uv) {
  return texture2D(surfaceData, uv).g;
}

vec4 packSurfaceData(float temperature, float albedo) {
  return vec4(temperature, albedo, 0.0, 0.0);
}

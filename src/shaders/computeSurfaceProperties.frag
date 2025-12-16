precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D terrainData;    // Static terrain: RGBA = [elevation, waterDepth, salinity, baseAlbedo]
uniform sampler2D hydrologyData;  // Hydrology state: RGBA = [iceThickness, waterThermalMass, unused, unused]

// Physical constants for albedo
const float ALBEDO_ICE = 0.6;     // Ice is highly reflective
const float ALBEDO_WATER = 0.06;  // Water absorbs most light
const float ALBEDO_ROCK = 0.1;    // Airless body rock (Moon, Mercury)

void main() {
  // Read terrain and hydrology
  vec4 terrain = texture2D(terrainData, vUv);
  float elevation = terrain.r;
  float waterDepth = terrain.g;
  float salinity = terrain.b;
  float baseAlbedo = terrain.a;

  vec4 hydro = texture2D(hydrologyData, vUv);
  float iceThickness = hydro.r;
  float waterThermalMass = hydro.g;

  // Determine surface type and compute effective albedo
  float hasWater = step(0.01, waterDepth);   // 1.0 if water present
  float hasIce = step(0.01, iceThickness);   // 1.0 if ice present

  float effectiveAlbedo = baseAlbedo;  // Default to terrain base albedo

  if (hasWater > 0.5) {
    // Water is present at this location
    if (hasIce > 0.5) {
      // Ice layer covering water
      effectiveAlbedo = ALBEDO_ICE;
    } else {
      // Liquid water (no ice)
      effectiveAlbedo = ALBEDO_WATER;
    }
  }

  // Heat capacity (informational, for debugging/visualization)
  // 0 = rock (low thermal mass)
  // 1 = water (high thermal mass)
  float thermalMass = 0.0;
  if (hasWater > 0.5) {
    // Water is present
    if (hasIce > 0.5) {
      // Ice: intermediate thermal mass (normalized to ~0.3)
      thermalMass = 0.3;
    } else {
      // Liquid water: high thermal mass
      thermalMass = 1.0;
    }
  }
  // else rock remains 0.0

  // Output: RGBA
  // R = effective albedo (0-1)
  // G = thermal mass indicator (0-1)
  // B = ice presence (0-1, for visualization)
  // A = water presence (0-1, for visualization)
  gl_FragColor = vec4(effectiveAlbedo, thermalMass, hasIce, hasWater);
}

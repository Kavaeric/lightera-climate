precision highp float;

varying vec2 vUv;

// Input textures
uniform sampler2D terrainData;        // Static terrain: RGBA = [elevation, reserved, reserved, reserved]
uniform sampler2D hydrologyData;      // Current hydrology: RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]

void main() {
  // Read hydrology state
  vec4 hydro = texture2D(hydrologyData, vUv);
  float iceThickness = hydro.r;       // meters
  float waterDepth = hydro.b;         // meters (dynamic)

  // Compute effective surface albedo based on phase state (branch-free)
  // Ice and water have much higher albedo than rock
  float hasWater = step(0.01, waterDepth);      // 1.0 if water present
  float hasIce = step(0.01, iceThickness);       // 1.0 if ice present

  // Albedo transitions:
  // - No water: 0.2 (average rock/dirt)
  // - Liquid water: 0.06 (absorbs most radiation)
  // - Ice-covered water: 0.65 (reflects most radiation)
  float albedoRock = 0.2;
  float albedoWater = 0.06;
  float albedoIce = 0.65;
  float albedoWaterOrIce = mix(albedoWater, albedoIce, hasIce);
  float effectiveAlbedo = mix(albedoRock, albedoWaterOrIce, hasWater);

  // Output surface properties
  // RGBA = [effectiveAlbedo, reserved, reserved, reserved]
  gl_FragColor = vec4(effectiveAlbedo, 0.0, 0.0, 0.0);
}

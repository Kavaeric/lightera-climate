precision highp float;

varying vec2 vUv;

// Hydrology initialization data passed as textures
// We'll need to pack the data into textures since WebGL doesn't support large uniform buffers easily
uniform sampler2D waterDepthTexture;
uniform sampler2D salinityTexture;
uniform sampler2D iceThicknessTexture;

void main() {
  // Read initialization data from textures
  float waterDepth = texture2D(waterDepthTexture, vUv).r;
  float salinity = texture2D(salinityTexture, vUv).r;
  float iceThickness = texture2D(iceThicknessTexture, vUv).r;
  float waterThermalMass = 0.0; // Start with no thermal mass

  // Output hydrology state
  // RGBA = [iceThickness, waterThermalMass, waterDepth, salinity]
  gl_FragColor = vec4(iceThickness, waterThermalMass, waterDepth, salinity);
}

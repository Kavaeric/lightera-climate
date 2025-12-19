// Terrain visualisation fragment shader
// Simple greyscale elevation heightmap for debugging

precision highp float;

// Terrain data texture (elevation in red channel)
uniform sampler2D terrainTex;

// Hydrology data texture (RGBA = [iceThickness, waterThermalMass, waterDepth, salinity])
uniform sampler2D hydrologyTex;

// Elevation range for normalisation
uniform float elevationMin;
uniform float elevationMax;

// Water depth range for normalisation
// Not that I actually use these
uniform float waterDepthMin;
uniform float waterDepthMax;

varying vec2 vUv;
varying vec3 vNormal;

// Elevation colourmap, something that looks like rocky planet terrain
const vec3 elevationColourmap[10] = vec3[](
  vec3(0.200000, 0.185098, 0.167255), // Lowest elevation
  vec3(0.258824, 0.243922, 0.238235),
  vec3(0.321569, 0.306667, 0.293137),
  vec3(0.380392, 0.369412, 0.358039),
  vec3(0.439216, 0.426078, 0.412941),
  vec3(0.509804, 0.484510, 0.479608),
  vec3(0.650980, 0.631373, 0.632941),
  vec3(0.749020, 0.737255, 0.720980),
  vec3(0.858824, 0.858824, 0.842549),
  vec3(0.988235, 0.988235, 0.969020)  // Highest elevation
);

const int elevationColourmapLength = 10;
const vec3 elevationUnderflowColour = vec3(0.0, 0.0, 0.2);
const vec3 elevationOverflowColour = vec3(1.0, 0.0, 1.0);

// Water depth colourmap, something that looks like liquid water seas
// Since the water depth is set to 5000m, this corresponds to intervals of 250m
const vec3 waterDepthColourmap[21] = vec3[](
  vec3(0.329412, 0.639216, 0.756863), // Shallowest water, 0m
  vec3(0.120824, 0.355490, 0.460980), // 250m
  vec3(0.020157, 0.169608, 0.271176), // 500m
  vec3(0.019216, 0.152549, 0.262353),
  vec3(0.017615, 0.146676, 0.258724),
  vec3(0.016014, 0.140803, 0.255096),
  vec3(0.014413, 0.134930, 0.251468),
  vec3(0.012812, 0.129057, 0.247840),
  vec3(0.011211, 0.123184, 0.224212),
  vec3(0.009610, 0.117311, 0.210583),
  vec3(0.008009, 0.111438, 0.206955),
  vec3(0.006409, 0.105565, 0.193327),
  vec3(0.004808, 0.099692, 0.189699),
  vec3(0.003207, 0.093819, 0.176071),
  vec3(0.001606, 0.087945, 0.162443),
  vec3(0.000005, 0.082072, 0.158815),
  vec3(0.000000, 0.076199, 0.145186),
  vec3(0.000000, 0.070326, 0.131558),
  vec3(0.000000, 0.064453, 0.107930),
  vec3(0.000000, 0.058580, 0.084302),
  vec3(0.000000, 0.052549, 0.062353)  // Deepest water
);

const int waterDepthColourmapLength = 21;
const vec3 waterDepthUnderflowColour = vec3(0.0, 0.0, 0.2);
const vec3 waterDepthOverflowColour = waterDepthColourmap[waterDepthColourmapLength - 1];

// Ice thickness colourmap, something that looks like ice sheets
const vec3 iceThicknessColourmap[10] = vec3[](
  vec3(0.80, 0.82, 0.83), // Thinnest ice
  vec3(0.90, 0.91, 0.92),
  vec3(0.90, 0.90, 0.91),
  vec3(0.90, 0.90, 0.90),
  vec3(0.91, 0.91, 0.91),
  vec3(0.91, 0.92, 0.92),
  vec3(0.92, 0.92, 0.92),
  vec3(0.92, 0.93, 0.93),
  vec3(0.93, 0.93, 0.93),
  vec3(0.93, 0.94, 0.94)  // Thickest ice
);

const int iceThicknessColourmapLength = 10;
const vec3 iceThicknessUnderflowColour = vec3(0.0, 0.2, 0.2);
const vec3 iceThicknessOverflowColour = iceThicknessColourmap[iceThicknessColourmapLength - 1];

/**
 * Sample colour from elevation colourmap using normalised value [0, 1]
 */
vec3 sampleElevationColourmap(float t) {
  // Clamp to [0, 1]
  t = clamp(t, 0.0, 1.0);
  
  // Map t to colourmap range
  float segment = t * float(elevationColourmapLength - 1);
  int index = int(floor(segment));
  float localT = fract(segment);
  
  // Clamp index to valid range
  if (index >= elevationColourmapLength - 1) {
    return elevationColourmap[elevationColourmapLength - 1];
  }
  if (index < 0) {
    return elevationColourmap[0];
  }
  
  // Linear interpolation between adjacent control points
  return mix(elevationColourmap[index], elevationColourmap[index + 1], localT);
}

/**
 * Sample colour from water depth colourmap using normalised value [0, 1]
 */
vec3 sampleWaterDepthColourmap(float t) {
  // Clamp to [0, 1]
  t = clamp(t, 0.0, 1.0);
  
  // Map t to colourmap range
  float segment = t * float(waterDepthColourmapLength - 1);
  int index = int(floor(segment));
  float localT = fract(segment);
  
  // Clamp index to valid range
  if (index >= waterDepthColourmapLength - 1) {
    return waterDepthColourmap[waterDepthColourmapLength - 1];
  }
  if (index < 0) {
    return waterDepthColourmap[0];
  }
  
  // Linear interpolation between adjacent control points
  return mix(waterDepthColourmap[index], waterDepthColourmap[index + 1], localT);
}

/**
 * Sample colour from ice thickness colourmap using normalised value [0, 1]
 */
vec3 sampleIceThicknessColourmap(float t) {
  // Clamp to [0, 1]
  t = clamp(t, 0.0, 1.0);
  
  // Map t to colourmap range
  float segment = t * float(iceThicknessColourmapLength - 1);
  int index = int(floor(segment));
  float localT = fract(segment);
  
  // Clamp index to valid range
  if (index >= iceThicknessColourmapLength - 1) {
    return iceThicknessColourmap[iceThicknessColourmapLength - 1];
  }
  if (index < 0) {
    return iceThicknessColourmap[0];
  }
  
  // Linear interpolation between adjacent control points
  return mix(iceThicknessColourmap[index], iceThicknessColourmap[index + 1], localT);
}

void main() {
  // Sample elevation from terrain texture (red channel)
  float elevation = texture2D(terrainTex, vUv).r;
  
  // Normalise to [0, 1]
  float normalisedElevation = (elevation - elevationMin) / (elevationMax - elevationMin);
  
  // Detect underflow/overflow for fallback colouring
  float isUnderflow = step(normalisedElevation, -0.0001); // Weird negative decimal to avoid returning 1.0 for elevation exactly at the min value
  float isOverflow = step(1.0, normalisedElevation);
  float isNormal = (1.0 - isUnderflow) * (1.0 - isOverflow);
  
  // Sample colour from elevation colourmap or use overflow/underflow colours
  vec3 normalElevationColour = sampleElevationColourmap(normalisedElevation);
  
  vec3 elevationColour = elevationUnderflowColour * isUnderflow +
                elevationOverflowColour * isOverflow +
                normalElevationColour * isNormal;

  // Sample water depth from hydrology texture (blue channel)
  float waterDepth = texture2D(hydrologyTex, vUv).b;
  
  // Normalise to [0, 1]
  float normalisedWaterDepth = (waterDepth - 0.0) / (5000.0 - 0.0);
  
  // Detect underflow/overflow for fallback colouring
  float isUnderflowWaterDepth = step(normalisedWaterDepth, 0.0);
  float isOverflowWaterDepth = step(1.0001, normalisedWaterDepth); // Weird positive decimal to avoid returning 0.0 for water depth exactly at the max value
  float isNormalWaterDepth = (1.0 - isUnderflowWaterDepth) * (1.0 - isOverflowWaterDepth);
  
  // Sample colour from water depth colourmap or use overflow/underflow colours
  vec3 normalWaterDepthColour = sampleWaterDepthColourmap(normalisedWaterDepth);
  
  // Blend water depth colour with elevation colour based on water presence
  vec3 waterDepthColour = waterDepthUnderflowColour * isUnderflowWaterDepth +
                waterDepthOverflowColour * isOverflowWaterDepth +
                normalWaterDepthColour * isNormalWaterDepth;
  
  // Create a mask for water presence
  float hasWater = step(0.01, waterDepth);

  // Sample ice thickness from hydrology texture (red channel)
  float iceThickness = texture2D(hydrologyTex, vUv).r;
  
  // Normalise to [0, 1]
  float normalisedIceThickness = (iceThickness - 0.0) / (5000.0 - 0.0);
  
  // Detect underflow/overflow for fallback colouring
  float isUnderflowIceThickness = step(normalisedIceThickness, 0.0);
  float isOverflowIceThickness = step(1.0001, normalisedIceThickness); // Weird positive decimal to avoid returning 0.0 for ice thickness exactly at the max value
  float isNormalIceThickness = (1.0 - isUnderflowIceThickness) * (1.0 - isOverflowIceThickness);

  // Sample colour from ice thickness colourmap or use overflow/underflow colours
  vec3 normalIceThicknessColour = sampleIceThicknessColourmap(normalisedIceThickness);

  // Blend ice thickness colour with elevation colour based on ice presence
  vec3 iceThicknessColour = iceThicknessUnderflowColour * isUnderflowIceThickness +
                iceThicknessOverflowColour * isOverflowIceThickness +
                normalIceThicknessColour * isNormalIceThickness;

  // Create a mask for ice presence
  float hasIce = step(0.01, iceThickness);

  // Overlay ice and water colours on top of elevation colour
  vec3 colour = mix(mix(elevationColour, waterDepthColour, hasWater), iceThicknessColour, hasIce);

  gl_FragColor = vec4(colour, 1.0);
}

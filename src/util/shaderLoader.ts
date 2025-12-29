/**
 * Shader loading utilities
 * Provides helpers for composing shader code with shared includes
 */

import type { Colourmap } from '../config/colourmaps'
import textureAccessors from '../shaders/textureAccessors.glsl?raw'

/**
 * Prepend texture accessor functions to a shader
 * This allows shaders to use semantic accessors like getSurfaceTemperature()
 * instead of raw texture channel access like texture2D(surfaceTex, uv).r
 *
 * @param shaderCode The shader source code
 * @returns Combined shader with texture accessors prepended
 */
export function withTextureAccessors(shaderCode: string): string {
  return `precision highp float;\n${textureAccessors}\n${shaderCode}`
}

/**
 * Generate a visualisation shader for a specific accessor function with colourmap applied
 * This eliminates the need to manually track which channel corresponds to which data
 * or handle colourmap uniforms separately
 *
 * @param accessorFunctionName The name of the accessor function (e.g., 'getSurfaceTemperature')
 * @param textureUniformName The name of the texture uniform (e.g., 'dataTex')
 * @param colourmap The colourmap definition with colours and underflow/overflow colours
 * @returns A fragment shader that calls the accessor, normalizes with value range, and applies colourmap
 *
 * @example
 * createAccessorShader('getSurfaceTemperature', 'dataTex', COLOURMAP_PLASMA)
 * // Generates a shader that reads temperature, normalizes it, and applies the plasma colourmap
 */
export function createAccessorShader(
  accessorFunctionName: string,
  colourmap: Colourmap
): string {
  // Convert colourmap colours (THREE.Vector3) to GLSL vec3 array assignments
  const colourmapAssignments = colourmap.colours
    .map((c, i) => `colourmapColours[${i}] = vec3(${c.x.toFixed(6)}, ${c.y.toFixed(6)}, ${c.z.toFixed(6)});`)
    .join('\n  ')

  const underflow = colourmap.underflowColour
  const overflow = colourmap.overflowColour

  return `precision highp float;
${textureAccessors}

uniform float valueMin;
uniform float valueMax;

in vec2 vUv;

out vec4 fragColour;

vec3 sampleColourmap(float t) {
  // Clamp to [0, 1]
  t = clamp(t, 0.0, 1.0);

  // Array of colourmap control points
  vec3 colourmapColours[${colourmap.colours.length}];
  ${colourmapAssignments}
  int colourmapLength = ${colourmap.colours.length};

  // Map t to colourmap range
  float segment = t * float(colourmapLength - 1);
  int index = int(floor(segment));
  float localT = fract(segment);

  // Clamp index to valid range
  if (index >= colourmapLength - 1) {
    return colourmapColours[colourmapLength - 1];
  }
  if (index < 0) {
    return colourmapColours[0];
  }

  // Linear interpolation between adjacent control points
  return mix(colourmapColours[index], colourmapColours[index + 1], localT);
}

void main() {
  float value = ${accessorFunctionName}(vUv);

  // Normalise to [0, 1]
  float normalised = (value - valueMin) / (valueMax - valueMin);

  // Detect underflow/overflow for fallback colouring
  float isUnderflow = step(normalised, 0.0 + 1e-6);
  float isOverflow = step(1.0 + 1e-6, normalised);
  float isNormal = (1.0 - isUnderflow) * (1.0 - isOverflow);

  // Sample colour from colourmap or use overflow/underflow colours
  vec3 normalColor = sampleColourmap(normalised);

  vec3 underflowColour = vec3(${underflow.x.toFixed(6)}, ${underflow.y.toFixed(6)}, ${underflow.z.toFixed(6)});
  vec3 overflowColour = vec3(${overflow.x.toFixed(6)}, ${overflow.y.toFixed(6)}, ${overflow.z.toFixed(6)});

  vec3 colour = underflowColour * isUnderflow +
                overflowColour * isOverflow +
                normalColor * isNormal;

  fragColour = vec4(colour, 1.0);
}
`
}

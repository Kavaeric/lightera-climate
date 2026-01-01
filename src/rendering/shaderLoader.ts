/**
 * Shader loading utilities
 * Provides helpers for composing shader code with shared includes
 */

import type { ColourmapDefinition } from './colourmaps/ColourmapTexture';
import { getColourmapUVMapping } from './colourmaps/ColourmapTexture';
import textureAccessors from './shaders/utility/textureAccessors.glsl?raw';

/**
 * Prepend texture accessor functions to a shader
 * This allows shaders to use semantic accessors like getSurfaceTemperature()
 * instead of raw texture channel access like texture2D(surfaceTex, uv).r
 *
 * @param shaderCode The shader source code
 * @returns Combined shader with texture accessors prepended
 */
export function withTextureAccessors(shaderCode: string): string {
  return `precision highp float;\n${textureAccessors}\n${shaderCode}`;
}

// Default texture resolution for colourmaps
const DEFAULT_COLOURMAP_RESOLUTION = 256;

/**
 * Generate a visualisation shader for a specific accessor function with texture-based colourmap
 *
 * The generated shader expects these uniforms:
 * - colourmapTexture: sampler2D (1D texture with colourmap gradient)
 * - valueMin: float (minimum value for normalisation)
 * - valueMax: float (maximum value for normalisation)
 * - Plus any uniforms required by the accessor function (e.g., surfaceData, terrainData)
 *
 * @param accessorFunctionName The name of the accessor function (e.g., 'getSurfaceTemperature')
 * @param resolution Colourmap texture resolution (default: 256)
 * @param inclusiveUnderflow If true, values equal to the minimum count as underflow (default: false)
 * @param inclusiveOverflow If true, values equal to the maximum count as overflow (default: false)
 * @returns A fragment shader that calls the accessor, normalizes with value range, and samples colourmap texture
 *
 * @example
 * createAccessorShader('getSurfaceTemperature')
 * // Generates a shader that reads temperature, normalizes it, and samples colourmap texture
 */
export function createAccessorShader(
  accessorFunctionName: string,
  _colourmap: ColourmapDefinition, // Kept for API compatibility; texture created separately
  inclusiveUnderflow: boolean = false,
  inclusiveOverflow: boolean = false,
  resolution: number = DEFAULT_COLOURMAP_RESOLUTION
): string {
  const { offset, scale } = getColourmapUVMapping(resolution);

  return `precision highp float;
${textureAccessors}

uniform sampler2D colourmapTexture;
uniform float valueMin;
uniform float valueMax;

in vec2 vUv;

out vec4 fragColour;

// Flag for if the minimum value should count as underflow.
// e.g. if true, then 0.0 will be marked with the underflow colour.
const float inclusiveUnderflow = ${inclusiveUnderflow ? '1.0' : '0.0'};

// Flag for if the maximum value should count as overflow.
// e.g. if true, then 1.0 will be marked with the overflow colour.
const float inclusiveOverflow = ${inclusiveOverflow ? '1.0' : '0.0'};

// Colourmap UV mapping constants
// Maps normalised t ∈ [0, 1] to texture UV for gradient region
const float cmapOffset = ${offset.toFixed(6)};
const float cmapScale = ${scale.toFixed(6)};

// Sample colourmap texture at normalised position t
// t < 0: samples underflow colour (first pixel)
// t > 1: samples overflow colour (last pixel)
// t ∈ [0, 1]: samples gradient region
vec3 sampleColourmapTexture(float t) {
  float u;
  if (t < 0.0) {
    u = 0.0;  // Underflow pixel
  } else if (t > 1.0) {
    u = 1.0;  // Overflow pixel
  } else {
    u = cmapOffset + t * cmapScale;  // Gradient region
  }
  return texture(colourmapTexture, vec2(u, 0.5)).rgb;
}

void main() {
  float value = ${accessorFunctionName}(vUv);

  // Normalise to [0, 1]
  float normalised = (value - valueMin) / (valueMax - valueMin);

  // Detect underflow/overflow for fallback colouring
  // Branchless: step() includes equality, so subtract it when inclusive (to exclude from underflow/overflow)
  float atMin = step(normalised, 0.0) * step(0.0, normalised);  // normalised == 0.0
  float atMax = step(1.0, normalised) * step(normalised, 1.0);  // normalised == 1.0

  float isUnderflow = step(normalised, 0.0) - atMin * inclusiveUnderflow;
  float isOverflow = step(1.0, normalised) - atMax * inclusiveOverflow;

  float isNormal = (1.0 - isUnderflow) * (1.0 - isOverflow);

  // Sample colours
  vec3 underflowColour = sampleColourmapTexture(-1.0);  // Forces u=0
  vec3 overflowColour = sampleColourmapTexture(2.0);   // Forces u=1
  vec3 normalColour = sampleColourmapTexture(normalised);

  vec3 colour = underflowColour * isUnderflow +
                overflowColour * isOverflow +
                normalColour * isNormal;

  fragColour = vec4(colour, 1.0);
}
`;
}

// Re-export colourmap types and utilities for convenience
export type { ColourmapDefinition as Colourmap } from './colourmaps/ColourmapTexture';
export { createColourmapTexture } from './colourmaps/ColourmapTexture';

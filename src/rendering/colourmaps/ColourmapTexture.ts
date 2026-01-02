/**
 * Colourmap texture creation utilities
 * Creates 1D textures from colourmap definitions for GPU sampling
 */

import * as THREE from 'three';

/**
 * Colourmap definition for texture generation
 */
export interface ColourmapDefinition {
  name: string;
  // Colour stops with positions and RGB colours (0-1 range)
  stops: Array<{
    position: number; // 0.0 to 1.0
    colour: [number, number, number] | { r: number; g: number; b: number } | THREE.Vector3;
  }>;
  // Optional: interpolation colour space
  interpolationSpace?: 'rgb' | 'lab';
  // Colour for values below the minimum range
  underflowColour: [number, number, number] | { r: number; g: number; b: number } | THREE.Vector3;
  // Colour for values above the maximum range
  overflowColour: [number, number, number] | { r: number; g: number; b: number } | THREE.Vector3;
}

/**
 * Default texture resolution for colourmaps
 * 256 provides smooth gradients without excessive memory
 */
const DEFAULT_RESOLUTION = 256;

/**
 * Get RGB values from various colour formats
 */
function getRGB(
  colour: [number, number, number] | { r: number; g: number; b: number } | THREE.Vector3
): [number, number, number] {
  if (colour instanceof THREE.Vector3) {
    return [colour.x, colour.y, colour.z];
  }
  if (Array.isArray(colour)) {
    return colour;
  }
  return [colour.r, colour.g, colour.b];
}

/**
 * Linear interpolation between two RGB colours
 */
function lerpColour(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Sample a colourmap at a normalized position t [0, 1]
 * Handles both position-based stops and legacy evenly-spaced colours
 */
function sampleColourmap(
  stops: Array<{
    position: number;
    colour: [number, number, number] | { r: number; g: number; b: number } | THREE.Vector3;
  }>,
  t: number
): [number, number, number] {
  const n = stops.length;
  if (n === 0) return [0, 0, 0];
  if (n === 1) return getRGB(stops[0].colour);

  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));

  // Find the two stops that bracket t
  // Stops should be sorted by position, but we'll handle unsorted gracefully
  let lowerIndex = 0;
  let upperIndex = n - 1;

  // Handle edge cases
  if (t <= stops[0].position) {
    return getRGB(stops[0].colour);
  }
  if (t >= stops[n - 1].position) {
    return getRGB(stops[n - 1].colour);
  }

  // Binary search for the bracket
  for (let i = 0; i < n - 1; i++) {
    if (stops[i].position <= t && t <= stops[i + 1].position) {
      lowerIndex = i;
      upperIndex = i + 1;
      break;
    }
  }

  // Interpolate between the two stops
  const lower = stops[lowerIndex];
  const upper = stops[upperIndex];
  const positionRange = upper.position - lower.position;

  // Avoid division by zero if stops have the same position
  if (positionRange === 0) {
    return getRGB(lower.colour);
  }

  const localT = (t - lower.position) / positionRange;
  const colourA = getRGB(lower.colour);
  const colourB = getRGB(upper.colour);

  return lerpColour(colourA, colourB, localT);
}

/**
 * Creates a 1D texture from a colourmap definition
 *
 * The texture uses RGBA format where:
 * - RGB = interpolated colourmap colour
 * - A = 1.0 (fully opaque)
 *
 * Edge pixels store underflow/overflow colours:
 * - First pixel (u=0): underflow colour
 * - Last pixel (u=1): overflow colour
 * - Inner pixels: sampled colourmap gradient
 *
 * Use with clamp-to-edge wrapping for correct underflow/overflow handling
 *
 * @param colourmap The colourmap definition (new or legacy format)
 * @param resolution Number of texels in the texture (default: 256)
 * @returns THREE.DataTexture configured for colourmap sampling
 */
export function createColourmapTexture(
  colourmap: ColourmapDefinition,
  resolution: number = DEFAULT_RESOLUTION
): THREE.DataTexture {
  // Allocate RGBA data (4 bytes per pixel)
  const data = new Uint8Array(resolution * 4);

  // Reserve edge pixels for underflow/overflow
  // Inner range maps t ∈ [0, 1] to pixels [1, resolution-2]
  const innerStart = 1;
  const innerEnd = resolution - 2;
  const innerRange = innerEnd - innerStart;

  // First pixel: underflow colour
  const [ur, ug, ub] = getRGB(colourmap.underflowColour);
  data[0] = Math.round(ur * 255);
  data[1] = Math.round(ug * 255);
  data[2] = Math.round(ub * 255);
  data[3] = 255;

  // Last pixel: overflow colour
  const [or, og, ob] = getRGB(colourmap.overflowColour);
  const lastIdx = (resolution - 1) * 4;
  data[lastIdx + 0] = Math.round(or * 255);
  data[lastIdx + 1] = Math.round(og * 255);
  data[lastIdx + 2] = Math.round(ob * 255);
  data[lastIdx + 3] = 255;

  // Inner pixels: sampled colourmap gradient
  for (let i = innerStart; i <= innerEnd; i++) {
    const t = (i - innerStart) / innerRange;
    const [r, g, b] = sampleColourmap(colourmap.stops, t);

    const idx = i * 4;
    data[idx + 0] = Math.round(r * 255);
    data[idx + 1] = Math.round(g * 255);
    data[idx + 2] = Math.round(b * 255);
    data[idx + 3] = 255;
  }

  // Create 1D texture (Nx1)
  const texture = new THREE.DataTexture(
    data,
    resolution,
    1,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );

  // Configure for colourmap sampling
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

/**
 * UV coordinate mapping for colourmap textures
 *
 * Maps a normalised value t ∈ [0, 1] to texture UV coordinates
 * that correctly sample the inner gradient region while
 * triggering underflow/overflow colours at the edges.
 *
 * @param resolution Texture resolution (must match createColourmapTexture)
 * @returns Object with offset and scale for UV calculation: u = offset + t * scale
 */
export function getColourmapUVMapping(resolution: number = DEFAULT_RESOLUTION): {
  offset: number;
  scale: number;
} {
  // Map t ∈ [0, 1] to pixels [1, resolution-2]
  const innerStart = 1;
  const innerEnd = resolution - 2;

  // Convert pixel indices to UV coordinates (0-1 range)
  // UV = (pixelIndex + 0.5) / resolution (sample at pixel center)
  const uvStart = (innerStart + 0.5) / resolution;
  const uvEnd = (innerEnd + 0.5) / resolution;
  const uvRange = uvEnd - uvStart;

  return {
    offset: uvStart,
    scale: uvRange,
  };
}

/**
 * Generate GLSL code for colourmap texture sampling
 *
 * This creates shader code that samples a colourmap texture correctly,
 * handling the UV mapping to trigger underflow/overflow at edges.
 *
 * @param uniformName Name of the sampler2D uniform
 * @param resolution Texture resolution (must match texture creation)
 * @returns GLSL function: vec3 sampleColourmap(float t)
 */
export function generateColourmapSamplerGLSL(
  uniformName: string,
  resolution: number = DEFAULT_RESOLUTION
): string {
  const { offset, scale } = getColourmapUVMapping(resolution);

  return `
// Sample colourmap texture with proper UV mapping
// t ∈ [0, 1] maps to gradient region; values outside trigger underflow/overflow
vec3 sampleColourmapTexture(float t) {
  // Map t to texture UV coordinates
  // Inner gradient region is at UV [${offset.toFixed(6)}, ${(offset + scale).toFixed(6)}]
  float u = ${offset.toFixed(6)} + clamp(t, 0.0, 1.0) * ${scale.toFixed(6)};

  // Sample texture and return RGB
  return texture(${uniformName}, vec2(u, 0.5)).rgb;
}

// Sample with underflow/overflow detection
vec4 sampleColourmapWithFlags(float t) {
  float isUnderflow = step(t, 0.0);
  float isOverflow = step(1.0, t);

  // For underflow, sample at u=0; for overflow, sample at u=1
  float u;
  if (t < 0.0) {
    u = 0.0;  // Underflow pixel
  } else if (t > 1.0) {
    u = 1.0;  // Overflow pixel
  } else {
    u = ${offset.toFixed(6)} + t * ${scale.toFixed(6)};  // Gradient region
  }

  vec3 colour = texture(${uniformName}, vec2(u, 0.5)).rgb;
  return vec4(colour, isUnderflow + isOverflow * 2.0);  // .a encodes flags
}
`;
}

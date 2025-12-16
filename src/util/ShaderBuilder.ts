/**
 * Utility for building shader material uniforms from colourmaps
 * Provides a clean interface to configure display shaders with different colourmaps
 */

import * as THREE from 'three'
import type { Colourmap } from '../config/colourmaps'

/**
 * Build shader uniforms from a colourmap and data range
 * This provides a clean way to configure the unified display shader
 */
export function buildDisplayShaderUniforms(
  dataTexture: THREE.Texture,
  colourmap: Colourmap,
  valueMin: number,
  valueMax: number,
  dataChannel: number = 0
): Record<string, THREE.IUniform<any>> {
  // Pad colourmap to 32 entries to match shader array size
  // Shader expects: uniform vec3 colourmapColors[32];
  const paddedColors: THREE.Vector3[] = []
  for (let i = 0; i < 32; i++) {
    if (i < colourmap.colors.length) {
      paddedColors.push(colourmap.colors[i])
    } else {
      // Pad with the last color repeated
      paddedColors.push(colourmap.colors[colourmap.colors.length - 1])
    }
  }

  return {
    dataTex: { value: dataTexture },
    valueMin: { value: valueMin },
    valueMax: { value: valueMax },
    dataChannel: { value: dataChannel },
    colourmapColors: { value: paddedColors },
    colourmapLength: { value: colourmap.colors.length },
    underflowColor: { value: colourmap.underflowColor },
    overflowColor: { value: colourmap.overflowColor },
  }
}

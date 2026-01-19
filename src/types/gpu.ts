/**
 * GPU resource types for climate simulation rendering.
 * Consolidated from engine/createClimateEngine.ts and util/SimulationOrchestrator.ts.
 */

import * as THREE from 'three';

/**
 * GPU resources needed for climate simulation rendering passes.
 */
export interface GPUResources {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  geometry: THREE.BufferGeometry;
  diffusionMaterial: THREE.ShaderMaterial;
  multiLayerRadiationMaterial: THREE.ShaderMaterial;
  multiLayerHydrologyMaterial: THREE.ShaderMaterial;
  verticalMixingMaterial: THREE.ShaderMaterial;
  blankRenderTarget: THREE.WebGLRenderTarget;
  mesh: THREE.Mesh;
}

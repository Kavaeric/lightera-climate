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
  radiationMaterial: THREE.ShaderMaterial;
  hydrologyMaterial: THREE.ShaderMaterial;
  diffusionMaterial: THREE.ShaderMaterial;
  blankRenderTarget: THREE.WebGLRenderTarget;
  mesh: THREE.Mesh;
}

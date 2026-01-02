import { forwardRef } from 'react';
import * as THREE from 'three';
import { PlanetRenderer } from './PlanetRenderer';

/**
 * Core 3D scene component containing the main geometry and lighting.
 * Renders any geometry and lighting.
 */
export const ClimateScene = forwardRef<THREE.Mesh>(function ClimateScene(
  _props,
  planetMeshRef
) {
  return (
    <>
      {/* Planet mesh */}
      <PlanetRenderer ref={planetMeshRef} />
    </>
  );
});

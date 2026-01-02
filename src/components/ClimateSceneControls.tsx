import * as THREE from 'three';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { PlanetInteraction } from './PlanetInteraction';

interface ClimateSceneControlsProps {
  // Planet interaction
  meshRef: React.RefObject<THREE.Mesh | null>;
  onHoverCell?: (cellIndex: number | null) => void;
  onCellClick?: (cellIndex: number) => void;
}

/**
 * User interaction controls for the 3D scene.
 * Handles camera controls, viewport gizmo, and mouse interaction.
 */
export function ClimateSceneControls({
  meshRef,
  onHoverCell,
  onCellClick,
}: ClimateSceneControlsProps) {
  return (
    <>
      {/* Camera controls */}
      <OrbitControls enablePan={false} />

      {/* Viewport gizmo */}
      <GizmoHelper alignment="top-right" margin={[60, 60]}>
        <GizmoViewport />
      </GizmoHelper>

      {/* Planet mouse interaction */}
      <PlanetInteraction
        meshRef={meshRef}
        onHoverCell={onHoverCell}
        onCellClick={onCellClick}
      />
    </>
  );
}

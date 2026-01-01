import * as THREE from 'three';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { PlanetInteraction } from './PlanetInteraction';
import { TextureGridSimulation } from '../climate/engine/TextureGridSimulation';

interface ClimateSceneControlsProps {
  // Planet interaction
  simulation: TextureGridSimulation;
  meshRef: React.RefObject<THREE.Mesh | null>;
  onHoverCell?: (cellIndex: number | null) => void;
  onCellClick?: (cellIndex: number) => void;
}

/**
 * User interaction controls for the 3D scene.
 * Handles camera controls, viewport gizmo, and mouse interaction.
 */
export function ClimateSceneControls({
  simulation,
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
        simulation={simulation}
        meshRef={meshRef}
        onHoverCell={onHoverCell}
        onCellClick={onCellClick}
      />
    </>
  );
}

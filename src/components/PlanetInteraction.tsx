import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TextureGridSimulation } from '../climate/engine/TextureGridSimulation';
import { uvToCellIndex } from '../climate/engine/grid';

interface PlanetInteractionProps {
  simulation: TextureGridSimulation;
  meshRef: React.RefObject<THREE.Mesh | null>;
  onHoverCell?: (cellIndex: number | null) => void;
  onCellClick?: (cellIndex: number) => void;
}

/**
 * Handles mouse interaction with the planet.
 * Uses raycasting to detect which cell was clicked or hovered, and
 * converts the UV coordinates to cell index.
 */
export function PlanetInteraction({
  simulation,
  meshRef,
  onHoverCell,
  onCellClick,
}: PlanetInteractionProps) {
  const { camera, gl, raycaster } = useThree();
  const pointerRef = useRef(new THREE.Vector2());
  const hoveredCellRef = useRef<number | null>(null);

  // Cache texture dimensions for O(1) UV-to-index conversion
  const textureWidth = simulation.getTextureWidth();
  const textureHeight = simulation.getTextureHeight();

  useEffect(() => {
    const canvas = gl.domElement;

    const handlePointerMove = (event: PointerEvent) => {
      // Convert mouse position to normalized device coordinates (-1 to +1)
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Update hover state
      if (!meshRef.current) return;

      raycaster.setFromCamera(pointerRef.current, camera);
      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0) {
        const intersection = intersects[0];
        const faceIndex = intersection.faceIndex;
        if (faceIndex === undefined || faceIndex === null) return;

        const geometry = meshRef.current.geometry;
        const uvAttribute = geometry.getAttribute('uv');
        const vertexIndex = faceIndex * 3;
        const u = uvAttribute.getX(vertexIndex);
        const v = uvAttribute.getY(vertexIndex);

        // Convert UV coordinates directly to cell index (O(1) lookup)
        const cellIndex = uvToCellIndex(u, v, textureWidth, textureHeight);

        // Validate cell index is within bounds
        if (cellIndex >= 0 && cellIndex < simulation.getCellCount() && cellIndex !== hoveredCellRef.current) {
          hoveredCellRef.current = cellIndex;
          onHoverCell?.(cellIndex);
        }
      } else {
        if (hoveredCellRef.current !== null) {
          hoveredCellRef.current = null;
          onHoverCell?.(null);
        }
      }
    };

    const handleClick = async () => {
      if (!meshRef.current) return;

      // Update raycaster
      raycaster.setFromCamera(pointerRef.current, camera);

      // Check for intersections with the mesh
      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0) {
        const intersection = intersects[0];

        // Get the face that was clicked
        const faceIndex = intersection.faceIndex;
        if (faceIndex === undefined || faceIndex === null) return;

        // Each cell is rendered as multiple triangles (no shared vertices)
        // We need to figure out which cell this face belongs to
        const geometry = meshRef.current.geometry;
        const uvAttribute = geometry.getAttribute('uv');

        // Get UV coordinate from any vertex of the clicked face
        // (all vertices of the same cell have the same UV)
        const vertexIndex = faceIndex * 3; // First vertex of the triangle
        const u = uvAttribute.getX(vertexIndex);
        const v = uvAttribute.getY(vertexIndex);

        // Convert UV coordinates directly to cell index (O(1) lookup)
        const clickedCellIndex = uvToCellIndex(u, v, textureWidth, textureHeight);

        // Validate cell index is within bounds
        if (clickedCellIndex >= 0 && clickedCellIndex < simulation.getCellCount()) {
          // Log to console for debugging
          console.log(`Cell index: ${clickedCellIndex}`);

          // Notify parent component
          onCellClick?.(clickedCellIndex);
        }
      }
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [camera, gl, meshRef, raycaster, simulation, onHoverCell, onCellClick, textureWidth, textureHeight]);

  return null;
}

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { MeshLineGeometry, raycast } from 'meshline';
import { Grid } from '../climate/geometry/geodesic';
import { MeshLineMaterial } from 'meshline';
import { useSimulation } from '../context/useSimulation';

extend({ MeshLineGeometry, MeshLineMaterial });

interface CellOutlineOverlayProps {
  width?: number;
  hoveredCellIndex?: number | null;
  selectedCellIndex?: number | null;
}

/**
 * Renders cell outline overlays on the surface using MeshLine
 * Provides a subtle outline at the exact surface radius to mark selected/hovered cells
 */
export function CellOutlineOverlay({
  width = 8.0,
  hoveredCellIndex = null,
  selectedCellIndex = null,
}: CellOutlineOverlayProps) {
  const { size } = useThree();
  const { activeSimulationConfig, activePlanetaryConfig } = useSimulation();
  const subdivisions = activeSimulationConfig.resolution;
  const radius = activePlanetaryConfig.radius;
  const resolution = useMemo(
    () => new THREE.Vector2(size.width, size.height),
    [size.width, size.height]
  );

  const grid = useMemo(() => new Grid(subdivisions), [subdivisions]);

  // Generate outline points for selected and hovered cells
  const { selectedPoints, hoveredPoints } = useMemo(() => {
    const selected: number[] = [];
    const hovered: number[] = [];

    if (selectedCellIndex !== null && selectedCellIndex >= 0) {
      const cell = Array.from(grid)[selectedCellIndex];
      if (cell?.vertices) {
        // Create closed loop: vertices + first vertex again
        for (let i = 0; i < cell.vertices.length; i++) {
          // Normalize vertex to unit sphere, then scale to radius
          const vertex = cell.vertices[i].clone().normalize().multiplyScalar(radius);
          selected.push(vertex.x, vertex.y, vertex.z);
        }
        // Close the loop
        if (cell.vertices.length > 0) {
          const firstVertex = cell.vertices[0].clone().normalize().multiplyScalar(radius);
          selected.push(firstVertex.x, firstVertex.y, firstVertex.z);
        }
      }
    }

    if (
      hoveredCellIndex !== null &&
      hoveredCellIndex >= 0 &&
      hoveredCellIndex !== selectedCellIndex
    ) {
      const cell = Array.from(grid)[hoveredCellIndex];
      if (cell?.vertices) {
        // Create closed loop: vertices + first vertex again
        for (let i = 0; i < cell.vertices.length; i++) {
          // Normalize vertex to unit sphere, then scale to radius
          const vertex = cell.vertices[i].clone().normalize().multiplyScalar(radius);
          hovered.push(vertex.x, vertex.y, vertex.z);
        }
        // Close the loop
        if (cell.vertices.length > 0) {
          const firstVertex = cell.vertices[0].clone().normalize().multiplyScalar(radius);
          hovered.push(firstVertex.x, firstVertex.y, firstVertex.z);
        }
      }
    }

    return {
      selectedPoints: selected.length > 0 ? selected : null,
      hoveredPoints: hovered.length > 0 ? hovered : null,
    };
  }, [grid, radius, selectedCellIndex, hoveredCellIndex]);

  return (
    <>
      {selectedPoints && (
        <mesh raycast={raycast}>
          <meshLineGeometry attach="geometry" points={selectedPoints} />
          <meshLineMaterial
            lineWidth={width}
            color="white"
            opacity={0.5}
            resolution={resolution}
            sizeAttenuation={0}
            depthTest={false}
            transparent
          />
        </mesh>
      )}
      {hoveredPoints && (
        <mesh raycast={raycast}>
          <meshLineGeometry attach="geometry" points={hoveredPoints} />
          <meshLineMaterial
            lineWidth={width}
            color="white"
            opacity={0.3}
            resolution={resolution}
            sizeAttenuation={0}
            depthTest={false}
            transparent
          />
        </mesh>
      )}
    </>
  );
}

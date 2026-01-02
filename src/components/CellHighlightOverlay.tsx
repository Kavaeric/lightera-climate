import { useMemo, forwardRef } from 'react';
import * as THREE from 'three';
import { Grid } from '../climate/geometry/geodesic';
import { useSimulation } from '../context/useSimulation';
import cellHighlightVertexShader from '../rendering/shaders/utility/cellHighlight.vert?raw';
import cellHighlightFragmentShader from '../rendering/shaders/utility/cellHighlight.frag?raw';

interface CellHighlightOverlayProps {
  offset?: number;
  hoveredCellIndex?: number | null;
  selectedCellIndex?: number | null;
}

/**
 * Renders cell highlighting overlay - generates geometry on-the-fly for selected/hovered cells
 * Decoupled from data visualisation, pure rendering component
 */
export const CellHighlightOverlay = forwardRef<THREE.Group, CellHighlightOverlayProps>(
  function CellHighlightOverlay(
    {
      offset = 0.0,
      hoveredCellIndex = null,
      selectedCellIndex = null,
    },
    ref
  ) {
    const { activeSimulationConfig, activePlanetaryConfig } = useSimulation();
    const subdivisions = activeSimulationConfig.resolution;
    const radius = activePlanetaryConfig.radius + activePlanetaryConfig.atmosphereScaleHeight * 5 + offset;

    const grid = useMemo(() => new Grid(subdivisions), [subdivisions]);

    // Generate geometry for selected and hovered cells
    const { selectedGeometry, hoveredGeometry } = useMemo(() => {
      const selected = new THREE.BufferGeometry();
      const hovered = new THREE.BufferGeometry();

      const cells = Array.from(grid);

      // Helper to create geometry for a cell
      const createCellGeometry = (cellIndex: number): THREE.BufferGeometry | null => {
        const cell = cells[cellIndex];
        if (!cell?.faceTriangles) return null;

        const vertices: number[] = [];
        const normals: number[] = [];

        for (const triangle of cell.faceTriangles) {
          // Vertex A
          const scaledA = triangle.a.clone().normalize().multiplyScalar(radius);
          vertices.push(scaledA.x, scaledA.y, scaledA.z);
          normals.push(triangle.a.x, triangle.a.y, triangle.a.z);

          // Vertex B
          const scaledB = triangle.b.clone().normalize().multiplyScalar(radius);
          vertices.push(scaledB.x, scaledB.y, scaledB.z);
          normals.push(triangle.b.x, triangle.b.y, triangle.b.z);

          // Vertex C
          const scaledC = triangle.c.clone().normalize().multiplyScalar(radius);
          vertices.push(scaledC.x, scaledC.y, scaledC.z);
          normals.push(triangle.c.x, triangle.c.y, triangle.c.z);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        return geometry;
      };

      if (selectedCellIndex !== null && selectedCellIndex >= 0) {
        const geom = createCellGeometry(selectedCellIndex);
        if (geom) Object.assign(selected, geom);
      }

      if (hoveredCellIndex !== null && hoveredCellIndex >= 0 && hoveredCellIndex !== selectedCellIndex) {
        const geom = createCellGeometry(hoveredCellIndex);
        if (geom) Object.assign(hovered, geom);
      }

      return { selectedGeometry: selected, hoveredGeometry: hovered };
    }, [grid, radius, selectedCellIndex, hoveredCellIndex]);

    // Materials for highlighting with Fresnel effect
    const selectedMaterial = useMemo(() => {
      return new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: {
          frontAlpha: { value: 0.2 },
          backAlpha: { value: 0.1 },
        },
        vertexShader: cellHighlightVertexShader,
        fragmentShader: cellHighlightFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      });
    }, []);

    const hoveredMaterial = useMemo(() => {
      return new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.2,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
    }, []);

    return (
      <group ref={ref}>
        {selectedCellIndex !== null && selectedCellIndex >= 0 && (
          <mesh geometry={selectedGeometry} material={selectedMaterial} />
        )}
        {hoveredCellIndex !== null && hoveredCellIndex >= 0 && hoveredCellIndex !== selectedCellIndex && (
          <mesh geometry={hoveredGeometry} material={hoveredMaterial} />
        )}
      </group>
    );
  }
);

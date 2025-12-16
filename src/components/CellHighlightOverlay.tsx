import { useMemo, forwardRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Grid } from '../simulation/geometry/geodesic'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import highlightVertexShader from '../shaders/highlight.vert?raw'
import highlightFragmentShader from '../shaders/highlight.frag?raw'

interface CellHighlightOverlayProps {
  subdivisions: number
  radius: number
  simulation: TextureGridSimulation
  hoveredCellIndex?: number | null
  selectedCellIndex?: number | null
}

/**
 * Renders cell highlighting overlay - separate mesh for hover and selection effects
 * Decoupled from data visualization, allows pure data display in PlanetRenderer
 * Similar to ReferenceGridOverlay pattern with backface fading
 */
export const CellHighlightOverlay = forwardRef<THREE.Mesh, CellHighlightOverlayProps>(
  function CellHighlightOverlay({
    subdivisions,
    radius,
    simulation,
    hoveredCellIndex = null,
    selectedCellIndex = null,
  }, ref) {
    // Generate geometry - identical to planet geometry for perfect alignment
    const geometry = useMemo(() => {
      const grid = new Grid(subdivisions)
      const vertices: number[] = []
      const normals: number[] = []
      const uvs: number[] = []

      const cells = Array.from(grid)
      cells.forEach((cell, cellIndex) => {
        if (!cell.vertices || !cell.faceTriangles) return

        const [cellU, cellV] = simulation.getCellUV(cellIndex)

        for (const triangle of cell.faceTriangles) {
          // Vertex A
          const scaledA = triangle.a.clone().multiplyScalar(radius)
          vertices.push(scaledA.x, scaledA.y, scaledA.z)
          normals.push(triangle.a.x, triangle.a.y, triangle.a.z)
          uvs.push(cellU, cellV)

          // Vertex B
          const scaledB = triangle.b.clone().multiplyScalar(radius)
          vertices.push(scaledB.x, scaledB.y, scaledB.z)
          normals.push(triangle.b.x, triangle.b.y, triangle.b.z)
          uvs.push(cellU, cellV)

          // Vertex C
          const scaledC = triangle.c.clone().multiplyScalar(radius)
          vertices.push(scaledC.x, scaledC.y, scaledC.z)
          normals.push(triangle.c.x, triangle.c.y, triangle.c.z)
          uvs.push(cellU, cellV)
        }
      })

      const bufferGeometry = new THREE.BufferGeometry()
      bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      bufferGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
      bufferGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))

      return bufferGeometry
    }, [subdivisions, radius, simulation])

    // Create shader material for highlighting
    const material = useMemo(() => {
      return new THREE.ShaderMaterial({
        uniforms: {
          highlightThreshold: { value: 0.0005 },
          hoveredCellIndex: { value: -1 },
          selectedCellIndex: { value: -1 },
          textureWidth: { value: simulation.getTextureWidth() },
          textureHeight: { value: simulation.getTextureHeight() },
        },
        vertexShader: highlightVertexShader,
        fragmentShader: highlightFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      })
    }, [simulation])

    // Update cell indices each frame
    useFrame(() => {
      const mesh = (ref as React.RefObject<THREE.Mesh>)?.current
      if (mesh?.material && (mesh.material as THREE.ShaderMaterial).uniforms) {
        const mat = mesh.material as THREE.ShaderMaterial
        mat.uniforms.hoveredCellIndex.value = hoveredCellIndex ?? -1
        mat.uniforms.selectedCellIndex.value = selectedCellIndex ?? -1
      }
    })

    return (
      <mesh ref={ref} geometry={geometry} material={material}>
        {/* Material is already set via shader */}
      </mesh>
    )
  }
)

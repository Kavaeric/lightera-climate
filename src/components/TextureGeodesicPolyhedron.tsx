import { useMemo, forwardRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Grid } from '../util/geodesic'
import { TextureGridSimulation } from '../util/TextureGridSimulation'

// Import shaders
import displayVertexShader from '../shaders/display.vert?raw'
import displayFragmentShader from '../shaders/display.frag?raw'

interface TextureGeodesicPolyhedronProps {
  subdivisions: number
  radius: number
  simulation: TextureGridSimulation
  valueRange?: { min: number; max: number }
  hoveredCellIndex?: number | null
}

/**
 * Geodesic polyhedron that reads colors from a GPU texture
 * Each vertex has a UV coordinate pointing to its cell's pixel in the state texture
 */
export const TextureGeodesicPolyhedron = forwardRef<THREE.Mesh, TextureGeodesicPolyhedronProps>(
  function TextureGeodesicPolyhedron({
    subdivisions,
    radius,
    simulation,
    valueRange = { min: -40, max: 30 },
    hoveredCellIndex = null,
  }, ref) {
    // Generate geometry with UV coordinates mapped to texture
    const geometry = useMemo(() => {
    const grid = new Grid(subdivisions)
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    // Process each cell in the grid
    const cells = Array.from(grid)
    cells.forEach((cell, cellIndex) => {
      if (!cell.vertices || !cell.faceTriangles) return

      // Get UV coordinates for this cell (maps to pixel in texture)
      const [cellU, cellV] = simulation.getCellUV(cellIndex)

      // Add triangles for this cell - NO SHARED VERTICES
      // Each triangle gets its own 3 vertices for per-face coloring
      for (const triangle of cell.faceTriangles) {
        // Vertex A
        const scaledA = triangle.a.clone().multiplyScalar(radius)
        vertices.push(scaledA.x, scaledA.y, scaledA.z)
        normals.push(triangle.a.x, triangle.a.y, triangle.a.z)
        uvs.push(cellU, cellV) // 2D UV coordinates

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

  // Create shader material once
  const material = useMemo(() => {
    // Create Moreland colormap control points
    const morelandColors = [
      new THREE.Vector3(0.23, 0.299, 0.754), // Cool blue at t=0
      new THREE.Vector3(0.483, 0.57, 0.874), // t=0.25
      new THREE.Vector3(0.865, 0.865, 0.865), // Neutral gray at t=0.5
      new THREE.Vector3(0.943, 0.625, 0.472), // t=0.75
      new THREE.Vector3(0.706, 0.016, 0.15), // Warm red at t=1
    ]

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        stateTex: { value: simulation.getCurrentTexture() },
        valueMin: { value: valueRange.min },
        valueMax: { value: valueRange.max },
        morelandColors: { value: morelandColors },
        hoveredCellIndex: { value: -1 },
        textureWidth: { value: simulation.getTextureWidth() },
        textureHeight: { value: simulation.getTextureHeight() },
      },
      vertexShader: displayVertexShader,
      fragmentShader: displayFragmentShader,
    })

    return shaderMaterial
  }, [simulation, valueRange])

    // Update the material's texture reference each frame
    // (needed because simulation swaps between render targets)
    useFrame(() => {
      const mesh = (ref as React.RefObject<THREE.Mesh>)?.current
      if (mesh?.material && (mesh.material as THREE.ShaderMaterial).uniforms) {
        const mat = mesh.material as THREE.ShaderMaterial
        mat.uniforms.stateTex.value = simulation.getCurrentTexture()
        mat.uniforms.hoveredCellIndex.value = hoveredCellIndex ?? -1
      }
    })

    return (
      <mesh ref={ref} geometry={geometry} material={material}>
        {/* Material is already set via shader */}
      </mesh>
    )
  }
)

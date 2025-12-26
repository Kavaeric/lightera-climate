import { useMemo, forwardRef, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Grid } from '../simulation/geometry/geodesic'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import type { DisplayConfig } from '../config/displayConfig'
import { getVisualisationMode } from '../config/visualisationModes'

// Import vertex shader for all visualisations
import visualiseVertexShader from '../shaders/display/visualise.vert?raw'

interface PlanetRendererProps {
  subdivisions: number
  radius: number
  simulation: TextureGridSimulation
  displayConfig: DisplayConfig
  onHoverCell?: (cellIndex: number | null) => void
  onCellClick?: (cellIndex: number) => void
}

/**
 * Renders the 3D planet visualisation with surface temperature data from GPU texture
 * Pure data visualisation component - no interaction or selection logic
 * Highlighting is handled separately by CellHighlightOverlay
 * Each vertex has a UV coordinate pointing to its cell's pixel in the state texture
 */
export const PlanetRenderer = forwardRef<THREE.Mesh, PlanetRendererProps>(
  function PlanetRenderer({
    subdivisions,
    radius,
    simulation,
    displayConfig,
    onHoverCell,
    onCellClick,
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

  // Create shader material with custom fragment shader from visualisation mode
  const material = useMemo(() => {
    // Get visualisation mode configuration
    const mode = getVisualisationMode(displayConfig.visualisationMode)

    if (!mode) {
      throw new Error(`Visualisation mode '${displayConfig.visualisationMode}' not found`)
    }

    // Build uniforms for this visualisation mode
    const shaderUniforms = mode.buildCustomUniforms(simulation, displayConfig)

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: shaderUniforms,
      vertexShader: visualiseVertexShader,
      fragmentShader: mode.customFragmentShader,
    })

    return shaderMaterial
  }, [simulation, displayConfig])

  // Store material ref for useFrame updates
  const materialRef = useRef(material)
  useEffect(() => {
    materialRef.current = material
  }, [material])

  // Update texture uniforms every frame to handle buffer swaps
  // This ensures the visualisation always shows the most recent simulation state
  useFrame(() => {
    const currentMaterial = materialRef.current
    if (!currentMaterial) return

    const uniforms = currentMaterial.uniforms

    // Update standardized data texture uniforms that may change between frames
    if (uniforms.surfaceData) {
      uniforms.surfaceData.value = simulation.getClimateDataCurrent().texture
    }
    if (uniforms.atmosphereData) {
      uniforms.atmosphereData.value = simulation.getAtmosphereDataCurrent().texture
    }
    if (uniforms.hydrologyData) {
      uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture
    }
    if (uniforms.solarFluxData) {
      uniforms.solarFluxData.value = simulation.getSolarFluxTarget().texture
    }
    // terrainData is static and doesn't need updating
  })

  // Helper function to find cell index from UV coordinates
  const findCellIndexFromUV = (u: number, v: number): number => {
    let cellIndex = -1
    let minDist = Infinity

    for (let i = 0; i < simulation.getCellCount(); i++) {
      const [cellU, cellV] = simulation.getCellUV(i)
      const dist = Math.abs(cellU - u) + Math.abs(cellV - v)
      if (dist < minDist) {
        minDist = dist
        cellIndex = i
      }
    }

    return cellIndex
  }

  // Handle pointer move for hover detection
  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!onHoverCell) return

    const intersection = event.intersections?.[0]
    if (!intersection || intersection.faceIndex === undefined || intersection.faceIndex === null) {
      onHoverCell(null)
      return
    }

    const mesh = event.object as THREE.Mesh
    const geometry = mesh.geometry as THREE.BufferGeometry
    const uvAttribute = geometry.getAttribute('uv')
    const vertexIndex = intersection.faceIndex * 3
    const u = uvAttribute.getX(vertexIndex)
    const v = uvAttribute.getY(vertexIndex)

    const cellIndex = findCellIndexFromUV(u, v)
    if (cellIndex >= 0) {
      onHoverCell(cellIndex)
    } else {
      onHoverCell(null)
    }
  }

  // Handle click for cell selection
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onCellClick) return

    const intersection = event.intersections?.[0]
    if (!intersection || intersection.faceIndex === undefined || intersection.faceIndex === null) {
      return
    }

    const mesh = event.object as THREE.Mesh
    const geometry = mesh.geometry as THREE.BufferGeometry
    const uvAttribute = geometry.getAttribute('uv')
    const vertexIndex = intersection.faceIndex * 3
    const u = uvAttribute.getX(vertexIndex)
    const v = uvAttribute.getY(vertexIndex)

    const cellIndex = findCellIndexFromUV(u, v)
    if (cellIndex >= 0) {
      console.log(`Cell index: ${cellIndex}`)
      onCellClick(cellIndex)
    }
  }

  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      {/* Material is already set via shader */}
    </mesh>
  )
  }
)

import { useMemo, forwardRef } from 'react'
import * as THREE from 'three'
import { Grid } from '../simulation/geometry/geodesic'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import type { DisplayConfig } from '../config/displayConfig'
import { getColourmapForMode } from '../config/colourmaps'
import { buildDisplayShaderUniforms } from '../util/ShaderBuilder'

// Import shaders
import displayVertexShader from '../shaders/display.vert?raw'
import displayDataFragmentShader from '../shaders/displayData.frag?raw'

interface PlanetRendererProps {
  subdivisions: number
  radius: number
  simulation: TextureGridSimulation
  displayConfig: DisplayConfig
}

/**
 * Renders the 3D planet visualization with temperature data from GPU texture
 * Pure data visualization component - no interaction or selection logic
 * Highlighting is handled separately by CellHighlightOverlay
 * Each vertex has a UV coordinate pointing to its cell's pixel in the state texture
 */
export const PlanetRenderer = forwardRef<THREE.Mesh, PlanetRendererProps>(
  function PlanetRenderer({
    subdivisions,
    radius,
    simulation,
    displayConfig,
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

  // Create shader material using unified display shader
  const material = useMemo(() => {
    // Determine data source texture, value range, and data channel based on visualization mode
    let sourceTexture: THREE.Texture
    let valueRange: { min: number; max: number }
    let dataChannel: number

    if (displayConfig.visualisationMode === 'temperature') {
      sourceTexture = simulation.getClimateDataTarget(0).texture
      valueRange = displayConfig.temperatureRange
      dataChannel = 0  // Temperature uses red channel
    } else {
      // All other modes use terrain data
      sourceTexture = simulation.terrainData
      switch (displayConfig.visualisationMode) {
        case 'elevation':
          valueRange = displayConfig.elevationRange
          dataChannel = 0  // Elevation in red channel
          break
        case 'waterDepth':
          valueRange = displayConfig.waterDepthRange
          dataChannel = 1  // Water depth in green channel
          break
        case 'salinity':
          valueRange = displayConfig.salinityRange
          dataChannel = 2  // Salinity in blue channel
          break
        case 'albedo':
          // Albedo doesn't have a meaningful range, use placeholder
          valueRange = { min: 0, max: 1 }
          dataChannel = 3  // Albedo in alpha channel
          break
        default:
          valueRange = displayConfig.temperatureRange
          dataChannel = 0
      }
    }

    // Get colourmap for this visualization mode
    const colourmap = getColourmapForMode(displayConfig.visualisationMode)

    // Build shader uniforms from colourmap
    const shaderUniforms = buildDisplayShaderUniforms(
      sourceTexture,
      colourmap,
      valueRange.min,
      valueRange.max,
      dataChannel
    )

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: shaderUniforms,
      vertexShader: displayVertexShader,
      fragmentShader: displayDataFragmentShader,
    })

    return shaderMaterial
  }, [simulation, displayConfig])

    return (
      <mesh ref={ref} geometry={geometry} material={material}>
        {/* Material is already set via shader */}
      </mesh>
    )
  }
)

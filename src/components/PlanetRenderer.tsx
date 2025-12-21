import { useMemo, forwardRef, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Grid } from '../simulation/geometry/geodesic'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import type { DisplayConfig } from '../config/displayConfig'
import { getVisualisationMode } from '../config/visualisationModes'
import { buildDisplayShaderUniforms } from '../util/ShaderBuilder'

// Import shaders
import displayVertexShader from '../shaders/display/display.vert?raw'
import displayFragmentShader from '../shaders/display/display.frag?raw'

interface PlanetRendererProps {
  subdivisions: number
  radius: number
  simulation: TextureGridSimulation
  displayConfig: DisplayConfig
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

  // Create shader material - supports both unified and custom shaders
  const material = useMemo(() => {
    // Get visualisation mode configuration
    const mode = getVisualisationMode(displayConfig.visualisationMode)
    
    if (!mode) {
      throw new Error(`Visualisation mode '${displayConfig.visualisationMode}' not found`)
    }

    let shaderUniforms: Record<string, THREE.IUniform<unknown>>
    let fragmentShader: string

    // Check if mode uses custom shader
    if (mode.customFragmentShader && mode.buildCustomUniforms) {
      // Use custom shader and uniforms
      fragmentShader = mode.customFragmentShader
      shaderUniforms = mode.buildCustomUniforms(simulation, displayConfig)
    } else {
      // Use unified shader (existing behaviour)
      const sourceTexture = mode.getTextureSource(simulation)
      const valueRange = mode.getRange(displayConfig)

      shaderUniforms = buildDisplayShaderUniforms(
        sourceTexture,
        mode.colourmap,
        valueRange.min,
        valueRange.max,
        mode.dataChannel
      )
      fragmentShader = displayFragmentShader
    }

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: shaderUniforms,
      vertexShader: displayVertexShader,
      fragmentShader: fragmentShader,
    })

    return shaderMaterial
  }, [simulation, displayConfig])

  // Store material ref for useFrame updates
  const materialRef = useRef(material)
  useEffect(() => {
    materialRef.current = material
  }, [material])

  // Update texture uniform every frame to handle buffer swaps
  // This ensures the visualisation always shows the most recent simulation state
  useFrame(() => {
    const currentMaterial = materialRef.current
    if (!currentMaterial) return

    const mode = getVisualisationMode(displayConfig.visualisationMode)
    const uniforms = currentMaterial.uniforms

    // Update texture uniform for unified shader
    if (uniforms.dataTex) {
      const currentTexture = mode.getTextureSource(simulation)
      uniforms.dataTex.value = currentTexture
    }

    // Update texture uniforms for custom shaders (e.g., terrainTex, hydrologyTex for terrain mode)
    if (mode.buildCustomUniforms) {
      // Update terrainTex if it exists (for terrain mode)
      if (uniforms.terrainTex) {
        uniforms.terrainTex.value = simulation.terrainData
      }
      // Update hydrologyTex if it exists (for terrain mode) - this changes every frame
      if (uniforms.hydrologyTex) {
        uniforms.hydrologyTex.value = simulation.getHydrologyDataCurrent().texture
      }
    }
  })

    return (
      <mesh ref={ref} geometry={geometry} material={material}>
        {/* Material is already set via shader */}
      </mesh>
    )
  }
)

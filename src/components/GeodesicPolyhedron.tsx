import { useMemo, useRef, useImperativeHandle, forwardRef } from 'react'
import * as THREE from 'three'
import { Grid } from '../util/geodesic'
import { GridSimulation } from '../util/GridSimulation'
import { type ColorMapFunction } from '../util/colorMaps'

interface GeodesicGeometryProps {
  args?: [number?, number?]
  subdivisions?: number
  radius?: number
  flatShading?: boolean
  simulation?: GridSimulation
  colorMap?: ColorMapFunction
  valueRange?: { min: number; max: number }
}

export interface GeodesicGeometryRef {
  updateColors: () => void
}

/**
 * Geodesic geometry component for use inside <mesh>
 * Usage:
 *   <mesh>
 *     <GeodesicGeometry args={[subdivisions, radius, flatShading]} />
 *     <meshStandardMaterial />
 *   </mesh>
 */
export const GeodesicGeometry = forwardRef<GeodesicGeometryRef, GeodesicGeometryProps>(({
  args,
  subdivisions,
  radius,
  simulation,
  colorMap,
  valueRange = { min: 0, max: 1 },
}, ref) => {
  // Support both args array and individual props (R3F pattern)
  const subdivs = args?.[0] ?? subdivisions ?? 8
  const rad = args?.[1] ?? radius ?? 1

  const geometryRef = useRef<THREE.BufferGeometry>(null)

  const geometry = useMemo(() => {
    const grid = new Grid(subdivs)
    const vertices: number[] = []
    const normals: number[] = []
    const colors: number[] = []

    console.log("Grid cell count:", grid.size)

    // Track which triangle belongs to which cell for coloring
    const triangleToCellMap: number[] = []
    let triangleIndex = 0

    // Process each cell in the grid
    const cells = Array.from(grid)
    cells.forEach((cell, cellIndex) => {
      if (!cell.vertices || !cell.faceTriangles) return

      // Add triangles for this cell - NO SHARED VERTICES
      // Each triangle gets its own 3 vertices for per-face coloring
      for (const triangle of cell.faceTriangles) {
        // Vertex A
        const scaledA = triangle.a.clone().multiplyScalar(rad)
        vertices.push(scaledA.x, scaledA.y, scaledA.z)
        normals.push(triangle.a.x, triangle.a.y, triangle.a.z)
        colors.push(1, 1, 1) // Default white

        // Vertex B
        const scaledB = triangle.b.clone().multiplyScalar(rad)
        vertices.push(scaledB.x, scaledB.y, scaledB.z)
        normals.push(triangle.b.x, triangle.b.y, triangle.b.z)
        colors.push(1, 1, 1) // Default white

        // Vertex C
        const scaledC = triangle.c.clone().multiplyScalar(rad)
        vertices.push(scaledC.x, scaledC.y, scaledC.z)
        normals.push(triangle.c.x, triangle.c.y, triangle.c.z)
        colors.push(1, 1, 1) // Default white

        // Track which cell this triangle belongs to
        triangleToCellMap[triangleIndex++] = cellIndex
      }
    })

    const bufferGeometry = new THREE.BufferGeometry()
    bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    bufferGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    bufferGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    // Store the triangle-to-cell mapping on the geometry for later updates
    ;(bufferGeometry as any).triangleToCellMap = triangleToCellMap

    return bufferGeometry
  }, [subdivs, rad])

  // Expose updateColors method to parent
  useImperativeHandle(ref, () => ({
    updateColors: () => {
      if (!simulation || !geometryRef.current) return

      const colorAttr = geometryRef.current.getAttribute('color') as THREE.BufferAttribute
      const triangleToCellMap = (geometryRef.current as any).triangleToCellMap as number[]

      if (!colorAttr || !triangleToCellMap) return

      // Update colors based on simulation values
      // Each triangle has 3 vertices, all get the same color
      for (let triIndex = 0; triIndex < triangleToCellMap.length; triIndex++) {
        const cellIndex = triangleToCellMap[triIndex]
        const rawValue = simulation.getValue(cellIndex)

        // Normalize value from valueRange to [0, 1]
        const normalizedValue = (rawValue - valueRange.min) / (valueRange.max - valueRange.min)

        // Handle overflow/underflow with distinct colors
        let r: number, g: number, b: number
        if (normalizedValue < 0) {
          // Underflow: deep navy blue
          r = 0
          g = 0
          b = 0.2
        } else if (normalizedValue > 1) {
          // Overflow: bright magenta/pink
          r = 1
          g = 0
          b = 1
        } else {
          // Normal range: use color map
          const color = colorMap ? colorMap(normalizedValue) : { r: normalizedValue, g: 0, b: 1 - normalizedValue }
          r = color.r
          g = color.g
          b = color.b
        }

        // Set color for all 3 vertices of this triangle
        const vertexIndex = triIndex * 3
        colorAttr.setXYZ(vertexIndex + 0, r, g, b)
        colorAttr.setXYZ(vertexIndex + 1, r, g, b)
        colorAttr.setXYZ(vertexIndex + 2, r, g, b)
      }

      colorAttr.needsUpdate = true
    }
  }), [simulation, colorMap, valueRange])

  return <primitive object={geometry} ref={geometryRef} />
})

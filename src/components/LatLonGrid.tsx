import { useMemo } from 'react'
import * as THREE from 'three'
import latlonVertexShader from '../shaders/latlon.vert?raw'
import latlonFragmentShader from '../shaders/latlon.frag?raw'

interface LatLonGridProps {
  radius?: number
  latitudeLines?: number  // Number of latitude lines (excluding equator)
  longitudeLines?: number // Number of longitude lines
  color?: string
  lineWidth?: number
  visible?: boolean
  segments?: number
  frontOpacity?: number
  backOpacity?: number // Opacity multiplier for back-facing lines (0-1)
}

/**
 * Component that renders latitude and longitude grid lines on a sphere
 * Can be toggled on/off for debugging or geographic reference
 */
export function LatLonGrid({
  radius = 1.0, // Same radius as sphere
  latitudeLines = 8, // Every 10 degrees
  longitudeLines = 23, // Every 15 degrees
  color = '#ffffff',
  lineWidth = 2,
  visible = true,
  segments = 32,
  frontOpacity = 0.5,
  backOpacity = 0.2,
}: LatLonGridProps) {
  const geometry = useMemo(() => {
    const positions: number[] = []

    // Create latitude lines (circles parallel to equator)
    for (let i = -latitudeLines; i <= latitudeLines; i++) {
      if (i === 0) continue // Skip equator, we'll draw it separately

      const lat = (i / (latitudeLines + 1)) * 90 // Degrees
      const latRad = lat * Math.PI / 180
      const circleRadius = Math.cos(latRad) * radius
      const y = Math.sin(latRad) * radius

      // Draw circle at this latitude as connected line segments
      for (let j = 0; j < segments; j++) {
        const lon1 = (j / segments) * 2 * Math.PI
        const lon2 = ((j + 1) / segments) * 2 * Math.PI

        // First point
        positions.push(
          Math.cos(lon1) * circleRadius,
          y,
          Math.sin(lon1) * circleRadius
        )
        // Second point
        positions.push(
          Math.cos(lon2) * circleRadius,
          y,
          Math.sin(lon2) * circleRadius
        )
      }
    }

    // Draw equator (special case for visibility)
    for (let j = 0; j < segments; j++) {
      const lon1 = (j / segments) * 2 * Math.PI
      const lon2 = ((j + 1) / segments) * 2 * Math.PI

      positions.push(Math.cos(lon1) * radius, 0, Math.sin(lon1) * radius)
      positions.push(Math.cos(lon2) * radius, 0, Math.sin(lon2) * radius)
    }

    // Create longitude lines (meridians from pole to pole)
    for (let i = 0; i < longitudeLines; i++) {
      const lon = (i / longitudeLines) * 360 // Degrees
      const lonRad = lon * Math.PI / 180

      // Draw line from south pole to north pole as connected segments
      for (let j = 0; j < segments; j++) {
        const lat1 = ((j / segments) * 2 - 1) * 90 // -90 to +90 degrees
        const lat2 = (((j + 1) / segments) * 2 - 1) * 90

        const latRad1 = lat1 * Math.PI / 180
        const latRad2 = lat2 * Math.PI / 180

        const circleRadius1 = Math.cos(latRad1) * radius
        const circleRadius2 = Math.cos(latRad2) * radius

        const y1 = Math.sin(latRad1) * radius
        const y2 = Math.sin(latRad2) * radius

        // First point
        positions.push(
          Math.cos(lonRad) * circleRadius1,
          y1,
          Math.sin(lonRad) * circleRadius1
        )
        // Second point
        positions.push(
          Math.cos(lonRad) * circleRadius2,
          y2,
          Math.sin(lonRad) * circleRadius2
        )
      }
    }

    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return lineGeometry
  }, [radius, latitudeLines, longitudeLines, segments])

  const material = useMemo(() => {
    const colorVec = new THREE.Color(color)
    return new THREE.ShaderMaterial({
      vertexShader: latlonVertexShader,
      fragmentShader: latlonFragmentShader,
      uniforms: {
        color: { value: new THREE.Vector3(colorVec.r, colorVec.g, colorVec.b) },
        opacity: { value: frontOpacity },
        backFaceOpacity: { value: backOpacity },
        // cameraPosition is automatically provided by Three.js, no need to declare it
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      linewidth: lineWidth,
    })
  }, [color, lineWidth, frontOpacity, backOpacity])

  if (!visible) return null

  return <lineSegments geometry={geometry} material={material} />
}

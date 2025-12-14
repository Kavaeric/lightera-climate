import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureGridSimulation } from '../util/TextureGridSimulation'

// Import shaders
import fullscreenVertexShader from '../shaders/fullscreen.vert?raw'
import energyBalanceFragmentShader from '../shaders/energyBalance.frag?raw'

interface ClimateSolverProps {
  simulation: TextureGridSimulation
  // Planet parameters
  solarConstant?: number // W/m² (default: 1361 for Earth)
  albedo?: number // 0-1 (default: 0.3)
  subsolarPoint?: { lat: number; lon: number } // degrees (default: 0, 0)
  onSolveComplete?: () => void
}

/**
 * Component that solves the climate simulation using GPU shaders
 * For tidally locked airless world: fills all time samples with identical data
 */
export function ClimateSolver({
  simulation,
  solarConstant = 1361,
  albedo = 0.3,
  subsolarPoint = { lat: 0, lon: 0 },
  onSolveComplete,
}: ClimateSolverProps) {
  const { gl } = useThree()
  const solvedRef = useRef(false)

  useEffect(() => {
    if (solvedRef.current) return

    console.log('ClimateSolver: Starting climate calculation...')
    console.log(`  Solar constant: ${solarConstant} W/m²`)
    console.log(`  Albedo: ${albedo}`)
    console.log(`  Subsolar point: ${subsolarPoint.lat}°, ${subsolarPoint.lon}°`)

    // Create offscreen scene and camera for rendering
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)

    // Create energy balance shader material
    const material = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: energyBalanceFragmentShader,
      uniforms: {
        cellPositions: { value: simulation.cellPositions },
        subsolarPoint: { value: new THREE.Vector2(subsolarPoint.lat, subsolarPoint.lon) },
        solarConstant: { value: solarConstant },
        albedo: { value: albedo },
      },
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Render to all time sample targets
    // For tidally locked world with no axial tilt, all samples are identical
    const prevTarget = gl.getRenderTarget()

    for (let i = 0; i < simulation.getTimeSamples(); i++) {
      const target = simulation.getClimateDataTarget(i)
      gl.setRenderTarget(target)
      gl.clear()
      gl.render(scene, camera)
    }

    gl.setRenderTarget(prevTarget)

    // Clean up
    geometry.dispose()
    material.dispose()
    scene.clear()

    solvedRef.current = true
    console.log('ClimateSolver: Climate calculation complete!')

    onSolveComplete?.()
  }, [gl, simulation, solarConstant, albedo, subsolarPoint, onSolveComplete])

  // This component doesn't render anything visible
  return null
}

import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureGridSimulation } from '../util/TextureGridSimulation'

// Import shaders
import fullscreenVertexShader from '../shaders/fullscreen.vert?raw'
import diffusionFragmentShader from '../shaders/diffusion.frag?raw'
import copyFragmentShader from '../shaders/copy.frag?raw'

interface TextureSimulationRendererProps {
  simulation: TextureGridSimulation
  onTextureUpdate?: () => void
}

/**
 * Component that runs GPU-based simulation using render-to-texture
 * Renders to offscreen framebuffer, not to screen
 */
export function TextureSimulationRenderer({
  simulation,
  onTextureUpdate,
}: TextureSimulationRendererProps) {
  const { gl } = useThree()
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene())
  const cameraRef = useRef<THREE.OrthographicCamera>(
    new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  )
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const initializedRef = useRef(false)

  // Initialize the render-to-texture setup
  useEffect(() => {
    const scene = sceneRef.current

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)

    // Create shader material
    const material = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: diffusionFragmentShader,
      uniforms: {
        stateTex: { value: simulation.getClimateDataCurrent().texture },
        neighbourIndices1: { value: simulation.neighbourIndices1 },
        neighbourIndices2: { value: simulation.neighbourIndices2 },
        neighbourCounts: { value: simulation.neighbourCounts },
        textureWidth: { value: simulation.getTextureWidth() },
        textureHeight: { value: simulation.getTextureHeight() },
        diffusionRate: { value: 0.1 },
      },
    })

    materialRef.current = material

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Initialize render target with copy of initial state texture
    const copyMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: copyFragmentShader,
      uniforms: {
        sourceTex: { value: simulation.getClimateDataCurrent().texture },
      },
    })

    const copyMesh = new THREE.Mesh(geometry, copyMaterial)
    const tempScene = new THREE.Scene()
    tempScene.add(copyMesh)

    const prevTarget = gl.getRenderTarget()
    gl.setRenderTarget(simulation.getClimateDataCurrent())
    gl.clear()
    gl.render(tempScene, cameraRef.current)
    gl.setRenderTarget(prevTarget)

    copyMaterial.dispose()
    tempScene.clear()

    initializedRef.current = true

    return () => {
      geometry.dispose()
      material.dispose()
      scene.clear()
    }
  }, [gl, simulation])

  // Fixed timestep simulation
  const SIMULATION_RATE = 1 / 60 // 60 steps per second
  const accumulatorRef = useRef(0)

  // Run simulation step with fixed timestep
  useFrame((_state, delta) => {
    if (!initializedRef.current || !materialRef.current) return

    const material = materialRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current

    // Accumulate time
    accumulatorRef.current += delta

    // Run fixed timestep updates
    while (accumulatorRef.current >= SIMULATION_RATE) {
      // Read from current buffer, write to next buffer
      const sourceTexture = simulation.getClimateDataCurrent().texture
      material.uniforms.stateTex.value = sourceTexture

      // Render to next buffer
      const prevTarget = gl.getRenderTarget()
      gl.setRenderTarget(simulation.getClimateDataNext())
      gl.clear()
      gl.render(scene, camera)
      gl.setRenderTarget(prevTarget)

      // Swap buffers
      simulation.swapClimateBuffers()

      // Deduct timestep from accumulator
      accumulatorRef.current -= SIMULATION_RATE

      // Notify parent
      onTextureUpdate?.()
    }
  })

  // This component doesn't render anything to the main scene
  return null
}

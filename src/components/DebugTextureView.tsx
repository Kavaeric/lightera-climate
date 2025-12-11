import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureGridSimulation } from '../util/TextureGridSimulation'

interface DebugTextureViewProps {
  simulation: TextureGridSimulation
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  size?: number
}

/**
 * Debug component that displays the raw simulation texture on screen
 */
export function DebugTextureView({
  simulation,
  position = 'bottom-right',
  size = 256,
}: DebugTextureViewProps) {
  const { gl } = useThree()
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene())
  const cameraRef = useRef<THREE.OrthographicCamera>(
    new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  )
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)

  useEffect(() => {
    const scene = sceneRef.current

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2)

    // Simple shader to display the texture
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D stateTex;
        uniform float valueMin;
        uniform float valueMax;
        varying vec2 vUv;

        void main() {
          vec4 state = texture2D(stateTex, vUv);
          float temp = state.r;

          // Normalize to [0, 1] for visualization
          float normalized = (temp - valueMin) / (valueMax - valueMin);

          // Display as grayscale
          gl_FragColor = vec4(vec3(normalized), 1.0);
        }
      `,
      uniforms: {
        stateTex: { value: simulation.getCurrentTexture() },
        valueMin: { value: -40 },
        valueMax: { value: 30 },
      },
    })

    materialRef.current = material

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    return () => {
      geometry.dispose()
      material.dispose()
      scene.clear()
    }
  }, [simulation])

  // Update texture reference each frame and render AFTER main scene
  useFrame(() => {
    if (!materialRef.current) return

    const material = materialRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current

    // Update texture
    material.uniforms.stateTex.value = simulation.getCurrentTexture()

    // Calculate viewport position
    const canvas = gl.domElement
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height

    let x = 0
    let y = 0

    switch (position) {
      case 'top-left':
        x = 0
        y = canvasHeight - size
        break
      case 'top-right':
        x = canvasWidth - size
        y = canvasHeight - size
        break
      case 'bottom-left':
        x = 0
        y = 0
        break
      case 'bottom-right':
        x = canvasWidth - size
        y = 0
        break
    }

    // Save current state
    const prevViewport = gl.getViewport(new THREE.Vector4())
    const prevScissor = gl.getScissor(new THREE.Vector4())
    const prevScissorTest = gl.getScissorTest()

    // Set viewport and render on top of existing frame
    gl.setViewport(x, y, size, size)
    gl.setScissor(x, y, size, size)
    gl.setScissorTest(true)

    // Clear only this viewport's depth buffer
    gl.clear(gl.DEPTH_BUFFER_BIT)

    // Render the debug view
    gl.render(scene, camera)

    // Restore previous state
    gl.setViewport(prevViewport)
    gl.setScissor(prevScissor)
    gl.setScissorTest(prevScissorTest)
  }, 1000) // High priority to render last

  return null
}

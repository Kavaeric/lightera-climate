import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureGridSimulation } from '../util/TextureGridSimulation'

// Import shaders
import fullscreenVertexShader from '../shaders/fullscreen.vert?raw'
import thermalEvolutionFragmentShader from '../shaders/thermalEvolution.frag?raw'

interface ClimateSimulationEngineProps {
  simulation: TextureGridSimulation
  solarFlux?: number
  albedo?: number
  emissivity?: number
  subsolarPoint?: { lat: number; lon: number }
  rotationsPerYear?: number
  cosmicBackgroundTemp?: number
  yearLength?: number
  iterations?: number
  surfaceHeatCapacity?: number
  thermalConductivity?: number
  onSolveComplete?: () => void
}

interface SimState {
  initialized: boolean
  complete: boolean
  scene?: THREE.Scene
  camera?: THREE.OrthographicCamera
  geometry?: THREE.BufferGeometry
  thermalMaterial?: THREE.ShaderMaterial
  tempTarget?: THREE.WebGLRenderTarget
  tempTarget2?: THREE.WebGLRenderTarget
  mesh?: THREE.Mesh
  timeSamples: number
  simStepsPerSample: number
  dt: number
  yearLength: number
  subsolarPoint: { lat: number; lon: number }
  rotationsPerYear: number
  orbitIdx: number
  sampleIdx: number
  simStep: number
  orbitEndState?: THREE.WebGLRenderTarget
  previousSampleState?: THREE.WebGLRenderTarget
  currentSource?: THREE.WebGLRenderTarget
}

/**
 * Component that solves the climate simulation using GPU shaders
 * Runs ~10 steps per frame to maintain responsive UI
 */
export function ClimateSimulationEngine({
  simulation,
  solarFlux = 1361,
  albedo = 0.3,
  emissivity = 1.0,
  subsolarPoint = { lat: 0, lon: 0 },
  rotationsPerYear = 1,
  cosmicBackgroundTemp = 2.7,
  yearLength = 31557600,
  iterations = 1,
  surfaceHeatCapacity = 1e5,
  thermalConductivity = 0.1,
  onSolveComplete,
}: ClimateSimulationEngineProps) {
  const { gl } = useThree()
  const stateRef = useRef<SimState>({
    initialized: false,
    complete: false,
    timeSamples: 0,
    simStepsPerSample: 12,
    dt: 0,
    yearLength,
    subsolarPoint,
    rotationsPerYear,
    orbitIdx: 0,
    sampleIdx: 0,
    simStep: 0,
  })

  // Initialize GPU resources once
  useEffect(() => {
    const state = stateRef.current
    if (state.initialized) return
    state.initialized = true

    console.log('ClimateSolver: Starting physics-based climate calculation...')
    console.log(`  Solar flux: ${solarFlux} W/m²`)
    console.log(`  Albedo: ${albedo}`)
    console.log(`  Iterations: ${iterations}`)

    const timeSamples = simulation.getTimeSamples()
    const timePerSample = yearLength / timeSamples
    const simStepsPerSample = 12
    const dt = timePerSample / simStepsPerSample

    state.timeSamples = timeSamples
    state.simStepsPerSample = simStepsPerSample
    state.dt = dt

    console.log(`  Time per sample: ${timePerSample.toFixed(1)}s`)
    console.log(`  Time-stepping through climate evolution...`)
    console.log(`  Total simulation time: ${(iterations * yearLength / 86400).toFixed(1)} days`)

    // Create scene and materials
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new THREE.PlaneGeometry(2, 2)

    const thermalMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: thermalEvolutionFragmentShader,
      uniforms: {
        previousTemperature: { value: null },
        cellPositions: { value: simulation.cellPositions },
        neighbourIndices1: { value: simulation.neighbourIndices1 },
        neighbourIndices2: { value: simulation.neighbourIndices2 },
        neighbourCounts: { value: simulation.neighbourCounts },
        subsolarPoint: { value: new THREE.Vector2(subsolarPoint.lat, subsolarPoint.lon) },
        solarFlux: { value: solarFlux },
        albedo: { value: albedo },
        emissivity: { value: emissivity },
        surfaceHeatCapacity: { value: surfaceHeatCapacity },
        dt: { value: dt },
        textureWidth: { value: simulation.getTextureWidth() },
        textureHeight: { value: simulation.getTextureHeight() },
        cosmicBackgroundTemp: { value: cosmicBackgroundTemp },
        thermalConductivity: { value: thermalConductivity },
      },
    })

    const mesh = new THREE.Mesh(geometry, thermalMaterial)
    scene.add(mesh)

    const tempTarget = new THREE.WebGLRenderTarget(
      simulation.getTextureWidth(),
      simulation.getTextureHeight(),
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      }
    )

    const tempTarget2 = new THREE.WebGLRenderTarget(
      simulation.getTextureWidth(),
      simulation.getTextureHeight(),
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      }
    )

    // Initialize with cosmic background temperature
    const initMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: `
        precision highp float;
        uniform float initTemp;
        void main() {
          gl_FragColor = vec4(initTemp, 0.0, 0.0, 1.0);
        }
      `,
      uniforms: {
        initTemp: { value: cosmicBackgroundTemp },
      },
    })
    mesh.material = initMaterial
    gl.setRenderTarget(tempTarget)
    gl.render(scene, camera)
    initMaterial.dispose()

    mesh.material = thermalMaterial

    state.scene = scene
    state.camera = camera
    state.geometry = geometry
    state.thermalMaterial = thermalMaterial
    state.tempTarget = tempTarget
    state.tempTarget2 = tempTarget2
    state.mesh = mesh
    state.orbitEndState = tempTarget
    state.previousSampleState = tempTarget
    state.currentSource = tempTarget
  }, [gl, simulation, solarFlux, albedo, emissivity, subsolarPoint, rotationsPerYear, cosmicBackgroundTemp, yearLength, iterations, surfaceHeatCapacity, thermalConductivity])

  // Run simulation in independent animation loop (not Three Fiber's useFrame)
  useEffect(() => {
    if (!stateRef.current.initialized) return

    let animationFrameId: number
    let lastFrameTime = performance.now()
    let frameCount = 0
    let frameTimeSum = 0

    const simulationLoop = () => {
      const state = stateRef.current
      if (state.complete) return

      // Measure frame time for adaptive stepping
      const now = performance.now()
      const frameTime = now - lastFrameTime
      lastFrameTime = now
      frameCount++
      frameTimeSum += frameTime

      // Log average frame time every 60 frames
      if (frameCount % 60 === 0) {
        const avgFrameTime = frameTimeSum / 60
        console.log(`Avg frame time: ${avgFrameTime.toFixed(2)}ms (${(1000 / avgFrameTime).toFixed(1)} fps)`)
        frameTimeSum = 0
      }

      // Use maximum step count per frame - GPU work is trivial, CPU overhead is the bottleneck
      // The shader just does basic math per cell, so we can do thousands of steps per frame
      // This reduces total frames from 11,520 to ~23 frames for a complete simulation
      const stepsPerFrame = Math.max(500, Math.floor(state.timeSamples * state.simStepsPerSample / 2))
      const { scene, camera, geometry, thermalMaterial, tempTarget, tempTarget2, mesh } = state
      if (!scene || !camera || !geometry || !thermalMaterial || !tempTarget || !tempTarget2 || !mesh) {
        animationFrameId = requestAnimationFrame(simulationLoop)
        return
      }

      // Execute stepsPerFrame simulation steps
      for (let step = 0; step < stepsPerFrame; step++) {
        const isLastOrbit = state.orbitIdx === iterations - 1

        // Calculate current state
        const totalSteps = (state.orbitIdx * state.timeSamples * state.simStepsPerSample) +
                          (state.sampleIdx * state.simStepsPerSample) +
                          state.simStep
        const totalTime = totalSteps * state.dt
        const yearProgress = (totalTime % state.yearLength) / state.yearLength
        const rotationDegrees = yearProgress * state.rotationsPerYear * 360
        const currentSubsolarLon = (state.subsolarPoint.lon + rotationDegrees) % 360

        thermalMaterial.uniforms.subsolarPoint.value.set(state.subsolarPoint.lat, currentSubsolarLon)

        // Ping-pong between targets
        const destTarget = state.simStep % 2 === 0 ? tempTarget2 : tempTarget
        thermalMaterial.uniforms.previousTemperature.value = state.currentSource!.texture

        gl.setRenderTarget(destTarget)
        gl.render(scene, camera)
        state.currentSource = destTarget

        // Advance to next step
        state.simStep++

        if (state.simStep >= state.simStepsPerSample) {
          state.simStep = 0

          // For final orbit, save sample
          if (isLastOrbit && state.currentSource) {
            const finalTarget = simulation.getClimateDataTarget(state.sampleIdx)
            gl.setRenderTarget(finalTarget)

            const copyMaterial = new THREE.ShaderMaterial({
              vertexShader: fullscreenVertexShader,
              fragmentShader: `
                precision highp float;
                varying vec2 vUv;
                uniform sampler2D source;
                void main() {
                  gl_FragColor = texture2D(source, vUv);
                }
              `,
              uniforms: { source: { value: state.currentSource.texture } }
            })

            const copyMesh = new THREE.Mesh(geometry, copyMaterial)
            const copyScene = new THREE.Scene()
            copyScene.add(copyMesh)
            gl.render(copyScene, camera)
            copyMaterial.dispose()
            copyScene.clear()
          }

          state.previousSampleState = state.currentSource
          state.sampleIdx++

          if (state.sampleIdx >= state.timeSamples) {
            state.sampleIdx = 0
            state.orbitEndState = state.currentSource

            console.log(`  Orbit ${state.orbitIdx + 1}/${iterations}...`)
            state.orbitIdx++

            if (state.orbitIdx >= iterations) {
              // Done!
              state.complete = true

              if (state.tempTarget2) state.tempTarget2.dispose()
              if (state.geometry) state.geometry.dispose()
              if (state.thermalMaterial) state.thermalMaterial.dispose()
              if (state.tempTarget) state.tempTarget.dispose()
              if (state.scene) state.scene.clear()

              gl.setRenderTarget(null)

              console.log('ClimateSolver: Climate calculation complete!')
              onSolveComplete?.()
              return
            }

            // Reset for next orbit
            state.currentSource = state.orbitEndState
            state.previousSampleState = state.orbitEndState
          } else {
            // Determine source for next sample
            if (state.sampleIdx === 0) {
              state.currentSource = state.orbitEndState
            } else if (isLastOrbit) {
              state.currentSource = simulation.getClimateDataTarget(state.sampleIdx - 1)
            } else {
              state.currentSource = state.previousSampleState
            }
          }
        }
      }

      // Restore render target to canvas (null = render to default framebuffer)
      gl.setRenderTarget(null)

      // Schedule next frame
      animationFrameId = requestAnimationFrame(simulationLoop)
    }

    // Start the simulation loop
    animationFrameId = requestAnimationFrame(simulationLoop)

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [gl, simulation, iterations])

  return null
}

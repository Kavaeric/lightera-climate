import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import type { PlanetConfig } from '../config/planetConfig'
import type { SimulationConfig } from '../config/simulationConfig'

// Import shaders
import fullscreenVertexShader from '../shaders/fullscreen.vert?raw'
import thermalEvolutionFragmentShader from '../shaders/thermalEvolution.frag?raw'

interface ClimateSimulationEngineProps {
  simulation: TextureGridSimulation
  planetConfig: PlanetConfig
  simulationConfig: SimulationConfig
  onSolveComplete?: () => void
}

interface SimState {
  initialized: boolean
  complete: boolean
  scene?: THREE.Scene
  camera?: THREE.OrthographicCamera
  geometry?: THREE.BufferGeometry
  thermalMaterial?: THREE.ShaderMaterial
  mesh?: THREE.Mesh
  timeSamples: number
  physicsStepsPerSample: number  // Physics substeps between saved samples (for numerical stability)
  dt: number
  yearLength: number
  subsolarPoint: { lat: number; lon: number }
  rotationsPerYear: number
  orbitIdx: number
  sampleIdx: number
  physicsStep: number  // Current substep within the current sample
  currentTargetIndex: number  // Index into climateDataTargets for reading previous state
  nextTargetIndex: number  // Index into climateDataTargets for writing next state
}

/**
 * Component that solves the climate simulation using GPU shaders
 * Runs ~10 steps per frame to maintain responsive UI
 */
export function ClimateSimulationEngine({
  simulation,
  planetConfig,
  simulationConfig,
  onSolveComplete,
}: ClimateSimulationEngineProps) {
  const { gl } = useThree()

  // Extract values from config objects for clarity
  const {
    radius,
    solarFlux,
    albedo,
    emissivity,
    subsolarPoint,
    rotationsPerYear,
    cosmicBackgroundTemp,
    yearLength,
    surfaceHeatCapacity,
    axialTilt = 0,
  } = planetConfig

  const { iterations, groundDiffusion: thermalConductivity } = simulationConfig
  const stateRef = useRef<SimState>({
    initialized: false,
    complete: false,
    timeSamples: 0,
    physicsStepsPerSample: 1,
    dt: 0,
    yearLength,
    subsolarPoint,
    rotationsPerYear,
    orbitIdx: 0,
    sampleIdx: 0,
    physicsStep: 0,
    currentTargetIndex: 0,
    nextTargetIndex: 1,
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
    // Use a reasonable default for physics substeps (12 gives good numerical stability)
    // This can be made configurable later if needed
    const physicsStepsPerSample = 12
    const timePerSample = yearLength / timeSamples
    const dt = timePerSample / physicsStepsPerSample

    state.timeSamples = timeSamples
    state.physicsStepsPerSample = physicsStepsPerSample
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
        baseSubsolarPoint: { value: new THREE.Vector2(subsolarPoint.lat, subsolarPoint.lon) },
        axialTilt: { value: axialTilt },
        yearProgress: { value: 0 },
        solarFlux: { value: solarFlux },
        albedo: { value: albedo },
        emissivity: { value: emissivity },
        surfaceHeatCapacity: { value: surfaceHeatCapacity },
        dt: { value: dt },
        textureWidth: { value: simulation.getTextureWidth() },
        textureHeight: { value: simulation.getTextureHeight() },
        cosmicBackgroundTemp: { value: cosmicBackgroundTemp },
        thermalConductivity: { value: thermalConductivity },
        planetRadius: { value: radius },
      },
    })

    const mesh = new THREE.Mesh(geometry, thermalMaterial)
    scene.add(mesh)

    // Initialize first archive target with cosmic background temperature
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
    const firstTarget = simulation.getClimateDataTarget(0)
    gl.setRenderTarget(firstTarget)
    gl.render(scene, camera)
    initMaterial.dispose()

    mesh.material = thermalMaterial

    state.scene = scene
    state.camera = camera
    state.geometry = geometry
    state.thermalMaterial = thermalMaterial
    state.mesh = mesh
    state.currentTargetIndex = 0
    state.nextTargetIndex = 1
  }, [gl, simulation, planetConfig, simulationConfig])

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

      // UI pacing parameter: how many physics steps to compute per animation frame
      // Increase for faster simulation (fewer total frames), decrease for finer progress updates
      // With physics substeps + samples, each frame completes multiple time samples
      const stepsPerFrame = Math.max(500, Math.floor(state.timeSamples * state.physicsStepsPerSample / 2))
      const { scene, camera, geometry, thermalMaterial, mesh } = state
      if (!scene || !camera || !geometry || !thermalMaterial || !mesh) {
        animationFrameId = requestAnimationFrame(simulationLoop)
        return
      }

      // Execute stepsPerFrame physics steps
      for (let step = 0; step < stepsPerFrame; step++) {
        // Calculate current state
        const totalSteps = (state.orbitIdx * state.timeSamples * state.physicsStepsPerSample) +
                          (state.sampleIdx * state.physicsStepsPerSample) +
                          state.physicsStep
        const totalTime = totalSteps * state.dt
        const yearProgress = (totalTime % state.yearLength) / state.yearLength
        const rotationDegrees = yearProgress * state.rotationsPerYear * 360
        const currentSubsolarLon = (state.subsolarPoint.lon + rotationDegrees) % 360

        thermalMaterial.uniforms.baseSubsolarPoint.value.set(state.subsolarPoint.lat, currentSubsolarLon)
        thermalMaterial.uniforms.yearProgress.value = yearProgress

        // Read from current target, write to next target
        const sourceTarget = simulation.getClimateDataTarget(state.currentTargetIndex)
        const destTarget = simulation.getClimateDataTarget(state.nextTargetIndex)

        thermalMaterial.uniforms.previousTemperature.value = sourceTarget.texture

        gl.setRenderTarget(destTarget)
        gl.render(scene, camera)

        // Advance to next physics step
        state.physicsStep++

        // Rotate indices for next step
        state.currentTargetIndex = state.nextTargetIndex
        state.nextTargetIndex = (state.nextTargetIndex + 1) % state.timeSamples

        if (state.physicsStep >= state.physicsStepsPerSample) {
          state.physicsStep = 0
          state.sampleIdx++

          if (state.sampleIdx >= state.timeSamples) {
            state.sampleIdx = 0
            state.orbitIdx++

            console.log(`  Orbit ${state.orbitIdx}/${iterations}...`)

            if (state.orbitIdx >= iterations) {
              // Done!
              state.complete = true

              if (state.geometry) state.geometry.dispose()
              if (state.thermalMaterial) state.thermalMaterial.dispose()
              if (state.scene) state.scene.clear()

              gl.setRenderTarget(null)

              console.log('ClimateSolver: Climate calculation complete!')
              onSolveComplete?.()
              return
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

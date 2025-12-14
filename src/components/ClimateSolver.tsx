import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureGridSimulation } from '../util/TextureGridSimulation'

// Import shaders
import fullscreenVertexShader from '../shaders/fullscreen.vert?raw'
import thermalEvolutionFragmentShader from '../shaders/thermalEvolution.frag?raw'

interface ClimateSolverProps {
  simulation: TextureGridSimulation
  // Planet parameters
  solarFlux?: number // W/m² - solar flux at planet's orbital distance (default: 1361 for Earth)
  albedo?: number // 0-1 (default: 0.3)
  emissivity?: number // 0-1 - thermal emissivity (default: 1.0 for perfect blackbody)
  subsolarPoint?: { lat: number; lon: number } // degrees (default: 0, 0) - initial subsolar point
  rotationsPerYear?: number // number of rotations per orbital period (default: 1 = tidally locked)
  cosmicBackgroundTemp?: number // K (default: 2.7)
  yearLength?: number // seconds (default: Earth's 31557600s)
  spinupOrbits?: number // number of orbits to simulate (default: 1)
  surfaceHeatCapacity?: number // J/(m²·K) (default: 1e5 for rock)
  thermalConductivity?: number // W/(m·K) - lateral heat conduction (default: 0.1)
  onSolveComplete?: () => void
}

/**
 * Component that solves the climate simulation using GPU shaders
 * Uses physics-based time-stepping to evolve temperatures with proper thermal inertia
 */
export function ClimateSolver({
  simulation,
  solarFlux = 1361,
  albedo = 0.3,
  emissivity = 1.0,
  subsolarPoint = { lat: 0, lon: 0 },
  rotationsPerYear = 1,
  cosmicBackgroundTemp = 2.7,
  yearLength = 31557600,
  spinupOrbits = 1,
  surfaceHeatCapacity = 1e5,
  thermalConductivity = 0.1,
  onSolveComplete,
}: ClimateSolverProps) {
  const { gl } = useThree()
  const solvedRef = useRef(false)

  useEffect(() => {
    if (solvedRef.current) return

    console.log('ClimateSolver: Starting physics-based climate calculation...')
    console.log(`  Solar flux: ${solarFlux} W/m²`)
    console.log(`  Albedo: ${albedo}`)
    console.log(`  Emissivity: ${emissivity}`)
    console.log(`  Initial subsolar point: ${subsolarPoint.lat}°, ${subsolarPoint.lon}°`)
    console.log(`  Rotations per year: ${rotationsPerYear}`)
    console.log(`  Year length: ${yearLength}s (${(yearLength / 86400).toFixed(1)} days)`)
    console.log(`  Spin-up orbits: ${spinupOrbits}`)
    console.log(`  Surface heat capacity: ${surfaceHeatCapacity} J/(m²·K)`)
    console.log(`  Thermal conductivity: ${thermalConductivity} W/(m·K)`)

    // Calculate timestep with simulation stepping for stability
    const timeSamples = simulation.getTimeSamples()
    const timePerSample = yearLength / timeSamples // seconds per saved sample (for final orbit)

    // Use a fixed number of simulation steps per sample for consistent accuracy regardless of year length
    // This ensures that total physics steps = timeSamples * simStepsPerSample is constant
    const simStepsPerSample = 12 // Fixed number of physics steps between each sample
    const dt = timePerSample / simStepsPerSample // Calculated timestep

    console.log(`  Time per sample: ${timePerSample.toFixed(1)}s (${(timePerSample / 3600).toFixed(2)} hours)`)
    console.log(`  Physics timestep: ${dt.toFixed(1)}s (${(dt / 3600).toFixed(4)} hours)`)
    console.log(`  Sim steps per sample: ${simStepsPerSample}`)

    // Create offscreen scene and camera for rendering
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new THREE.PlaneGeometry(2, 2)

    // Create thermal evolution shader material
    const thermalMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: thermalEvolutionFragmentShader,
      uniforms: {
        previousTemperature: { value: null }, // Will be set per timestep
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

    // Create temporary render target for ping-pong buffering
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

    const prevTarget = gl.getRenderTarget()

    // Initialize with cosmic background temperature as starting condition
    // Create a simple initialization shader
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

    // Switch back to thermal evolution material
    mesh.material = thermalMaterial

    console.log('ClimateSolver: Time-stepping through climate evolution...')
    console.log(`  Total simulation time: ${(spinupOrbits * yearLength / 86400).toFixed(1)} days`)

    // Additional temp target for simulation stepping ping-pong
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

    // Track the state at the end of each orbit for continuity between orbits
    let orbitEndState = tempTarget // Start with initial conditions

    // Run for multiple orbits to reach thermal equilibrium
    // Only the final orbit's samples are saved
    for (let orbitIdx = 0; orbitIdx < spinupOrbits; orbitIdx++) {
      const isLastOrbit = orbitIdx === spinupOrbits - 1
      console.log(`  Orbit ${orbitIdx + 1}/${spinupOrbits}...`)

      // Track the previous sample's end state within this orbit
      let previousSampleState = orbitEndState

      // Time-step through the year
      for (let sampleIdx = 0; sampleIdx < timeSamples; sampleIdx++) {
        // Starting state for this sample
        let currentSource
        if (sampleIdx === 0) {
          // First sample of each orbit: use end state from previous orbit
          currentSource = orbitEndState
        } else if (isLastOrbit) {
          // Final orbit: read from permanent storage
          currentSource = simulation.getClimateDataTarget(sampleIdx - 1)
        } else {
          // Intermediate orbits: use tracked previous sample state
          currentSource = previousSampleState
        }

        // Take multiple simulation steps to advance to next sample
        for (let simStep = 0; simStep < simStepsPerSample; simStep++) {
          // Calculate time within total simulation for this simulation step
          const totalSteps = (orbitIdx * timeSamples * simStepsPerSample) + (sampleIdx * simStepsPerSample) + simStep
          const totalTime = totalSteps * dt
          const yearProgress = (totalTime % yearLength) / yearLength
          const rotationDegrees = yearProgress * rotationsPerYear * 360
          const currentSubsolarLon = (subsolarPoint.lon + rotationDegrees) % 360

          // Update subsolar point uniform
          thermalMaterial.uniforms.subsolarPoint.value.set(subsolarPoint.lat, currentSubsolarLon)

          // Determine destination target
          let destTarget
          const isFinalSimStep = isLastOrbit && simStep === simStepsPerSample - 1

          if (isFinalSimStep) {
            // Last simulation step of final orbit: save to sample storage
            // Always use a temp target first to avoid feedback loops
            destTarget = simStep % 2 === 0 ? tempTarget2 : tempTarget
          } else {
            // Intermediate steps: ping-pong between temp targets
            destTarget = simStep % 2 === 0 ? tempTarget2 : tempTarget
          }

          thermalMaterial.uniforms.previousTemperature.value = currentSource.texture

          // Render physics step
          gl.setRenderTarget(destTarget)
          gl.render(scene, camera)

          // Update source for next simulation step
          currentSource = destTarget
        }

        // For final orbit, copy the last computed state to sample storage
        if (isLastOrbit) {
          // currentSource now holds the final state of this sample
          const finalTarget = simulation.getClimateDataTarget(sampleIdx)

          // Copy from currentSource to finalTarget using a simple blit
          gl.setRenderTarget(finalTarget)

          // Use a simple copy shader material
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
            uniforms: { source: { value: currentSource.texture } }
          })

          const copyMesh = new THREE.Mesh(geometry, copyMaterial)
          const copyScene = new THREE.Scene()
          copyScene.add(copyMesh)
          gl.render(copyScene, camera)
          copyMaterial.dispose()
          copyScene.clear()
        }

        // After finishing this sample, currentSource holds the final state
        // Save it for the next sample (and potentially next orbit)
        previousSampleState = currentSource
        if (sampleIdx === timeSamples - 1) {
          orbitEndState = currentSource
        }

        // Progress reporting (only for final orbit)
        if (isLastOrbit && sampleIdx % Math.floor(timeSamples / 10) === 0) {
          console.log(`    Sample progress: ${Math.floor((sampleIdx / timeSamples) * 100)}%`)
        }
      }
    }

    tempTarget2.dispose()

    gl.setRenderTarget(prevTarget)

    // Clean up
    geometry.dispose()
    thermalMaterial.dispose()
    tempTarget.dispose()
    scene.clear()

    solvedRef.current = true
    console.log('ClimateSolver: Climate calculation complete!')

    onSolveComplete?.()
  }, [gl, simulation, solarFlux, albedo, emissivity, subsolarPoint, rotationsPerYear, cosmicBackgroundTemp, yearLength, spinupOrbits, surfaceHeatCapacity, thermalConductivity, onSolveComplete])

  // This component doesn't render anything visible
  return null
}

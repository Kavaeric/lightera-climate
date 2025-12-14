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
  solarConstant?: number // W/m² (default: 1361 for Earth)
  albedo?: number // 0-1 (default: 0.3)
  subsolarPoint?: { lat: number; lon: number } // degrees (default: 0, 0) - initial subsolar point
  rotationsPerYear?: number // number of rotations per orbital period (default: 1 = tidally locked)
  cosmicBackgroundTemp?: number // K (default: 2.7)
  yearLength?: number // seconds (default: Earth's 31557600s)
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
  solarConstant = 1361,
  albedo = 0.3,
  subsolarPoint = { lat: 0, lon: 0 },
  rotationsPerYear = 1,
  cosmicBackgroundTemp = 2.7,
  yearLength = 31557600,
  surfaceHeatCapacity = 1e5,
  thermalConductivity = 0.1,
  onSolveComplete,
}: ClimateSolverProps) {
  const { gl } = useThree()
  const solvedRef = useRef(false)

  useEffect(() => {
    if (solvedRef.current) return

    console.log('ClimateSolver: Starting physics-based climate calculation...')
    console.log(`  Solar constant: ${solarConstant} W/m²`)
    console.log(`  Albedo: ${albedo}`)
    console.log(`  Initial subsolar point: ${subsolarPoint.lat}°, ${subsolarPoint.lon}°`)
    console.log(`  Rotations per year: ${rotationsPerYear}`)
    console.log(`  Year length: ${yearLength}s`)
    console.log(`  Surface heat capacity: ${surfaceHeatCapacity} J/(m²·K)`)
    console.log(`  Thermal conductivity: ${thermalConductivity} W/(m·K)`)

    // Calculate timestep with sub-stepping for stability
    const timeSamples = simulation.getTimeSamples()
    const timePerSample = yearLength / timeSamples // seconds per saved sample

    // For stability, we need dt small relative to thermal timescale
    // Thermal timescale ≈ C / (4 * σ * T³) for blackbody cooling
    // For T~300K: timescale ≈ 1e5 / (4 * 5.67e-8 * 27e6) ≈ 1600s
    // Use dt = 1 hour (3600s) for good stability
    const dt = 3600 // 1 hour timestep
    const subStepsPerSample = Math.ceil(timePerSample / dt)

    console.log(`  Time per sample: ${timePerSample.toFixed(1)}s (${(timePerSample / 3600).toFixed(2)} hours)`)
    console.log(`  Physics timestep: ${dt}s (${(dt / 3600).toFixed(2)} hours)`)
    console.log(`  Sub-steps per sample: ${subStepsPerSample}`)

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
        solarConstant: { value: solarConstant },
        albedo: { value: albedo },
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

    // Additional temp target for sub-stepping ping-pong
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

    // Time-step through the year
    for (let sampleIdx = 0; sampleIdx < timeSamples; sampleIdx++) {
      // Starting state for this sample
      let currentSource = sampleIdx === 0 ? tempTarget : simulation.getClimateDataTarget(sampleIdx - 1)

      // Take multiple sub-steps to advance to next sample
      for (let subStep = 0; subStep < subStepsPerSample; subStep++) {
        // Calculate time within year for this sub-step
        const totalSteps = sampleIdx * subStepsPerSample + subStep
        const yearProgress = (totalSteps * dt) / yearLength
        const rotationDegrees = yearProgress * rotationsPerYear * 360
        const currentSubsolarLon = (subsolarPoint.lon + rotationDegrees) % 360

        // Update subsolar point uniform
        thermalMaterial.uniforms.subsolarPoint.value.set(subsolarPoint.lat, currentSubsolarLon)

        // Ping-pong between temp targets for sub-stepping
        const destTarget = subStep === subStepsPerSample - 1
          ? simulation.getClimateDataTarget(sampleIdx)  // Last sub-step saves to actual sample
          : (subStep % 2 === 0 ? tempTarget2 : tempTarget)

        thermalMaterial.uniforms.previousTemperature.value = currentSource.texture

        // Render physics step
        gl.setRenderTarget(destTarget)
        gl.render(scene, camera)

        // Update source for next sub-step
        currentSource = destTarget
      }

      // Progress reporting
      if (sampleIdx % Math.floor(timeSamples / 10) === 0) {
        console.log(`  Progress: ${Math.floor((sampleIdx / timeSamples) * 100)}%`)
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
  }, [gl, simulation, solarConstant, albedo, subsolarPoint, rotationsPerYear, cosmicBackgroundTemp, yearLength, surfaceHeatCapacity, thermalConductivity, onSolveComplete])

  // This component doesn't render anything visible
  return null
}

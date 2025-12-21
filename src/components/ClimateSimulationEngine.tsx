import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import { SimulationOrchestrator } from '../util/SimulationOrchestrator'
import { SimulationRecorder } from '../util/SimulationRecorder'
import type { PlanetConfig } from '../config/planetConfig'
import type { SimulationConfig } from '../config/simulationConfig'
import { DEFAULT_ATMOSPHERE_CONFIG } from '../config/atmosphereConfig'
import { useSimulation } from '../context/useSimulation'

// Import shaders
import fullscreenVertexShader from '../shaders/fullscreen.vert?raw'
import surfaceEvolutionFragmentShader from '../shaders/climate/surfaceEvolution.frag?raw'
import hydrologyEvolutionFragmentShader from '../shaders/climate/hydrologyEvolution.frag?raw'
import atmosphereEvolutionFragmentShader from '../shaders/climate/atmosphereEvolution.frag?raw'

interface ClimateSimulationEngineProps {
  simulation: TextureGridSimulation
  planetConfig: PlanetConfig
  simulationConfig: SimulationConfig
  stepsPerFrame: number
  samplesPerOrbit: number
  onSolveComplete?: () => void
}

interface GPUResources {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  geometry: THREE.BufferGeometry
  hydrologyMaterial: THREE.ShaderMaterial
  atmosphereMaterial: THREE.ShaderMaterial
  surfaceMaterial: THREE.ShaderMaterial
  blankRenderTarget: THREE.WebGLRenderTarget
  mesh: THREE.Mesh
}

/**
 * Validates that GPU resources were created successfully
 * This is a lightweight check - actual validation happens during first render
 */
function validateGPUResources(
  gl: THREE.WebGLRenderer,
  resources: GPUResources
): void {
  // Check that materials were created
  if (!resources.hydrologyMaterial || !resources.atmosphereMaterial || !resources.surfaceMaterial) {
    throw new Error('GPU materials were not created')
  }

  // Check that shader programs will compile (lightweight check)
  const glContext = gl.getContext()

  // Clear any existing errors
  while (glContext.getError() !== glContext.NO_ERROR) {
    // Drain error queue
  }

  // Force shader compilation
  gl.compile(resources.scene, resources.camera)

  // Check for compilation errors
  const error = glContext.getError()
  if (error !== glContext.NO_ERROR) {
    console.warn(`WebGL warning during shader compilation: ${error}`)
    // Don't throw - this may be a false positive
  }
}

/**
 * Component that manages the climate simulation
 * Uses SimulationOrchestrator for control flow and SimulationExecutor for physics
 */
export function ClimateSimulationEngine({
  simulation,
  planetConfig,
  simulationConfig,
  stepsPerFrame,
  samplesPerOrbit,
  onSolveComplete,
}: ClimateSimulationEngineProps) {
  const { gl } = useThree()
  const {
    simulationKey,
    registerOrchestrator,
    registerRecorder,
    setError,
    pause,
  } = useSimulation()

  const orchestratorRef = useRef<SimulationOrchestrator | null>(null)
  const gpuResourcesRef = useRef<GPUResources | null>(null)
  const recorderRef = useRef<SimulationRecorder | null>(null)

  // Extract values from config objects
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
    groundConductivity,
    atmosphereConfig,
  } = planetConfig

  const { stepsPerOrbit } = simulationConfig
  const thermalConductivity = groundConductivity

  // Use DEFAULT_ATMOSPHERE_CONFIG as fallback when atmosphereConfig is not provided
  const activeAtmosphere = atmosphereConfig || DEFAULT_ATMOSPHERE_CONFIG

  // Extract atmosphere composition values
  // Calculate total pressure (sum of all partial pressures in Pascals)
  const totalPressure = Object.values(activeAtmosphere.composition).reduce((sum, pressure) => sum + pressure, 0)

  // Convert CO2 partial pressure to ppm (parts per million)
  const co2Content = (activeAtmosphere.composition.CO2 / totalPressure) * 1e6 // ppm
  const h2oContent = activeAtmosphere.composition.H2O || 0 // kg/m² (will be 0 initially, evolves during simulation)

  // Mass absorption coefficients (m²/kg)
  // Tuned so Earth atmosphere (400 ppm CO2, 101325 Pa) gives realistic greenhouse effect
  // For Earth: CO2 column mass ≈ 6 kg/m², τ ≈ 1.0 → σ_CO2 ≈ 0.17 m²/kg
  const co2AbsorptionCoeff = 0.17 // m²/kg
  const h2oAbsorptionCoeff = 0.3  // m²/kg (stronger absorber)

  // Initialise GPU resources and orchestrator once per simulationKey
  useEffect(() => {
    console.log('ClimateSimulationEngine: Initialising...')
    console.log(`  Solar flux: ${solarFlux} W/m²`)
    console.log(`  Albedo: ${albedo}`)
    console.log(`  Steps per orbit: ${stepsPerOrbit}`)

    const dt = yearLength / stepsPerOrbit
    console.log(`  Timestep: ${dt.toFixed(1)}s`)

    // Error handler for GPU operations
    const handleGPUError = (error: Error) => {
      console.error('[ClimateSimulationEngine] GPU error:', error)
      setError(error)
      pause()
    }

    try {

    // Create scene and materials
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new THREE.PlaneGeometry(2, 2)

    // Create blank render target for texture uniforms
    const blankRenderTarget = new THREE.WebGLRenderTarget(
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
    const blankTexture = blankRenderTarget.texture

    // Create hydrology material
    const hydrologyMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: hydrologyEvolutionFragmentShader,
      uniforms: {
        previousHydrology: { value: blankTexture },
        currentTemperature: { value: blankTexture },
        atmosphereData: { value: blankTexture },
        terrainData: { value: simulation.terrainData },
      },
    })

    // Create atmosphere material
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: atmosphereEvolutionFragmentShader,
      uniforms: {
        previousAtmosphere: { value: blankTexture },
        previousSurfaceData: { value: blankTexture },
        cellPositions: { value: simulation.cellPositions },
        terrainData: { value: simulation.terrainData },
        neighbourIndices1: { value: simulation.neighbourIndices1 },
        neighbourIndices2: { value: simulation.neighbourIndices2 },
        totalPressure: { value: totalPressure }, // Pa (total atmospheric pressure)
        co2Content: { value: co2Content }, // ppm (from atmosphereConfig)
        h2oContent: { value: h2oContent }, // kg/m² (from atmosphereConfig, typically 0 initially)
        co2AbsorptionCoeff: { value: co2AbsorptionCoeff }, // m²/kg mass absorption coefficient
        h2oAbsorptionCoeff: { value: h2oAbsorptionCoeff }, // m²/kg mass absorption coefficient
        solarFlux: { value: solarFlux },
        emissivity: { value: emissivity },
        dt: { value: dt },
        yearProgress: { value: 0 },
        baseSubsolarPoint: { value: new THREE.Vector2(subsolarPoint.lat, subsolarPoint.lon) },
        axialTilt: { value: axialTilt },
        atmosphereEmissivity: { value: 1.0 },
        atmosphericDiffusion: { value: thermalConductivity * 10.0 }, // W/(m·K) - scale up for atmosphere
      },
    })

    // Create combined surface/thermal material
    const surfaceMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: surfaceEvolutionFragmentShader,
      uniforms: {
        previousSurfaceData: { value: blankTexture },
        cellPositions: { value: simulation.cellPositions },
        neighbourIndices1: { value: simulation.neighbourIndices1 },
        neighbourIndices2: { value: simulation.neighbourIndices2 },
        neighbourCounts: { value: simulation.neighbourCounts },
        terrainData: { value: simulation.terrainData },
        hydrologyData: { value: blankTexture },
        atmosphereData: { value: blankTexture },
        baseSubsolarPoint: { value: new THREE.Vector2(subsolarPoint.lat, subsolarPoint.lon) },
        axialTilt: { value: axialTilt },
        yearProgress: { value: 0 },
        solarFlux: { value: solarFlux },
        emissivity: { value: emissivity },
        atmosEmissivity: { value: 1.0 },
        surfaceHeatCapacity: { value: surfaceHeatCapacity },
        dt: { value: dt },
        textureWidth: { value: simulation.getTextureWidth() },
        textureHeight: { value: simulation.getTextureHeight() },
        cosmicBackgroundTemp: { value: cosmicBackgroundTemp },
        thermalConductivity: { value: thermalConductivity },
        planetRadius: { value: radius },
      },
    })

    // Create initialisation material
    // Initialise both surface temperature (R) and albedo (G) channels
    const initMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: `
        precision highp float;
        uniform float initTemp;
        uniform float initAlbedo;
        void main() {
          gl_FragColor = vec4(initTemp, initAlbedo, 0.0, 0.0);
        }
      `,
      uniforms: {
        initTemp: { value: cosmicBackgroundTemp },
        initAlbedo: { value: albedo },
      },
    })

    // Create mesh
    const mesh = new THREE.Mesh(geometry, initMaterial)
    mesh.frustumCulled = false
    scene.add(mesh)

    // Initialise first climate target
    const firstTarget = simulation.getClimateDataCurrent()
    gl.setRenderTarget(firstTarget)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    // Initialise hydrology render targets
    const hydrologyInitMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: `
        precision highp float;
        uniform sampler2D sourceTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(sourceTexture, vUv);
        }
      `,
      uniforms: {
        sourceTexture: { value: simulation.createInitialHydrologyTexture() },
      },
    })

    mesh.material = hydrologyInitMaterial
    gl.setRenderTarget(simulation.getHydrologyDataCurrent())
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    hydrologyInitMaterial.dispose()

    // Surface data (temperature + albedo) is already initialised above with initMaterial
    // No separate surface initialisation needed - it's computed in the combined shader

    // Initialise atmosphere render targets with same temperature as surface to avoid initial shock
    // The atmosphere will equilibrate to its own temperature based on solar absorption and IR loss
    const initAtmosphereTemp = cosmicBackgroundTemp
    const atmosphereInitMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: `
        precision highp float;
        uniform float initTemp;
        uniform float initPressure;
        void main() {
          gl_FragColor = vec4(initTemp, initPressure, 0.0, 0.0);
        }
      `,
      uniforms: {
        initTemp: { value: initAtmosphereTemp },
        initPressure: { value: totalPressure },
      },
    })

    mesh.material = atmosphereInitMaterial
    // Initialise BOTH atmosphere buffers to avoid reading garbage on first frame
    gl.setRenderTarget(simulation.getAtmosphereDataCurrent())
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    gl.setRenderTarget(simulation.getAtmosphereDataNext())
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    atmosphereInitMaterial.dispose()

    // Dispose init material
    initMaterial.dispose()

    // Store GPU resources
    gpuResourcesRef.current = {
      scene,
      camera,
      geometry,
      hydrologyMaterial,
      atmosphereMaterial,
      surfaceMaterial,
      blankRenderTarget,
      mesh,
    }

    // Validate GPU resources were created successfully
    // This happens AFTER all textures are initialised
    console.log('ClimateSimulationEngine: Validating GPU resources...')
    validateGPUResources(gl, gpuResourcesRef.current)
    console.log('ClimateSimulationEngine: GPU resources validated successfully')

    // Create orchestrator
    const orchestrator = new SimulationOrchestrator({
      dt,
      yearLength,
      subsolarPoint,
      rotationsPerYear,
      stepsPerOrbit,
    }, handleGPUError)

    orchestratorRef.current = orchestrator
    registerOrchestrator(orchestrator)

    // Create simulation recorder
    const recorder = new SimulationRecorder(
      {
        samplesPerOrbit,
        stepsPerOrbit,
      },
      simulation,
      gl
    )
    recorderRef.current = recorder
    registerRecorder(recorder)
    
    // Reset recorder when simulation starts (in case of reuse)
    recorder.reset()

    // Cleanup
    return () => {
      registerOrchestrator(null)
      registerRecorder(null)
      if (gpuResourcesRef.current) {
        gpuResourcesRef.current.geometry.dispose()
        gpuResourcesRef.current.hydrologyMaterial.dispose()
        gpuResourcesRef.current.atmosphereMaterial.dispose()
        gpuResourcesRef.current.surfaceMaterial.dispose()
        gpuResourcesRef.current.blankRenderTarget.dispose()
        gpuResourcesRef.current.scene.clear()
      }
      if (recorderRef.current) {
        recorderRef.current.dispose()
      }
      gpuResourcesRef.current = null
      orchestratorRef.current = null
      recorderRef.current = null
    }
    } catch (error) {
      console.error('[ClimateSimulationEngine] Initialization failed:', error)
      handleGPUError(error instanceof Error ? error : new Error(String(error)))

      // Cleanup on error
      return () => {
        registerOrchestrator(null)
        registerRecorder(null)
        if (recorderRef.current) {
          recorderRef.current.dispose()
        }
        gpuResourcesRef.current = null
        orchestratorRef.current = null
        recorderRef.current = null
      }
    }
  }, [
    gl,
    simulation,
    planetConfig,
    simulationConfig,
    simulationKey,
    onSolveComplete,
    registerOrchestrator,
    registerRecorder,
    solarFlux,
    albedo,
    stepsPerOrbit,
    samplesPerOrbit,
    yearLength,
    subsolarPoint,
    rotationsPerYear,
    cosmicBackgroundTemp,
    surfaceHeatCapacity,
    axialTilt,
    thermalConductivity,
    radius,
    emissivity,
    totalPressure,
    co2Content,
    h2oContent,
    co2AbsorptionCoeff,
    h2oAbsorptionCoeff,
    setError,
    pause,
  ])

  // WebGL context loss handling
  useEffect(() => {
    const canvas = gl.domElement

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      console.error('[ClimateSimulationEngine] WebGL context lost')
      pause()
      setError(new Error('WebGL context lost. The GPU may be under heavy load or the browser tab was backgrounded for too long.'))
    }

    const handleContextRestored = () => {
      console.log('[ClimateSimulationEngine] WebGL context restored')
      // Context restored, but we need to reinitialise - increment simulationKey to trigger recreation
      setError(new Error('WebGL context was restored. Please create a new simulation.'))
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
    }
  }, [gl, pause, setError])

  // Simulation loop
  useEffect(() => {
    const orchestrator = orchestratorRef.current
    const gpuResources = gpuResourcesRef.current

    if (!orchestrator || !gpuResources) return

    let animationFrameId: number

    const simulationLoop = () => {
      const executor = orchestrator.getExecutor()
      const progress = orchestrator.getProgress()
      const recorder = recorderRef.current

      // Handle pending steps (requested via stepOnce() or step())
      const pendingSteps = orchestrator.getPendingSteps()
      if (pendingSteps > 0) {
        // Execute pending steps one at a time so recorder can track each step
        for (let i = 0; i < pendingSteps; i++) {
          const success = executor.renderStep(gl, simulation, {
            hydrologyMaterial: gpuResources.hydrologyMaterial,
            atmosphereMaterial: gpuResources.atmosphereMaterial,
            surfaceMaterial: gpuResources.surfaceMaterial,
          }, gpuResources.mesh, gpuResources.scene, gpuResources.camera)
          if (!success) {
            break
          }
          orchestrator.step(1)
          // Notify recorder after each step
          if (recorder) {
            const stepProgress = orchestrator.getProgress()
            recorder.onPhysicsStep(stepProgress.physicsStep, stepProgress.orbitIdx)
          }
        }
      }

      // Handle continuous running
      if (progress.controlState === 'running') {
        // Execute multiple steps per frame for performance
        for (let i = 0; i < stepsPerFrame; i++) {
          const success = executor.renderStep(gl, simulation, {
            hydrologyMaterial: gpuResources.hydrologyMaterial,
            atmosphereMaterial: gpuResources.atmosphereMaterial,
            surfaceMaterial: gpuResources.surfaceMaterial,
          }, gpuResources.mesh, gpuResources.scene, gpuResources.camera)
          if (!success) {
            // Stop execution on error
            break
          }
          orchestrator.step(1)
          // Notify recorder after each step
          if (recorder) {
            const stepProgress = orchestrator.getProgress()
            recorder.onPhysicsStep(stepProgress.physicsStep, stepProgress.orbitIdx)
          }
        }
      }

      // Restore render target to canvas
      gl.setRenderTarget(null)

      // Schedule next frame
      animationFrameId = requestAnimationFrame(simulationLoop)
    }

    // Start loop
    animationFrameId = requestAnimationFrame(simulationLoop)

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [gl, simulation, stepsPerFrame])

  return null
}

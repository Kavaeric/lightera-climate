import * as THREE from 'three'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import { SimulationOrchestrator } from '../util/SimulationOrchestrator'
import { SimulationRecorder } from '../util/SimulationRecorder'
import type { OrbitalConfig } from '../config/orbital'
import { calculateMeanMolecularMass, calculateAtmosphereHeatCapacity, type PlanetaryConfig } from '../config/planetary'
import type { SimulationConfig } from '../config/simulationConfig'
import { PHYSICS_CONSTANTS } from '../config/physics'
import { createMultiGasKDistributionTexture, createWavelengthBinWidthTexture } from '../util/createGasTextures'
import { createPlanckLookupTexture, getPlanckLookupConfig } from '../util/createPlanckLookupTexture'
import { createDryTransmissionTexture, getDryTransmissionConfig } from '../util/createDryTransmissionTexture'

// Import shaders (includes are processed automatically by vite-plugin-glsl)
// Note: Import without ?raw to allow plugin to process #include directives
import fullscreenVertexShader from '../shaders/fullscreen.vert'
import shortwaveIncidentFragmentShader from '../climate/pass/01-shortwave-incident/shortwaveIncident.frag'
import longwaveRadiationFragmentShader from '../climate/pass/02-longwave-radiation/longwaveRadiation.frag'

interface GPUResources {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  geometry: THREE.BufferGeometry
  shortwaveIncidentMaterial: THREE.ShaderMaterial
  longwaveRadiationMaterial: THREE.ShaderMaterial
  blankRenderTarget: THREE.WebGLRenderTarget
  mesh: THREE.Mesh
}

export interface ClimateEngineConfig {
  gl: THREE.WebGLRenderer
  simulation: TextureGridSimulation
  orbitalConfig: OrbitalConfig
  planetaryConfig: PlanetaryConfig
  simulationConfig: SimulationConfig
  stepsPerFrame: number
  samplesPerOrbit: number
  registerOrchestrator: (orchestrator: SimulationOrchestrator | null) => void
  registerRecorder: (recorder: SimulationRecorder | null) => void
  onError: () => void
}

/**
 * Validates that GPU resources were created successfully
 * This is a lightweight check; actual validation happens during first render
 */
function validateGPUResources(
  gl: THREE.WebGLRenderer,
  resources: GPUResources
): void {
  // Check that materials were created
  if (!resources.shortwaveIncidentMaterial || !resources.longwaveRadiationMaterial) {
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
 * Creates and initialises the climate simulation engine
 * Returns a cleanup function to dispose of resources
 */
export function createClimateEngine(config: ClimateEngineConfig): () => void {
  const {
    gl,
    simulation,
    orbitalConfig,
    planetaryConfig,
    simulationConfig,
    stepsPerFrame,
    samplesPerOrbit,
    registerOrchestrator,
    registerRecorder,
    onError,
  } = config

  const { yearLength, rotationsPerYear, solarFlux, axialTilt } = orbitalConfig
  const { stepsPerOrbit } = simulationConfig

  console.log('ClimateEngine: Initialising...')
  console.log(`  Solar flux: ${solarFlux} W/m²`)
  console.log(`  Steps per orbit: ${stepsPerOrbit}`)

  const dt = yearLength / stepsPerOrbit
  console.log(`  Timestep: ${dt.toFixed(1)}s`)

  // Error handler for GPU operations
  const handleGPUError = (error: Error) => {
    console.error('[ClimateEngine] GPU error:', error)
    onError()
  }

  let gpuResources: GPUResources | null = null
  let orchestrator: SimulationOrchestrator | null = null
  let recorder: SimulationRecorder | null = null
  let animationFrameId: number | null = null

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

    // Create shortwave heating material (Pass 1 - combined solar flux + surface incident)
    const shortwaveIncidentMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: shortwaveIncidentFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        cellInformation: { value: simulation.cellInformation },
        surfaceData: { value: null }, // Will be set each frame
        atmosphereData: { value: null }, // Will be set each frame
        terrainData: { value: simulation.terrainData },
        // Orbital parameters
        axialTilt: { value: axialTilt },
        yearProgress: { value: 0 },
        subsolarLon: { value: 0 }, // Starts at prime meridian
        solarFlux: { value: solarFlux },
        // Physics parameters
        dt: { value: dt },
      },
    })

    // Create multi-gas k-distribution texture for atmospheric radiative transfer
    // Note: This is kept for backwards compatibility but the hybrid approach uses
    // pre-computed dry transmission + reduced H2O textures instead
    const multiGasKDistributionTexture = createMultiGasKDistributionTexture()
    const wavelengthBinWidthTexture = createWavelengthBinWidthTexture()

    // Create Planck lookup table for optimised radiative transfer (uses pre-computed data)
    const planckLookupTexture = createPlanckLookupTexture()
    const planckConfig = getPlanckLookupConfig()

    // Calculate atmospheric properties from gas composition
    const meanMolecularMass = calculateMeanMolecularMass(planetaryConfig)
    const atmosphereHeatCapacity = calculateAtmosphereHeatCapacity(planetaryConfig)
    console.log(`  Mean molecular mass: ${(meanMolecularMass * 6.022e23 * 1000).toFixed(2)} g/mol`)
    console.log(`  Atmosphere heat capacity: ${atmosphereHeatCapacity.toExponential(3)} J/(m²·K)`)

    // Create dry transmission lookup texture (pre-computed for CO2, CH4, N2O, O3)
    // This must be created after meanMolecularMass is calculated
    const dryTransmissionTexture = createDryTransmissionTexture({
      surfacePressure: planetaryConfig.surfacePressure || 101325,
      surfaceGravity: planetaryConfig.surfaceGravity,
      meanMolecularMass: meanMolecularMass,
      gasConcentrations: {
        co2: planetaryConfig.co2Concentration || 420e-6,
        ch4: planetaryConfig.ch4Concentration || 1.9e-6,
        n2o: planetaryConfig.n2oConcentration || 0.335e-6,
        o3: planetaryConfig.o3Concentration || 0.04e-6,
      },
    })
    const dryTransmissionConfig = getDryTransmissionConfig()

    // Create longwave radiation material (Pass 3)
    // Combined pass handling surface emission, atmospheric absorption, and back-radiation
    // Uses hybrid transmission approach: pre-computed dry gases + per-cell H2O
    const longwaveRadiationMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: longwaveRadiationFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        cellInformation: { value: simulation.cellInformation },
        surfaceData: { value: null }, // Will be set to working buffer texture each frame
        atmosphereData: { value: null }, // Will be set to working buffer texture each frame
        terrainData: { value: simulation.terrainData },
        dt: { value: dt },

        // === LEGACY RADIATIVE TRANSFER UNIFORMS ===
        // Kept for backwards compatibility with calculateMultiGasTransmission()
        multiGasKDistributionTexture: { value: multiGasKDistributionTexture },
        wavelengthBinWidthTexture: { value: wavelengthBinWidthTexture },
        planckLookupTexture: { value: planckLookupTexture },
        planckTempMin: { value: planckConfig.tempMin },
        planckTempMax: { value: planckConfig.tempMax },

        // === HYBRID TRANSMISSION UNIFORMS (OPTIMISED) ===
        // Dry gas transmission lookup (pre-computed for CO2, CH4, N2O, O3)
        dryTransmissionTexture: { value: dryTransmissionTexture },
        dryTransmissionTempMin: { value: dryTransmissionConfig.tempMin },
        dryTransmissionTempMax: { value: dryTransmissionConfig.tempMax },

        // === ATMOSPHERIC PROPERTIES ===
        surfacePressure: { value: planetaryConfig.surfacePressure || 101325 },
        surfaceGravity: { value: planetaryConfig.surfaceGravity },
        meanMolecularMass: { value: meanMolecularMass },
        atmosphereHeatCapacity: { value: atmosphereHeatCapacity },
      },
    })

    // Create initialisation material
    // Initialise thermal surface texture: RGBA = [temperature, -, -, albedo]
    const initMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: `
        precision highp float;
        uniform float initTemp;
        uniform float initAlbedo;
        void main() {
          gl_FragColor = vec4(initTemp, 0.0, 0.0, initAlbedo);
        }
      `,
      uniforms: {
        initTemp: { value: PHYSICS_CONSTANTS.COSMIC_BACKGROUND_TEMP },
        initAlbedo: { value: 0.15 }, // Default albedo
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
    // Thermal atmosphere texture: RGBA = [temperature, -, -, albedo]
    const initAtmosphereTemp = PHYSICS_CONSTANTS.COSMIC_BACKGROUND_TEMP
    const atmosphereInitMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: `
        precision highp float;
        uniform float initTemp;
        uniform float initAlbedo;
        void main() {
          gl_FragColor = vec4(initTemp, 0.0, 0.0, initAlbedo);
        }
      `,
      uniforms: {
        initTemp: { value: initAtmosphereTemp },
        initAlbedo: { value: 0.0 }, // Atmosphere starts with no albedo (no cloud cover)
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
    gpuResources = {
      scene,
      camera,
      geometry,
      shortwaveIncidentMaterial,
      longwaveRadiationMaterial,
      blankRenderTarget,
      mesh,
    }

    // Validate GPU resources were created successfully
    console.log('ClimateEngine: Validating GPU resources...')
    validateGPUResources(gl, gpuResources)
    console.log('ClimateEngine: GPU resources validated successfully')

    // Create orchestrator
    orchestrator = new SimulationOrchestrator(
      {
        dt,
        yearLength,
        rotationsPerYear,
        stepsPerOrbit,
      },
      handleGPUError
    )

    registerOrchestrator(orchestrator)

    // Create simulation recorder
    recorder = new SimulationRecorder(
      {
        samplesPerOrbit,
        stepsPerOrbit,
      },
      simulation,
      gl
    )
    registerRecorder(recorder)

    // Reset recorder when simulation starts (in case of reuse)
    recorder.reset()

    // Register recorder with orchestrator to receive step notifications
    orchestrator.onStep((physicsStep, orbitIdx) => {
      recorder!.onPhysicsStep(physicsStep, orbitIdx)
    })

    // Start simulation loop
    const simulationLoop = () => {
      // Execute simulation frame - orchestrator handles all control flow
      orchestrator!.tick(stepsPerFrame, gl, simulation, gpuResources!)

      // Restore render target to canvas
      gl.setRenderTarget(null)

      // Schedule next frame
      animationFrameId = requestAnimationFrame(simulationLoop)
    }

    // Start loop
    animationFrameId = requestAnimationFrame(simulationLoop)

    console.log('ClimateEngine: Initialisation complete')
  } catch (error) {
    console.error('[ClimateEngine] Initialisation failed:', error)
    handleGPUError(error instanceof Error ? error : new Error(String(error)))
  }

  // Return cleanup function
  return () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
    }

    registerOrchestrator(null)
    registerRecorder(null)

    if (gpuResources) {
      gpuResources.geometry.dispose()
      gpuResources.shortwaveIncidentMaterial.dispose()
      gpuResources.longwaveRadiationMaterial.dispose()
      gpuResources.blankRenderTarget.dispose()
      gpuResources.scene.clear()
    }

    if (recorder) {
      recorder.dispose()
    }

    gpuResources = null
    orchestrator = null
    recorder = null
    animationFrameId = null
  }
}

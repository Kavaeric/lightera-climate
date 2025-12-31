import * as THREE from 'three'
import { TextureGridSimulation } from './TextureGridSimulation'
import { SimulationOrchestrator } from './SimulationOrchestrator'
import { SimulationRecorder } from './SimulationRecorder'
import type { OrbitalConfig } from '../../config/orbitalConfig'
import { PHYSICS_CONSTANTS, type PlanetaryConfig } from '../../config/planetaryConfig'
import { calculateMeanMolecularMass, calculateAtmosphereHeatCapacity } from '../atmosphereCalculations'
import type { SimulationConfig } from '../../config/simulationConfig'
import { createDryTransmissionTexture, getDryTransmissionConfig } from '../../data/textures/createDryTransmissionTexture'
import type { GPUResources } from '../../types/gpu'

// Import shaders (includes are processed automatically by vite-plugin-glsl)
// Importing without ?raw allows Vite to process #include directives.
import fullscreenVertexShader from '../../rendering/shaders/utility/fullscreen.vert'
import radiationFragmentShader from '../passes/01-radiation/radiation.frag'
import hydrologyFragmentShader from '../passes/02-hydrology/hydrology.frag'

export interface ClimateEngineConfig {
  gl: THREE.WebGLRenderer
  simulation: TextureGridSimulation
  orbitalConfig: OrbitalConfig
  planetaryConfig: PlanetaryConfig
  simulationConfig: SimulationConfig
  getStepsPerFrame: () => number
  samplesPerOrbit: number
  registerOrchestrator: (orchestrator: SimulationOrchestrator | null) => void
  registerRecorder: (recorder: SimulationRecorder | null) => void
  onError: () => void
}

/**
 * Validates that GPU resources were created successfully.
 * This is a lightweight check; actual validation happens during first render.
 */
function validateGPUResources(
  gl: THREE.WebGLRenderer,
  resources: GPUResources
): void {
  // Check that materials were created
  if (!resources.radiationMaterial
   || !resources.hydrologyMaterial) {
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
 * Creates and initialises the climate simulation engine.
 * Returns a cleanup function to dispose of resources
 */
export function createClimateEngine(config: ClimateEngineConfig): () => void {
  const {
    gl,
    simulation,
    orbitalConfig,
    planetaryConfig,
    simulationConfig,
    getStepsPerFrame,
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

    // Calculate atmospheric properties from gas composition
    const meanMolecularMass = calculateMeanMolecularMass(planetaryConfig)
    const atmosphereHeatCapacity = calculateAtmosphereHeatCapacity(planetaryConfig)
    console.log(`  Mean molecular mass: ${(meanMolecularMass * 6.022e23 * 1000).toFixed(2)} g/mol`)
    console.log(`  Atmosphere heat capacity: ${atmosphereHeatCapacity.toExponential(3)} J/(m²·K)`)

    // Create dry transmission lookup texture (pre-computed for CO2, CH4, N2O, O3, CO, SO2, HCl, HF)
    // This must be created after meanMolecularMass is calculated
    // Gas concentrations default to 0 if not specified in config
    if (planetaryConfig.surfacePressure === undefined) {
      console.warn('[Climate Engine] surfacePressure not specified in planetary config, atmospheric transmission will be disabled')
    }
    const dryTransmissionTexture = createDryTransmissionTexture({
      surfacePressure: planetaryConfig.surfacePressure ?? 0,
      surfaceGravity: planetaryConfig.surfaceGravity,
      meanMolecularMass: meanMolecularMass,
      gasConcentrations: {
        co2: planetaryConfig.co2Concentration ?? 0,
        ch4: planetaryConfig.ch4Concentration ?? 0,
        n2o: planetaryConfig.n2oConcentration ?? 0,
        o3: planetaryConfig.o3Concentration ?? 0,
        co: planetaryConfig.coConcentration ?? 0,
        so2: planetaryConfig.so2Concentration ?? 0,
        hcl: planetaryConfig.hclConcentration ?? 0,
        hf: planetaryConfig.hfConcentration ?? 0,
      },
    })
    const dryTransmissionConfig = getDryTransmissionConfig()

    // Create merged radiation material (Pass 1 - combined shortwave + longwave)
    // Handles both solar heating and greenhouse effect in a single pass
    // Uses hybrid transmission approach: pre-computed dry gases + per-cell H2O
    const radiationMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: radiationFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        cellInformation: { value: simulation.cellInformation },
        surfaceData: { value: null }, // Will be set each frame
        atmosphereData: { value: null }, // Will be set each frame
        hydrologyData: { value: null }, // Will be set each frame (for surface thermal properties)
        terrainData: { value: simulation.terrainData },
        // Orbital parameters (for shortwave)
        axialTilt: { value: axialTilt },
        yearProgress: { value: 0 },
        subsolarLon: { value: 0 }, // Starts at prime meridian
        solarFlux: { value: solarFlux },
        // Physics parameters
        dt: { value: dt },
        // === ATMOSPHERIC TRANSMISSION UNIFORMS (for longwave) ===
        // Dry gas transmission lookup (pre-computed for CO2, CH4, N2O, O3)
        dryTransmissionTexture: { value: dryTransmissionTexture },
        dryTransmissionTempMin: { value: dryTransmissionConfig.tempMin },
        dryTransmissionTempMax: { value: dryTransmissionConfig.tempMax },
        // === ATMOSPHERIC PROPERTIES (for longwave) ===
        surfacePressure: { value: planetaryConfig.surfacePressure || 101325 },
        surfaceGravity: { value: planetaryConfig.surfaceGravity },
        meanMolecularMass: { value: meanMolecularMass },
        atmosphereHeatCapacity: { value: atmosphereHeatCapacity },
      },
    })

    // Create hydrology material (Pass 3)
    // Handles water cycle dynamics: evaporation, precipitation, ice formation
    // Uses MRT to output both hydrology state and auxiliary water state
    const hydrologyMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: hydrologyFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        cellInformation: { value: simulation.cellInformation },
        surfaceData: { value: null }, // Will be set each frame
        hydrologyData: { value: null }, // Will be set each frame
        terrainData: { value: simulation.terrainData },
        atmosphereData: { value: null }, // Will be set each frame
        auxiliaryData: { value: null }, // Will be set each frame (to preserve solar flux)
        dt: { value: dt },
      },
    })

    // Create mesh (material will be set below during initialisation)
    const mesh = new THREE.Mesh(geometry)
    mesh.frustumCulled = false
    scene.add(mesh)

    // Initialise hydrology render targets first (needed for surface albedo calculation)
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

    // Initialise surface texture: RGBA = [temperature, -, -, albedo]
    // Albedo is calculated based on initial hydrology state (water/ice coverage)
    const surfaceInitMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: `
        precision highp float;
        uniform float initTemp;
        uniform sampler2D hydrologyData;

        // Material albedo constants (must match constants.glsl)
        const float MATERIAL_ROCK_ALBEDO_VISIBLE = 0.15;
        const float MATERIAL_WATER_ALBEDO_VISIBLE = 0.06;
        const float MATERIAL_ICE_ALBEDO_VISIBLE = 0.70;

        varying vec2 vUv;

        void main() {
          // Read hydrology state to determine surface albedo
          vec4 hydrology = texture2D(hydrologyData, vUv);
          float waterDepth = hydrology.r;
          float iceThickness = hydrology.g;

          // Calculate effective albedo (same logic as getEffectiveAlbedo in surfaceThermal.glsl)
          float hasWater = step(0.001, waterDepth);
          float hasIce = step(0.001, iceThickness);

          float albedo = MATERIAL_ROCK_ALBEDO_VISIBLE;
          albedo = mix(albedo, MATERIAL_WATER_ALBEDO_VISIBLE, hasWater);
          albedo = mix(albedo, MATERIAL_ICE_ALBEDO_VISIBLE, hasIce);

          gl_FragColor = vec4(initTemp, 0.0, 0.0, albedo);
        }
      `,
      uniforms: {
        initTemp: { value: PHYSICS_CONSTANTS.COSMIC_BACKGROUND_TEMP },
        hydrologyData: { value: simulation.getHydrologyDataCurrent().texture },
      },
    })

    mesh.material = surfaceInitMaterial
    gl.setRenderTarget(simulation.getClimateDataCurrent())
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    surfaceInitMaterial.dispose()

    // Initialise atmosphere render targets with same temperature as surface to avoid initial shock
    // The atmosphere will equilibrate to its own temperature based on solar absorption and IR loss
    // Atmosphere texture: RGBA = [temperature, pressure, precipitableWater, albedo]
    const initAtmosphereTemp = PHYSICS_CONSTANTS.COSMIC_BACKGROUND_TEMP
    const initAtmospherePressure = planetaryConfig.surfacePressure ?? 101325 // Pa
    const initPrecipitableWater = 0.0 // mm (completely dry atmosphere initially)
    const atmosphereInitMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: `
        precision highp float;
        uniform float initTemp;
        uniform float initPressure;
        uniform float initPrecipitableWater;
        uniform float initAlbedo;
        void main() {
          gl_FragColor = vec4(initTemp, initPressure, initPrecipitableWater, initAlbedo);
        }
      `,
      uniforms: {
        initTemp: { value: initAtmosphereTemp },
        initPressure: { value: initAtmospherePressure },
        initPrecipitableWater: { value: initPrecipitableWater },
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

    // Store GPU resources
    gpuResources = {
      scene,
      camera,
      geometry,
      radiationMaterial,
      hydrologyMaterial,
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
      orchestrator!.tick(getStepsPerFrame(), gl, simulation, gpuResources!)

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
      gpuResources.radiationMaterial.dispose()
      gpuResources.hydrologyMaterial.dispose()
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

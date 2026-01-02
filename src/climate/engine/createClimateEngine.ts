import * as THREE from 'three';
import { TextureGridSimulation } from './TextureGridSimulation';
import { SimulationOrchestrator } from './SimulationOrchestrator';
import { SimulationRecorder } from './SimulationRecorder';
import type { OrbitalConfig } from '../../config/orbitalConfig';
import { type PlanetaryConfig } from '../../config/planetaryConfig';
import {
  calculateMeanMolecularMass,
  calculateAtmosphereHeatCapacity,
} from '../atmosphereCalculations';
import type { SimulationConfig } from '../../config/simulationConfig';
import {
  createDryTransmissionTexture,
  getDryTransmissionConfig,
} from '../../data/textures/createDryTransmissionTexture';
import type { GPUResources } from '../../types/gpu';
import { TerrainDataLoader } from '../../terrain/TerrainDataLoader';

// Import shaders (includes are processed automatically by vite-plugin-glsl)
// Importing without ?raw allows Vite to process #include directives.
import fullscreenVertexShader from '../../rendering/shaders/utility/fullscreen.vert';
import initialisationFragmentShader from '../passes/00-initialisation/initialisation.frag';
import radiationFragmentShader from '../passes/01-radiation/radiation.frag';
import hydrologyFragmentShader from '../passes/02-hydrology/hydrology.frag';
import diffusionFragmentShader from '../passes/03-diffusion/diffusion.frag';

export interface ClimateEngineConfig {
  gl: THREE.WebGLRenderer;
  orbitalConfig: OrbitalConfig;
  planetaryConfig: PlanetaryConfig;
  simulationConfig: SimulationConfig;
  getStepsPerFrame: () => number;
  samplesPerOrbit: number;
  registerOrchestrator: (orchestrator: SimulationOrchestrator | null) => void;
  registerRecorder: (recorder: SimulationRecorder | null) => void;
  onError: () => void;
}

/**
 * Validates that GPU resources were created successfully.
 * This is a lightweight check; actual validation happens during first render.
 */
function validateGPUResources(gl: THREE.WebGLRenderer, resources: GPUResources): void {
  // Check that materials were created
  if (
    !resources.radiationMaterial ||
    !resources.hydrologyMaterial ||
    !resources.diffusionMaterial
  ) {
    throw new Error('GPU materials were not created');
  }

  // Check that shader programs will compile (lightweight check)
  const glContext = gl.getContext();

  // Clear any existing errors
  while (glContext.getError() !== glContext.NO_ERROR) {
    // Drain error queue
  }

  // Force shader compilation
  gl.compile(resources.scene, resources.camera);

  // Check for compilation errors
  const error = glContext.getError();
  if (error !== glContext.NO_ERROR) {
    console.warn(`WebGL warning during shader compilation: ${error}`);
    // Don't throw, may be a false positive
  }
}

/**
 * Creates and initialises the climate simulation engine.
 * Handles simulation creation, terrain loading, and engine initialization.
 * Returns the simulation instance and a cleanup function to dispose of resources.
 */
export async function createClimateEngine(
  config: ClimateEngineConfig
): Promise<{ simulation: TextureGridSimulation; cleanup: () => void }> {
  const {
    gl,
    orbitalConfig,
    planetaryConfig,
    simulationConfig,
    getStepsPerFrame,
    samplesPerOrbit,
    registerOrchestrator,
    registerRecorder,
    onError,
  } = config;

  console.log('[ClimateEngine] Creating simulation...');

  // Create simulation
  const simulation = new TextureGridSimulation(simulationConfig);

  // Load terrain data
  console.log('[ClimateEngine] Loading terrain...');
  const terrainLoader = new TerrainDataLoader();
  const cellCount = simulation.getCellCount();

  // Get cell lat/lons
  const cellLatLons: Array<{ lat: number; lon: number }> = [];
  for (let i = 0; i < cellCount; i++) {
    cellLatLons.push(simulation.getCellLatLon(i));
  }

  // Load Earth terrain from Blue Marble Next Generation heightmaps
  // Use Vite's BASE_URL to handle different deployment paths
  const baseUrl = import.meta.env.BASE_URL;
  const terrain = await terrainLoader.loadEarthTerrain(
    `${baseUrl}earth/Earth_Height_8192.png`,
    cellCount,
    cellLatLons,
    {
      bitDepth: 16, // Use 16-bit precision for high-precision heightmaps
    }
  );
  simulation.setTerrainData(terrain);

  console.log('[ClimateEngine] Terrain loaded successfully');

  const { yearLength, rotationsPerYear, solarFlux, axialTilt } = orbitalConfig;
  const { stepsPerOrbit } = simulationConfig;

  console.log('[ClimateEngine] Initialising...');
  console.log(`  Solar flux: ${solarFlux} W/m²`);
  console.log(`  Steps per orbit: ${stepsPerOrbit}`);

  const dt = yearLength / stepsPerOrbit;
  // Format dt as hours, minutes, seconds
  const dtSeconds = Math.round(dt);
  const stepHours = Math.floor(dtSeconds / 3600);
  const stepMinutes = Math.floor((dtSeconds % 3600) / 60);
  const stepSeconds = (dtSeconds % 60).toFixed(1);
  console.log(
    `  Timestep: ${
      stepHours > 0 ? `${stepHours}h ` : ''
    }${stepMinutes > 0 ? `${stepMinutes}m ` : ''}${stepSeconds}s`
  );

  // Error handler for GPU operations
  const handleGPUError = (error: Error) => {
    console.error('[ClimateEngine] GPU error:', error);
    onError();
  };

  let gpuResources: GPUResources | null = null;
  let orchestrator: SimulationOrchestrator | null = null;
  let recorder: SimulationRecorder | null = null;
  let animationFrameId: number | null = null;

  try {
    // Create scene and materials
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

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
    );

    // Calculate atmospheric properties from gas composition
    const meanMolecularMass = calculateMeanMolecularMass(planetaryConfig);
    const atmosphereHeatCapacity = calculateAtmosphereHeatCapacity(planetaryConfig);
    console.log(`  Atmospheric mean molecular mass: ${(meanMolecularMass * 6.022e23 * 1000).toFixed(2)} g/mol`);
    console.log(`  Atmosphere heat capacity: ${atmosphereHeatCapacity.toExponential(3)} J/(m²·K)`);

    // Create dry transmission lookup texture (pre-computed for CO2, CH4, N2O, O3, CO, SO2, HCl, HF)
    // This must be created after meanMolecularMass is calculated
    // Gas concentrations default to 0 if not specified in config
    if (planetaryConfig.surfacePressure === undefined) {
      console.warn(
        '[Climate Engine] surfacePressure not specified in planetary config, atmospheric transmission will be disabled'
      );
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
    });
    const dryTransmissionConfig = getDryTransmissionConfig();

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
        hydrologyData: { value: null }, // Will be set each frame
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
    });

    // Create hydrology material (Pass 2)
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
        surfaceGravity: { value: planetaryConfig.surfaceGravity }, // m/s² - for water vapour pressure calculations
        dt: { value: dt },
      },
    });

    // Create diffusion material (Pass 3)
    // Handles thermal conduction between cells using Fourier's law
    const diffusionMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: diffusionFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        cellInformation: { value: simulation.cellInformation },
        surfaceData: { value: null }, // Will be set each frame
        hydrologyData: { value: null }, // Will be set each frame (for heat capacity and thermal conductivity)
        neighbourIndices1: { value: simulation.neighbourIndices1 },
        neighbourIndices2: { value: simulation.neighbourIndices2 },
        textureWidth: { value: simulation.getTextureWidth() },
        textureHeight: { value: simulation.getTextureHeight() },
        planetRadius: { value: planetaryConfig.radius },
        dt: { value: dt },
      },
    });

    // Create mesh (material will be set below during initialisation)
    const mesh = new THREE.Mesh(geometry);
    mesh.frustumCulled = false;
    scene.add(mesh);

    // Initialise all simulation state using unified initialisation shader
    // Uses MRT to output surface, atmosphere, and hydrology states in one pass
    const initAtmospherePressure = planetaryConfig.surfacePressure ?? 101325; // Pa
    const initPrecipitableWater = 25.0; // mm (completely dry atmosphere initially)

    const initialisationMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: initialisationFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        terrainData: { value: simulation.terrainData },
        initAtmospherePressure: { value: initAtmospherePressure },
        initPrecipitableWater: { value: initPrecipitableWater },
        solarFlux: { value: solarFlux },
      },
    });

    mesh.material = initialisationMaterial;

    // Create MRT to render all three states at once
    // Uses the same pattern as radiationMRT and hydrologyMRT
    const initRenderTarget = new THREE.WebGLRenderTarget(
      simulation.getTextureWidth(),
      simulation.getTextureHeight(),
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        count: 3, // 3 outputs: surface, atmosphere, hydrology
      }
    ) as unknown as THREE.WebGLRenderTarget<THREE.Texture[]>;

    // Render initialisation pass
    gl.setRenderTarget(initRenderTarget);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // Copy results to simulation buffers
    const copyMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: `
        precision highp float;
        uniform sampler2D sourceTexture;
        in vec2 vUv;
        out vec4 fragColour;
        void main() {
          fragColour = texture(sourceTexture, vUv);
        }
      `,
      glslVersion: THREE.GLSL3,
      uniforms: {
        sourceTexture: { value: null },
      },
    });

    mesh.material = copyMaterial;

    // Copy surface state
    copyMaterial.uniforms.sourceTexture.value = initRenderTarget.textures[0];
    gl.setRenderTarget(simulation.getClimateDataCurrent());
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // Copy atmosphere state
    copyMaterial.uniforms.sourceTexture.value = initRenderTarget.textures[1];
    gl.setRenderTarget(simulation.getAtmosphereDataCurrent());
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // Copy hydrology state
    copyMaterial.uniforms.sourceTexture.value = initRenderTarget.textures[2];
    gl.setRenderTarget(simulation.getHydrologyDataCurrent());
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // Cleanup initialisation resources
    initialisationMaterial.dispose();
    copyMaterial.dispose();
    initRenderTarget.dispose();

    // Store GPU resources
    gpuResources = {
      scene,
      camera,
      geometry,
      radiationMaterial,
      hydrologyMaterial,
      diffusionMaterial,
      blankRenderTarget,
      mesh,
    };

    // Validate GPU resources were created successfully
    console.log('ClimateEngine: Validating GPU resources...');
    validateGPUResources(gl, gpuResources);
    console.log('ClimateEngine: GPU resources validated successfully');

    // Create orchestrator
    orchestrator = new SimulationOrchestrator(
      {
        dt,
        yearLength,
        rotationsPerYear,
        stepsPerOrbit,
      },
      handleGPUError
    );

    registerOrchestrator(orchestrator);

    // Create simulation recorder
    recorder = new SimulationRecorder(
      {
        samplesPerOrbit,
        stepsPerOrbit,
      },
      simulation,
      gl
    );
    registerRecorder(recorder);

    // Reset recorder when simulation starts (in case of reuse)
    recorder.reset();

    // Register recorder with orchestrator to receive step notifications
    orchestrator.onStep((physicsStep, orbitIdx) => {
      recorder!.onPhysicsStep(physicsStep, orbitIdx);
    });

    // Start simulation loop
    const simulationLoop = () => {
      // Execute simulation frame - orchestrator handles all control flow
      orchestrator!.tick(getStepsPerFrame(), gl, simulation, gpuResources!);

      // Restore render target to canvas
      gl.setRenderTarget(null);

      // Schedule next frame
      animationFrameId = requestAnimationFrame(simulationLoop);
    };

    // Start loop
    animationFrameId = requestAnimationFrame(simulationLoop);

    console.log('ClimateEngine: Initialisation complete');
  } catch (error) {
    console.error('[ClimateEngine] Initialisation failed:', error);
    handleGPUError(error instanceof Error ? error : new Error(String(error)));
  }

  // Return simulation and cleanup function
  return {
    simulation,
    cleanup: () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      registerOrchestrator(null);
      registerRecorder(null);

      if (gpuResources) {
        gpuResources.geometry.dispose();
        gpuResources.radiationMaterial.dispose();
        gpuResources.hydrologyMaterial.dispose();
        gpuResources.diffusionMaterial.dispose();
        gpuResources.blankRenderTarget.dispose();
        gpuResources.scene.clear();
      }

      if (recorder) {
        recorder.dispose();
      }

      gpuResources = null;
      orchestrator = null;
      recorder = null;
      animationFrameId = null;
    },
  };
}

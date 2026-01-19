import * as THREE from 'three';
import { TextureGridSimulation } from './TextureGridSimulation';
import { SimulationOrchestrator } from './SimulationOrchestrator';
import { SimulationRecorder } from './SimulationRecorder';
import type { OrbitalConfig } from '../../config/orbitalConfig';
import { type PlanetaryConfig } from '../../config/planetaryConfig';
import {
  calculateMeanMolecularMass,
  calculateAtmosphereHeatCapacity,
  calculateAtmosphereSpecificHeat,
  calculateDryAdiabaticLapseRate,
} from '../atmosphereCalculations';
import type { SimulationConfig } from '../../config/simulationConfig';
import type { GPUResources } from '../../types/gpu';
import { TerrainDataLoader } from '../../terrain/TerrainDataLoader';

// Import shaders (includes are processed automatically by vite-plugin-glsl)
// Importing without ?raw allows Vite to process #include directives.
import fullscreenVertexShader from '../../rendering/shaders/utility/fullscreen.vert';
import initialisationFragmentShader from '../passes/00-initialisation/initialisation.frag';
import radiationFragmentShader from '../passes/01-radiation/radiation.frag';
import hydrologyFragmentShader from '../passes/02-hydrology/hydrology.frag';
import verticalMixingFragmentShader from '../passes/03-vertical-mixing/verticalMixing.frag';
import diffusionFragmentShader from '../passes/04-diffusion/diffusion.frag';

/**
 * Calculate heat capacity for a specific atmospheric layer.
 * Heat capacity = layer mass × specific heat
 */
function calculateLayerHeatCapacity(
  layerIndex: number,
  planetaryConfig: PlanetaryConfig,
  specificHeat: number
): number {
  const surfacePressure = planetaryConfig.surfacePressure || 101325;
  const gravity = planetaryConfig.surfaceGravity;

  // Layer pressure boundaries (Pa)
  const layerPressures = [
    { pTop: 50000, pBot: surfacePressure }, // Layer 0: boundary layer (surface to ~500hPa)
    { pTop: 10000, pBot: 50000 }, // Layer 1: troposphere (~500hPa to ~100hPa)
    { pTop: 100, pBot: 10000 }, // Layer 2: stratosphere (~100hPa to ~1hPa)
  ];

  const layer = layerPressures[layerIndex];
  const layerMass = (layer.pBot - layer.pTop) / gravity; // kg/m²

  return layerMass * specificHeat; // J/(m²·K)
}

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
    !resources.diffusionMaterial ||
    !resources.multiLayerRadiationMaterial ||
    !resources.multiLayerHydrologyMaterial ||
    !resources.verticalMixingMaterial
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
 * Handles simulation creation, terrain loading, and engine initialisation.
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
    const atmosphereSpecificHeat = calculateAtmosphereSpecificHeat(planetaryConfig);
    const lapseRate = calculateDryAdiabaticLapseRate(planetaryConfig);
    console.log(`  Atmospheric mean molecular mass: ${(meanMolecularMass * 6.022e23 * 1000).toFixed(2)} g/mol`);
    console.log(`  Atmosphere heat capacity: ${atmosphereHeatCapacity.toExponential(3)} J/(m²·K)`);
    console.log(`  Atmosphere specific heat: ${atmosphereSpecificHeat.toFixed(1)} J/(kg·K)`);
    console.log(`  Dry adiabatic lapse rate: ${(lapseRate * 1000).toFixed(2)} K/km`);

    // Create diffusion material (Pass 4 - surface thermal conduction)
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

    // =========================================================================
    // MULTI-LAYER ATMOSPHERE MATERIALS
    // =========================================================================

    // Multi-layer radiation material (replaces simple radiation)
    // Uses two-stream approximation with per-layer absorption/emission
    const multiLayerRadiationMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: radiationFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        cellInformation: { value: simulation.cellInformation },
        surfaceData: { value: null },
        terrainData: { value: simulation.terrainData },
        hydrologyData: { value: null },
        // Layer texture uniforms (will be set each frame)
        layer0ThermoData: { value: null },
        layer1ThermoData: { value: null },
        layer2ThermoData: { value: null },
        layer0DynamicsData: { value: null },
        layer1DynamicsData: { value: null },
        layer2DynamicsData: { value: null },
        // Orbital parameters
        axialTilt: { value: axialTilt },
        yearProgress: { value: 0 },
        subsolarLon: { value: 0 },
        solarFlux: { value: solarFlux },
        dt: { value: dt },
        // Physics parameters
        surfacePressure: { value: planetaryConfig.surfacePressure || 101325 },
        surfaceGravity: { value: planetaryConfig.surfaceGravity },
        atmosphereScaleHeight: { value: planetaryConfig.atmosphereScaleHeight },
        troposphericLapseRate: { value: lapseRate },
        // Layer heat capacities
        layer0HeatCapacity: { value: calculateLayerHeatCapacity(0, planetaryConfig, atmosphereSpecificHeat) },
        layer1HeatCapacity: { value: calculateLayerHeatCapacity(1, planetaryConfig, atmosphereSpecificHeat) },
        layer2HeatCapacity: { value: calculateLayerHeatCapacity(2, planetaryConfig, atmosphereSpecificHeat) },
      },
    });

    // Multi-layer hydrology material
    // Handles evaporation to boundary layer (layer 0)
    const multiLayerHydrologyMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: hydrologyFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        cellInformation: { value: simulation.cellInformation },
        surfaceData: { value: null },
        hydrologyData: { value: null },
        terrainData: { value: simulation.terrainData },
        auxiliaryData: { value: null },
        // Layer 0 thermo only (boundary layer for evaporation)
        layer0ThermoData: { value: null },
        dt: { value: dt },
        surfaceGravity: { value: planetaryConfig.surfaceGravity },
        surfacePressure: { value: planetaryConfig.surfacePressure || 101325 },
      },
    });

    // Vertical mixing material
    // Handles convective adjustment and cloud formation
    const verticalMixingMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: verticalMixingFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        cellInformation: { value: simulation.cellInformation },
        // All layer thermo and dynamics
        layer0ThermoData: { value: null },
        layer1ThermoData: { value: null },
        layer2ThermoData: { value: null },
        layer0DynamicsData: { value: null },
        layer1DynamicsData: { value: null },
        layer2DynamicsData: { value: null },
        dt: { value: dt },
        surfaceGravity: { value: planetaryConfig.surfaceGravity },
        surfacePressure: { value: planetaryConfig.surfacePressure || 101325 },
        atmosphereScaleHeight: { value: planetaryConfig.atmosphereScaleHeight },
        dryAdiabaticLapseRate: { value: lapseRate },
      },
    });

    console.log('[ClimateEngine] Multi-layer atmosphere materials created');
    console.log(`  Layer 0 heat capacity: ${calculateLayerHeatCapacity(0, planetaryConfig, atmosphereSpecificHeat).toExponential(3)} J/(m²·K)`);
    console.log(`  Layer 1 heat capacity: ${calculateLayerHeatCapacity(1, planetaryConfig, atmosphereSpecificHeat).toExponential(3)} J/(m²·K)`);
    console.log(`  Layer 2 heat capacity: ${calculateLayerHeatCapacity(2, planetaryConfig, atmosphereSpecificHeat).toExponential(3)} J/(m²·K)`);

    // Create mesh (material will be set below during initialisation)
    const mesh = new THREE.Mesh(geometry);
    mesh.frustumCulled = false;
    scene.add(mesh);

    // Initialise all simulation state using multi-layer initialisation shader
    // Uses MRT to output surface, hydrology, and all layer states in one pass
    const initSurfacePressure = planetaryConfig.surfacePressure ?? 101325; // Pa
    const initPrecipitableWater = 25.0; // mm (completely dry atmosphere initially)

    const initialisationMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: initialisationFragmentShader,
      glslVersion: THREE.GLSL3,
      uniforms: {
        terrainData: { value: simulation.terrainData },
        initSurfacePressure: { value: initSurfacePressure },
        initPrecipitableWater: { value: initPrecipitableWater },
        surfaceGravity: { value: planetaryConfig.surfaceGravity },
        solarFlux: { value: solarFlux },
      },
    });

    mesh.material = initialisationMaterial;

    // Get multi-layer init MRT (8 outputs: surface + hydrology + 3 thermo + 3 dynamics)
    const initRenderTarget = simulation.getMultiLayerInitMRT();

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

    // Copy surface state (attachment 0) to both current and next buffers
    copyMaterial.uniforms.sourceTexture.value = initRenderTarget.textures[0];
    gl.setRenderTarget(simulation.getClimateDataCurrent());
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    copyMaterial.uniforms.sourceTexture.value = initRenderTarget.textures[0];
    gl.setRenderTarget(simulation.getClimateDataNext());
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // Copy hydrology state (attachment 1) to both current and next buffers
    copyMaterial.uniforms.sourceTexture.value = initRenderTarget.textures[1];
    gl.setRenderTarget(simulation.getHydrologyDataCurrent());
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    copyMaterial.uniforms.sourceTexture.value = initRenderTarget.textures[1];
    gl.setRenderTarget(simulation.getHydrologyDataNext());
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // Copy layer thermo states (attachments 2-4)
    for (let i = 0; i < 3; i++) {
      copyMaterial.uniforms.sourceTexture.value = initRenderTarget.textures[2 + i];
      gl.setRenderTarget(simulation.getLayerThermoNext(i));
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);
    }

    // Copy layer dynamics states (attachments 5-7)
    for (let i = 0; i < 3; i++) {
      copyMaterial.uniforms.sourceTexture.value = initRenderTarget.textures[5 + i];
      gl.setRenderTarget(simulation.getLayerDynamicsNext(i));
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(null);
    }

    // Swap multi-layer buffers to make the initialised state current
    simulation.swapMultiLayerAtmosphereBuffers();

    // Cleanup initialisation resources
    initialisationMaterial.dispose();
    copyMaterial.dispose();

    // Store GPU resources
    gpuResources = {
      scene,
      camera,
      geometry,
      diffusionMaterial,
      multiLayerRadiationMaterial,
      multiLayerHydrologyMaterial,
      verticalMixingMaterial,
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
        gpuResources.diffusionMaterial.dispose();
        gpuResources.multiLayerRadiationMaterial.dispose();
        gpuResources.multiLayerHydrologyMaterial.dispose();
        gpuResources.verticalMixingMaterial.dispose();
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

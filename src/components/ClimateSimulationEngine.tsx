import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import { SimulationOrchestrator } from '../util/SimulationOrchestrator'
import type { PlanetConfig } from '../config/planetConfig'
import type { SimulationConfig } from '../config/simulationConfig'
import { useSimulation } from '../context/useSimulation'

// Import shaders
import fullscreenVertexShader from '../shaders/fullscreen.vert?raw'
import thermalEvolutionFragmentShader from '../shaders/thermalEvolution.frag?raw'
import hydrologyEvolutionFragmentShader from '../shaders/hydrologyEvolution.frag?raw'
import surfaceEvolutionFragmentShader from '../shaders/surfaceEvolution.frag?raw'

interface ClimateSimulationEngineProps {
  simulation: TextureGridSimulation
  planetConfig: PlanetConfig
  simulationConfig: SimulationConfig
  stepsPerFrame: number
  onSolveComplete?: () => void
}

interface GPUResources {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  geometry: THREE.BufferGeometry
  hydrologyMaterial: THREE.ShaderMaterial
  surfaceMaterial: THREE.ShaderMaterial
  thermalMaterial: THREE.ShaderMaterial
  blankRenderTarget: THREE.WebGLRenderTarget
  mesh: THREE.Mesh
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
  onSolveComplete,
}: ClimateSimulationEngineProps) {
  const { gl } = useThree()
  const {
    simulationKey,
    registerOrchestrator,
  } = useSimulation()

  const orchestratorRef = useRef<SimulationOrchestrator | null>(null)
  const gpuResourcesRef = useRef<GPUResources | null>(null)

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
  } = planetConfig

  const { stepsPerOrbit } = simulationConfig
  const thermalConductivity = groundConductivity

  // Initialise GPU resources and orchestrator once per simulationKey
  useEffect(() => {
    console.log('ClimateSimulationEngine: Initialising...')
    console.log(`  Solar flux: ${solarFlux} W/m²`)
    console.log(`  Albedo: ${albedo}`)
    console.log(`  Steps per orbit: ${stepsPerOrbit}`)

    const dt = yearLength / stepsPerOrbit
    console.log(`  Timestep: ${dt.toFixed(1)}s`)

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
        terrainData: { value: simulation.terrainData },
      },
    })

    // Create surface material
    const surfaceMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: surfaceEvolutionFragmentShader,
      uniforms: {
        terrainData: { value: simulation.terrainData },
        hydrologyData: { value: blankTexture },
      },
    })

    // Create thermal material
    const thermalMaterial = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: thermalEvolutionFragmentShader,
      uniforms: {
        previousTemperature: { value: blankTexture },
        cellPositions: { value: simulation.cellPositions },
        neighbourIndices1: { value: simulation.neighbourIndices1 },
        neighbourIndices2: { value: simulation.neighbourIndices2 },
        neighbourCounts: { value: simulation.neighbourCounts },
        terrainData: { value: simulation.terrainData },
        hydrologyData: { value: blankTexture },
        surfaceData: { value: blankTexture },
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

    // Create initialization material
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

    // Initialise surface data
    const surfaceFirstTarget = simulation.getSurfaceDataNext()
    surfaceMaterial.uniforms.terrainData.value = simulation.terrainData
    surfaceMaterial.uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture
    mesh.material = surfaceMaterial
    gl.setRenderTarget(surfaceFirstTarget)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    simulation.swapSurfaceBuffers()

    // Dispose init material and attach thermal material
    initMaterial.dispose()
    mesh.material = thermalMaterial

    // Store GPU resources
    gpuResourcesRef.current = {
      scene,
      camera,
      geometry,
      hydrologyMaterial,
      surfaceMaterial,
      thermalMaterial,
      blankRenderTarget,
      mesh,
    }

    // Create orchestrator
    const orchestrator = new SimulationOrchestrator({
      dt,
      yearLength,
      subsolarPoint,
      rotationsPerYear,
      stepsPerOrbit,
    })

    // Register milestone callbacks
    orchestrator.onMilestone((milestone) => {
      if (milestone.type === 'orbit_complete') {
        const statusMsg = `Orbit ${milestone.orbitIdx}, Step ${milestone.physicsStep}/${stepsPerOrbit}`
        console.log(`  ${statusMsg}`)
      }
    })

    orchestratorRef.current = orchestrator
    registerOrchestrator(orchestrator)

    // Cleanup
    return () => {
      registerOrchestrator(null)
      if (gpuResourcesRef.current) {
        gpuResourcesRef.current.geometry.dispose()
        gpuResourcesRef.current.hydrologyMaterial.dispose()
        gpuResourcesRef.current.surfaceMaterial.dispose()
        gpuResourcesRef.current.thermalMaterial.dispose()
        gpuResourcesRef.current.blankRenderTarget.dispose()
        gpuResourcesRef.current.scene.clear()
      }
      gpuResourcesRef.current = null
      orchestratorRef.current = null
    }
  }, [
    gl,
    simulation,
    planetConfig,
    simulationConfig,
    simulationKey,
    onSolveComplete,
    registerOrchestrator,
    solarFlux,
    albedo,
    stepsPerOrbit,
    yearLength,
    subsolarPoint,
    rotationsPerYear,
    cosmicBackgroundTemp,
    surfaceHeatCapacity,
    axialTilt,
    thermalConductivity,
    radius,
    emissivity,
  ])

  // Simulation loop
  useEffect(() => {
    const orchestrator = orchestratorRef.current
    const gpuResources = gpuResourcesRef.current

    if (!orchestrator || !gpuResources) return

    let animationFrameId: number

    const simulationLoop = () => {
      const executor = orchestrator.getExecutor()
      const progress = orchestrator.getProgress()

      // Handle pending steps (requested via stepOnce() or step())
      const pendingSteps = orchestrator.getPendingSteps()
      if (pendingSteps > 0) {
        // Render first, then execute the pending steps
        executor.renderStep(gl, simulation, gpuResources, gpuResources.mesh, gpuResources.scene, gpuResources.camera)
        orchestrator.executePendingSteps()
      }

      // Handle continuous running
      if (progress.controlState === 'running') {
        // Execute multiple steps per frame for performance
        for (let i = 0; i < stepsPerFrame; i++) {
          executor.renderStep(gl, simulation, gpuResources, gpuResources.mesh, gpuResources.scene, gpuResources.camera)
          orchestrator.step(1)
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
  }, [gl, simulation, registerOrchestrator, stepsPerOrbit, stepsPerFrame])

  return null
}

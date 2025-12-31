import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import { createClimateEngine } from '../engine/createClimateEngine'
import { useSimulation } from '../context/useSimulation'

interface ClimateEngineProps {
  simulation: TextureGridSimulation
  stepsPerFrame: number
  samplesPerOrbit: number
}

/**
 * Climate simulation engine component.
 * Handles engine initialisation, WebGL context management, and simulation lifecycle.
 */
export function ClimateEngine({ simulation, stepsPerFrame, samplesPerOrbit }: ClimateEngineProps) {
  const { gl } = useThree()
  const {
    activeSimulationConfig,
    activeOrbitalConfig,
    activePlanetaryConfig,
    simulationKey,
    registerOrchestrator,
    registerRecorder,
    pause,
  } = useSimulation()

  // Use ref for stepsPerFrame so changes don't re-initialise the engine
  const stepsPerFrameRef = useRef(stepsPerFrame)
  useEffect(() => {
    stepsPerFrameRef.current = stepsPerFrame
  }, [stepsPerFrame])

  // Initialise climate engine
  useEffect(() => {
    return createClimateEngine({
      gl,
      simulation,
      orbitalConfig: activeOrbitalConfig,
      planetaryConfig: activePlanetaryConfig,
      simulationConfig: activeSimulationConfig,
      getStepsPerFrame: () => stepsPerFrameRef.current,
      samplesPerOrbit,
      registerOrchestrator,
      registerRecorder,
      onError: pause,
    })

  }, [
    gl,
    simulation,
    simulationKey,
    activeSimulationConfig,
    activeOrbitalConfig,
    activePlanetaryConfig,
    samplesPerOrbit,
    registerOrchestrator,
    registerRecorder,
    pause,
  ])

  // WebGL context loss handling
  useEffect(() => {
    const canvas = gl.domElement

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      console.error('[ClimateEngine] WebGL context lost')
      pause()
    }

    const handleContextRestored = () => {
      console.log('[ClimateEngine] WebGL context restored')
      // Context restored, but would need to reinitialise by incrementing simulationKey to trigger recreation
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
    }
  }, [gl, pause])

  return null // This component doesn't render anything visual
}
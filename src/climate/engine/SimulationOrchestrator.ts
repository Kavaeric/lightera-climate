import * as THREE from 'three'
import { SimulationExecutor, type ExecutorConfig } from './SimulationExecutor'
import type { TextureGridSimulation } from './TextureGridSimulation'
import type { GPUResources } from '../../types/gpu'

/**
 * Configuration for the orchestrator.
 */
export interface OrchestratorConfig extends ExecutorConfig {
  stepsPerOrbit: number
}

/**
 * Control state for the orchestrator.
 */
export type ControlState = 'idle' | 'running' | 'paused' | 'completed'

/**
 * Current simulation progress.
 */
export interface SimulationProgress {
  orbitIdx: number
  physicsStep: number
  controlState: ControlState
}

/**
 * Milestone events that the orchestrator can emit.
 */
export type MilestoneType = 'orbit_complete' | 'simulation_complete'

export interface Milestone {
  type: MilestoneType
  orbitIdx: number
  physicsStep: number
}

/**
 * SimulationOrchestrator: Manages simulation control flow.
 *
 * Responsibilities:
 * - Track orbits and physics steps.
 * - Handle play/pause control.
 * - Execute simulation steps via the executor.
 * - Emit milestones (orbit completion, simulation completion).
 * - Coordinates with the recorder for data collection.
 */
export class SimulationOrchestrator {
  private executor: SimulationExecutor
  private config: OrchestratorConfig

  private orbitIdx: number = 0
  private physicsStep: number = 0
  private controlState: ControlState = 'idle'

  private milestoneCallbacks: ((milestone: Milestone) => void)[] = []
  private stepCallbacks: ((physicsStep: number, orbitIdx: number) => void)[] = []

  constructor(config: OrchestratorConfig, errorCallback?: (error: Error) => void) {
    this.config = config
    this.executor = new SimulationExecutor(config, errorCallback)
  }

  /**
   * Get current simulation progress in the form of a SimulationProgress object.
   */
  getProgress(): SimulationProgress {
    return {
      orbitIdx: this.orbitIdx,
      physicsStep: this.physicsStep,
      controlState: this.controlState,
    }
  }

  /**
   * Register a callback for milestones.
   */
  onMilestone(callback: (milestone: Milestone) => void): void {
    this.milestoneCallbacks.push(callback)
  }

  /**
   * Register a callback that fires after each physics step.
   * Used by recorder to track simulation progress.
   */
  onStep(callback: (physicsStep: number, orbitIdx: number) => void): void {
    this.stepCallbacks.push(callback)
  }

  /**
   * Start running the simulation.
   */
  play(): void {
    if (this.controlState === 'completed') {
      // Don't allow resuming a completed simulation
      return
    }
    this.controlState = 'running'
  }

  /**
   * Pause the simulation if it's running.
   */
  pause(): void {
    if (this.controlState === 'running') {
      this.controlState = 'paused'
    }
  }

  /**
   * Execute one frame of simulation.
   * This is the main entry point called from the render loop.
   *
   * @param stepsPerFrame - Number of physics steps to execute per frame
   * @param gl - WebGL renderer
   * @param simulation - Simulation textures
   * @param gpuResources - GPU materials and geometry
   * @returns Number of steps executed
   */
  tick(
    stepsPerFrame: number,
    gl: THREE.WebGLRenderer,
    simulation: TextureGridSimulation,
    gpuResources: GPUResources
  ): number {
    // Only execute if running
    if (this.controlState !== 'running') {
      return 0
    }

    let stepsExecuted = 0

    // Execute multiple steps per frame for performance
    for (let i = 0; i < stepsPerFrame; i++) {
      const success = this.executeStep(gl, simulation, gpuResources)
      if (!success) {
        // Stop execution on error
        break
      }
      stepsExecuted++
    }

    return stepsExecuted
  }

  /**
   * Execute a single physics step.
   * Returns true on success, false on error.
   */
  private executeStep(
    gl: THREE.WebGLRenderer,
    simulation: TextureGridSimulation,
    gpuResources: GPUResources
  ): boolean {
    // Render the GPU step
    const success = this.executor.renderStep(
      gl,
      simulation,
      {
        radiationMaterial: gpuResources.radiationMaterial,
        hydrologyMaterial: gpuResources.hydrologyMaterial,
        diffusionMaterial: gpuResources.diffusionMaterial,
      },
      gpuResources.mesh,
      gpuResources.scene,
      gpuResources.camera
    )

    if (!success) {
      return false
    }

    // Update state tracking
    this.advanceStep()

    return true
  }

  /**
   * Advance internal step counters and emit events
   */
  private advanceStep(): void {
    // Advance one physics step
    this.physicsStep++

    // Check if we've completed an orbit
    if (this.physicsStep >= this.config.stepsPerOrbit) {
      this.physicsStep = 0
      this.orbitIdx++

      // Emit orbit completion milestone
      this.emitMilestone({
        type: 'orbit_complete',
        orbitIdx: this.orbitIdx,
        physicsStep: this.physicsStep,
      })
    }

    // Advance executor state
    this.executor.step()

    // Notify step callbacks (for recorder)
    this.emitStepCallbacks()
  }

  /**
   * Check if simulation is running.
   */
  isRunning(): boolean {
    return this.controlState === 'running'
  }

  /**
   * Check if simulation is completed.
   */
  isCompleted(): boolean {
    return this.controlState === 'completed'
  }

  /**
   * Emit a milestone event.
   */
  private emitMilestone(milestone: Milestone): void {
    for (const callback of this.milestoneCallbacks) {
      callback(milestone)
    }
  }

  /**
   * Emit step callbacks.
   */
  private emitStepCallbacks(): void {
    for (const callback of this.stepCallbacks) {
      callback(this.physicsStep, this.orbitIdx)
    }
  }
}

import { SimulationExecutor, type ExecutorConfig } from './SimulationExecutor'

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig extends ExecutorConfig {
  stepsPerOrbit: number
}

/**
 * Control state for the orchestrator
 */
export type ControlState = 'idle' | 'running' | 'paused' | 'completed'

/**
 * Current simulation progress
 */
export interface SimulationProgress {
  orbitIdx: number
  physicsStep: number
  controlState: ControlState
}

/**
 * Milestone events that the orchestrator can emit
 */
export type MilestoneType = 'orbit_complete' | 'simulation_complete'

export interface Milestone {
  type: MilestoneType
  orbitIdx: number
  physicsStep: number
}

/**
 * SimulationOrchestrator - Manages simulation control flow
 *
 * Responsibilities:
 * - Track orbits and physics steps
 * - Handle play/pause/step control
 * - Emit milestones (orbit completion, simulation completion)
 * - No GPU rendering logic (delegates to executor)
 */
export class SimulationOrchestrator {
  private executor: SimulationExecutor
  private config: OrchestratorConfig

  private orbitIdx: number = 0
  private physicsStep: number = 0
  private controlState: ControlState = 'idle'
  private pendingSteps: number = 0

  private milestoneCallbacks: ((milestone: Milestone) => void)[] = []

  constructor(config: OrchestratorConfig, errorCallback?: (error: Error) => void) {
    this.config = config
    this.executor = new SimulationExecutor(config, errorCallback)
  }

  /**
   * Get current executor (for rendering)
   */
  getExecutor(): SimulationExecutor {
    return this.executor
  }

  /**
   * Get current progress
   */
  getProgress(): SimulationProgress {
    return {
      orbitIdx: this.orbitIdx,
      physicsStep: this.physicsStep,
      controlState: this.controlState,
    }
  }

  /**
   * Register a callback for milestones
   */
  onMilestone(callback: (milestone: Milestone) => void): void {
    this.milestoneCallbacks.push(callback)
  }

  /**
   * Start running the simulation
   */
  play(): void {
    if (this.controlState === 'completed') {
      // Don't allow resuming a completed simulation
      return
    }
    this.controlState = 'running'
  }

  /**
   * Pause the simulation
   */
  pause(): void {
    if (this.controlState === 'running') {
      this.controlState = 'paused'
    }
  }

  /**
   * Request a single physics step (for manual stepping)
   * The step will be executed on the next render cycle
   * Returns true if the step was queued, false if simulation is complete
   */
  stepOnce(): boolean {
    if (this.controlState === 'completed') {
      return false
    }
    this.pendingSteps++
    return true
  }

  /**
   * Request multiple physics steps
   * The steps will be executed on the next render cycle
   * Returns the number of steps queued
   */
  requestSteps(numSteps: number): number {
    if (this.controlState === 'completed' || numSteps <= 0) {
      return 0
    }
    this.pendingSteps += numSteps
    return numSteps
  }

  /**
   * Execute any pending steps that were requested via stepOnce() or requestSteps()
   * This should be called from the render loop after rendering
   * Returns the number of steps actually executed
   */
  executePendingSteps(): number {
    if (this.pendingSteps === 0) {
      return 0
    }
    const stepsToExecute = this.pendingSteps
    this.pendingSteps = 0
    return this.step(stepsToExecute)
  }

  /**
   * Execute an arbitrary number of physics steps
   * Can be called regardless of control state (unlike executeSteps which requires running)
   * Returns the number of steps actually executed
   */
  step(numSteps: number): number {
    if (this.controlState === 'completed' || numSteps <= 0) {
      return 0
    }

    let executed = 0
    for (let i = 0; i < numSteps; i++) {
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

      // Advance executor state after tracking the step
      this.executor.step()
      executed++
    }

    return executed
  }

  /**
   * Execute multiple physics steps (for continuous running)
   * Only works when control state is 'running'
   * Returns the number of steps actually executed
   */
  executeSteps(numSteps: number): number {
    if (this.controlState !== 'running') {
      return 0
    }

    return this.step(numSteps)
  }

  /**
   * Reset the simulation to initial state
   */
  reset(): void {
    this.orbitIdx = 0
    this.physicsStep = 0
    this.controlState = 'idle'
    this.pendingSteps = 0
    this.executor.reset()
  }

  /**
   * Get the number of pending steps
   */
  getPendingSteps(): number {
    return this.pendingSteps
  }

  /**
   * Check if simulation is running
   */
  isRunning(): boolean {
    return this.controlState === 'running'
  }

  /**
   * Check if simulation is completed
   */
  isCompleted(): boolean {
    return this.controlState === 'completed'
  }

  private emitMilestone(milestone: Milestone): void {
    for (const callback of this.milestoneCallbacks) {
      callback(milestone)
    }
  }
}

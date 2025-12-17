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

  private milestoneCallbacks: ((milestone: Milestone) => void)[] = []

  constructor(config: OrchestratorConfig) {
    this.config = config
    this.executor = new SimulationExecutor(config)
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
   * Execute a single physics step (for manual stepping)
   * Returns true if a step was executed, false if simulation is complete
   */
  stepOnce(): boolean {
    if (this.controlState === 'completed') {
      return false
    }

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

    return true
  }

  /**
   * Execute multiple physics steps (for continuous running)
   * Returns the number of steps actually executed
   */
  executeSteps(numSteps: number): number {
    if (this.controlState !== 'running') {
      return 0
    }

    let executed = 0
    for (let i = 0; i < numSteps; i++) {
      if (!this.stepOnce()) {
        break
      }
      executed++
    }

    return executed
  }

  /**
   * Reset the simulation to initial state
   */
  reset(): void {
    this.orbitIdx = 0
    this.physicsStep = 0
    this.controlState = 'idle'
    this.executor.reset()
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

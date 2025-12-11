import { Grid, GridCell } from './geodesic'

/**
 * Simulation state for a geodesic grid
 * Stores values for each cell and handles neighbor-based updates
 */
export class GridSimulation {
  grid: Grid
  cells: GridCell[]

  // Simulation state - one value per cell
  values: Float32Array
  nextValues: Float32Array

  // Precomputed neighbor indices for fast lookup
  neighborIndices: Int32Array
  neighborCounts: Uint8Array

  constructor(grid: Grid) {
    this.grid = grid

    // Build flat cell array
    this.cells = Array.from(grid)
    const cellCount = this.cells.length

    // Initialize value arrays
    this.values = new Float32Array(cellCount)
    this.nextValues = new Float32Array(cellCount)

    // Precompute neighbor indices
    // Max 6 neighbors per cell, store as flat array
    this.neighborIndices = new Int32Array(cellCount * 6)
    this.neighborCounts = new Uint8Array(cellCount)

    this.buildNeighborIndices()
    this.initializeValues()
  }

  /**
   * Build a lookup table of neighbor indices
   */
  private buildNeighborIndices() {
    const cellMap = new Map<string, number>()

    // Map cell IDs to indices
    this.cells.forEach((cell, index) => {
      cellMap.set(cell.id, index)
    })

    // For each cell, store its neighbor indices
    this.cells.forEach((cell, cellIndex) => {
      const neighbors = cell.neighbors(this.grid)
      this.neighborCounts[cellIndex] = neighbors.length

      for (let i = 0; i < neighbors.length; i++) {
        const neighborIndex = cellMap.get(neighbors[i].id)
        if (neighborIndex === undefined) {
          console.error(`Neighbor ${neighbors[i].id} not found for cell ${cell.id}`)
          continue
        }
        this.neighborIndices[cellIndex * 6 + i] = neighborIndex
      }
    })
  }

  /**
   * Initialize with some interesting pattern
   */
  private initializeValues() {
    this.cells.forEach((cell, index) => {
      const pos = cell.centerVertex

      // Map temperature from -40°C (poles) to +30°C (equator), then convert to Kelvin
      const latitude = Math.asin(pos.y) // -π/2 to π/2
      const fraction = Math.cos(latitude) // 0 at poles, 1 at equator
      const temp = -50 + (35 + 50) * fraction // -40°C at poles, +30°C at equator

      this.values[index] = temp
    })
  }

  /**
   * Get neighbors for a cell by index
   */
  getNeighborIndices(cellIndex: number): number[] {
    const count = this.neighborCounts[cellIndex]
    const neighbors = []
    for (let i = 0; i < count; i++) {
      neighbors.push(this.neighborIndices[cellIndex * 6 + i])
    }
    return neighbors
  }

  /**
   * Update simulation - simple diffusion
   * Each cell averages with its neighbors
   */
  step(diffusionRate: number = 0.1) {
    // Compute next values based on current state
    for (let i = 0; i < this.cells.length; i++) {
      const currentValue = this.values[i]

      // Average neighbor values
      let neighborSum = 0
      const neighborCount = this.neighborCounts[i]

      for (let j = 0; j < neighborCount; j++) {
        const neighborIndex = this.neighborIndices[i * 6 + j]
        neighborSum += this.values[neighborIndex]
      }

      const neighborAvg = neighborSum / neighborCount

      // Diffusion: blend current value with neighbor average
      const newValue = currentValue + (neighborAvg - currentValue) * diffusionRate

      // Don't clamp - let values overflow to see where simulation breaks
      this.nextValues[i] = newValue
    }

    // Swap buffers
    const temp = this.values
    this.values = this.nextValues
    this.nextValues = temp
  }

  /**
   * Get value at cell index
   */
  getValue(index: number): number {
    return this.values[index]
  }

  /**
   * Set value at cell index
   */
  setValue(index: number, value: number) {
    this.values[index] = value
  }

  /**
   * Get maximum temperature across all cells
   */
  getMaxTemperature(): number {
    let max = -Infinity
    for (let i = 0; i < this.values.length; i++) {
      if (this.values[i] > max) {
        max = this.values[i]
      }
    }
    return max
  }

  /**
   * Get minimum temperature across all cells
   */
  getMinTemperature(): number {
    let min = Infinity
    for (let i = 0; i < this.values.length; i++) {
      if (this.values[i] < min) {
        min = this.values[i]
      }
    }
    return min
  }
}

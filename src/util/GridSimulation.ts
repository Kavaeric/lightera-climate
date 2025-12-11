import { Grid, GridCell } from './geodesic'

/**
 * Simulation state for a geodesic grid
 * Stores values for each cell and handles neighbour-based updates
 */
export class GridSimulation {
  grid: Grid
  cells: GridCell[]

  // Simulation state - one value per cell
  values: Float32Array
  nextValues: Float32Array

  // Precomputed neighbour indices for fast lookup
  neighbourIndices: Int32Array
  neighbourCounts: Uint8Array

  constructor(grid: Grid) {
    this.grid = grid

    // Build flat cell array
    this.cells = Array.from(grid)
    const cellCount = this.cells.length

    // Initialize value arrays
    this.values = new Float32Array(cellCount)
    this.nextValues = new Float32Array(cellCount)

    // Precompute neighbour indices
    // Max 6 neighbours per cell, store as flat array
    this.neighbourIndices = new Int32Array(cellCount * 6)
    this.neighbourCounts = new Uint8Array(cellCount)

    this.buildneighbourIndices()
    this.initializeValues()
  }

  /**
   * Build a lookup table of neighbour indices
   */
  private buildneighbourIndices() {
    const cellMap = new Map<string, number>()

    // Map cell IDs to indices
    this.cells.forEach((cell, index) => {
      cellMap.set(cell.id, index)
    })

    // For each cell, store its neighbour indices
    this.cells.forEach((cell, cellIndex) => {
      const neighbours = cell.neighbours(this.grid)
      this.neighbourCounts[cellIndex] = neighbours.length

      for (let i = 0; i < neighbours.length; i++) {
        const neighbourIndex = cellMap.get(neighbours[i].id)
        if (neighbourIndex === undefined) {
          console.error(`Neighbour ${neighbours[i].id} not found for cell ${cell.id}`)
          continue
        }
        this.neighbourIndices[cellIndex * 6 + i] = neighbourIndex
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
   * Get neighbours for a cell by index
   */
  getneighbourIndices(cellIndex: number): number[] {
    const count = this.neighbourCounts[cellIndex]
    const neighbours = []
    for (let i = 0; i < count; i++) {
      neighbours.push(this.neighbourIndices[cellIndex * 6 + i])
    }
    return neighbours
  }

  /**
   * Update simulation - simple diffusion
   * Each cell averages with its neighbours
   */
  step(diffusionRate: number = 0.1) {
    // Compute next values based on current state
    for (let i = 0; i < this.cells.length; i++) {
      const currentValue = this.values[i]

      // Average neighbour values
      let neighbourSum = 0
      const neighbourCount = this.neighbourCounts[i]

      for (let j = 0; j < neighbourCount; j++) {
        const neighbourIndex = this.neighbourIndices[i * 6 + j]
        neighbourSum += this.values[neighbourIndex]
      }

      const neighbourAvg = neighbourSum / neighbourCount

      // Diffusion: blend current value with neighbour average
      const newValue = currentValue + (neighbourAvg - currentValue) * diffusionRate

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

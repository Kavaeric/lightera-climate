import { forwardRef } from 'react'
import * as THREE from 'three'
import { CellHighlightOverlay } from './CellHighlightOverlay'
import { CellOutlineOverlay } from './CellOutlineOverlay'
import { LatLonGrid } from './LatLonGrid'
import { TextureGridSimulation } from '../climate/engine/TextureGridSimulation'

interface ClimateOverlaysProps {
  // Cell highlighting
  simulation: TextureGridSimulation
  subdivisions: number
  radius: number
  hoveredCellIndex?: number | null
  selectedCellIndex?: number | null
  
  // Lat/Lon grid
  showLatLonGrid: boolean
  axialTilt: number
}

/**
 * Visual overlays rendered on top of the planet geometry.
 */
export const ClimateOverlays = forwardRef<THREE.Mesh, ClimateOverlaysProps>(
  function ClimateOverlays({
    simulation,
    subdivisions,
    radius,
    hoveredCellIndex,
    selectedCellIndex,
    showLatLonGrid,
    axialTilt,
  }, ref) {
    return (
      <>
        {/* Cell highlighting overlay - raised solid highlight */}
        <CellHighlightOverlay
          ref={ref}
          subdivisions={subdivisions}
          radius={radius}
          offset={0.05}
          simulation={simulation}
          hoveredCellIndex={hoveredCellIndex}
          selectedCellIndex={selectedCellIndex}
        />

        {/* Cell outline overlay - surface outline */}
        <CellOutlineOverlay
          subdivisions={subdivisions}
          radius={radius}
          hoveredCellIndex={hoveredCellIndex}
          selectedCellIndex={selectedCellIndex}
        />

        {/* Lat/Lon grid overlay */}
        <LatLonGrid
          visible={showLatLonGrid}
          axialTilt={axialTilt}
        />
      </>
    )
  }
)

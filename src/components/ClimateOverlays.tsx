import { forwardRef } from 'react'
import * as THREE from 'three'
import { CellHighlightOverlay } from './CellHighlightOverlay'
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
        {/* Cell highlighting overlay */}
        <CellHighlightOverlay
          ref={ref}
          subdivisions={subdivisions}
          radius={radius}
          simulation={simulation}
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

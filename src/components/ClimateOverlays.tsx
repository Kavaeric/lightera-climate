import { forwardRef } from 'react';
import * as THREE from 'three';
import { CellHighlightOverlay } from './CellHighlightOverlay';
import { CellOutlineOverlay } from './CellOutlineOverlay';
import { LatLonGrid } from './LatLonGrid';

interface ClimateOverlaysProps {
  hoveredCellIndex?: number | null;
  selectedCellIndex?: number | null;

  // Lat/Lon grid
  showLatLonGrid: boolean;
  axialTilt: number;
}

/**
 * Visual overlays rendered on top of the planet geometry.
 */
export const ClimateOverlays = forwardRef<THREE.Mesh, ClimateOverlaysProps>(
  function ClimateOverlays(
    {
      hoveredCellIndex,
      selectedCellIndex,
      showLatLonGrid,
      axialTilt,
    },
    ref
  ) {
    return (
      <>
        {/* Lat/Lon grid overlay */}
        <LatLonGrid visible={showLatLonGrid} axialTilt={axialTilt} />

        {/* Cell outline overlay - surface outline */}
        <CellOutlineOverlay
          hoveredCellIndex={hoveredCellIndex}
          selectedCellIndex={selectedCellIndex}
        />

        {/* Cell highlighting overlay - raised solid highlight */}
        <CellHighlightOverlay
          ref={ref}
          offset={0.015}
          hoveredCellIndex={hoveredCellIndex}
          selectedCellIndex={selectedCellIndex}
        />
      </>
    );
  }
);

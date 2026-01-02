import { forwardRef } from 'react';
import * as THREE from 'three';
import { CellHighlightOverlay } from './CellHighlightOverlay';
import { CellOutlineOverlay } from './CellOutlineOverlay';
import { LatLonGrid } from './LatLonGrid';
import { useDisplayConfig } from '../context/useDisplayConfig';
import { useOrbitalConfig } from '../context/useOrbitalConfig';

interface ClimateOverlaysProps {
  hoveredCellIndex?: number | null;
  selectedCellIndex?: number | null;
}

/**
 * Visual overlays rendered on top of the planet geometry.
 */
export const ClimateOverlays = forwardRef<THREE.Group, ClimateOverlaysProps>(
  function ClimateOverlays(
    {
      hoveredCellIndex,
      selectedCellIndex,
    },
    ref
  ) {
    const { showLatLonGrid } = useDisplayConfig();
    const { orbitalConfig } = useOrbitalConfig();

    return (
      <>
        {/* Lat/Lon grid overlay */}
        <LatLonGrid visible={showLatLonGrid} axialTilt={orbitalConfig.axialTilt} />

        {/* Cell outline overlay - surface outline */}
        <CellOutlineOverlay
          hoveredCellIndex={hoveredCellIndex}
          selectedCellIndex={selectedCellIndex}
        />

        {/* Cell highlighting overlay - raised solid highlight */}
        <CellHighlightOverlay
          ref={ref}
          hoveredCellIndex={hoveredCellIndex}
          selectedCellIndex={selectedCellIndex}
        />
      </>
    );
  }
);

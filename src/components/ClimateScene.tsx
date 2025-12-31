import { forwardRef } from 'react'
import * as THREE from 'three'
import { PlanetRenderer } from './PlanetRenderer'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import type { DisplayConfig } from '../config/displayConfig'

interface ClimateSceneProps {
  simulation: TextureGridSimulation
  displayConfig: DisplayConfig
  subdivisions: number
  radius: number
}

/**
 * Core 3D scene component containing the main geometry and lighting.
 * Renders any geometry and lighting.
 */
export const ClimateScene = forwardRef<THREE.Mesh, ClimateSceneProps>(
  function ClimateScene({ simulation, displayConfig, subdivisions, radius }, ref) {
    return (
      <>
        {/* Planet mesh */}
        <PlanetRenderer
          ref={ref}
          subdivisions={subdivisions}
          radius={radius}
          simulation={simulation}
          displayConfig={displayConfig}
        />
      </>
    )
  }
)

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { useRef, useMemo, useState } from 'react'
import * as THREE from 'three'
import { TextureGridSimulation } from './util/TextureGridSimulation'
import { TextureGeodesicPolyhedron } from './components/TextureGeodesicPolyhedron'
import { TextureSimulationRenderer } from './components/TextureSimulationRenderer'
import { CellPicker } from './components/CellPicker'
import { LatLonGrid } from './components/LatLonGrid'

const SIMULATION_RESOLUTION = 64; // 128 seems to be the max until it crashes

function Scene({ simulation, onStatsUpdate, showLatLonGrid }: { simulation: TextureGridSimulation; onStatsUpdate: (stats: { min: number; max: number }) => void; showLatLonGrid: boolean }) {
  const { gl } = useThree()
  const frameCountRef = useRef(0)
  const meshRef = useRef<THREE.Mesh>(null)
  const [hoveredCell, setHoveredCell] = useState<number | null>(null)

  useFrame(async () => {
    // Update stats every 60 frames for performance (GPU readback is slow)
    frameCountRef.current++
    if (frameCountRef.current % 60 === 0) {
      const stats = await simulation.getMinMaxTemperature(gl)
      onStatsUpdate(stats)
    }
  })

  return (
    <>
      {/* Invisible component that runs GPU simulation via render-to-texture */}
      <TextureSimulationRenderer simulation={simulation} />

      {/* Visible geometry that reads from simulation texture */}
      <TextureGeodesicPolyhedron
        ref={meshRef}
        subdivisions={SIMULATION_RESOLUTION}
        radius={1}
        simulation={simulation}
        valueRange={{ min: -40, max: 30 }}
        hoveredCellIndex={hoveredCell}
      />

      {/* Cell picker for debugging */}
      <CellPicker simulation={simulation} meshRef={meshRef} onHoverCell={setHoveredCell} />

      {/* Lat/Lon grid overlay */}
      <LatLonGrid segments={64} visible={showLatLonGrid} />
    </>
  )
}

function App() {
  // Create texture-based simulation once at App level
  const simulation = useMemo(() => {
    return new TextureGridSimulation(SIMULATION_RESOLUTION)
  }, [])

  const [stats, setStats] = useState({ min: -40, max: 30 })
  const [showLatLonGrid, setShowLatLonGrid] = useState(true)

  return (
    <main style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas camera={{ position: [2, 1, 2], fov: 60 }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <OrbitControls enablePan={false} />

        <GizmoHelper alignment="top-right" margin={[60, 60]}>
          <GizmoViewport />
        </GizmoHelper>

        {/* GPU-based simulation and rendering */}
        <Scene simulation={simulation} onStatsUpdate={setStats} showLatLonGrid={showLatLonGrid} />
      </Canvas>

      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '8px', fontFamily: 'monospace' }}>
        <dl style={{ margin: 0 }}>
          <dt>Maximum temperature</dt>
          <dd>{stats.max.toFixed(1)}</dd>
          <dt>Minimum temperature</dt>
          <dd>{stats.min.toFixed(1)}</dd>
        </dl>
        <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.3)' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={showLatLonGrid}
            onChange={(e) => setShowLatLonGrid(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>Show latitude and longitude grid</span>
        </label>
      </div>
    </main>
  );
}

export default App;

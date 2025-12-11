import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { useRef, useMemo, useState } from 'react'
import { TextureGridSimulation } from './util/TextureGridSimulation'
import { TextureGeodesicPolyhedron } from './components/TextureGeodesicPolyhedron'
import { TextureSimulationRenderer } from './components/TextureSimulationRenderer'

const SIMULATION_RESOLUTION = 32;

function Scene({ simulation, onStatsUpdate }: { simulation: TextureGridSimulation; onStatsUpdate: (stats: { min: number; max: number }) => void }) {
  const { gl } = useThree()
  const frameCountRef = useRef(0)

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
        subdivisions={SIMULATION_RESOLUTION}
        radius={1}
        simulation={simulation}
        valueRange={{ min: -40, max: 30 }}
      />
    </>
  )
}

function App() {
  // Create texture-based simulation once at App level
  const simulation = useMemo(() => {
    return new TextureGridSimulation(SIMULATION_RESOLUTION)
  }, [])

  const [stats, setStats] = useState({ min: -40, max: 30 })

  return (
    <main style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas camera={{ position: [2, 1, 2], fov: 60 }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <OrbitControls enablePan={false} />

        <GizmoHelper alignment="top-right" margin={[60, 60]}>
          <GizmoViewport />
        </GizmoHelper>

        {/* GPU-based simulation and rendering */}
        <Scene simulation={simulation} onStatsUpdate={setStats} />
      </Canvas>

      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '8px', fontFamily: 'monospace' }}>
        <dl style={{ margin: 0 }}>
          <dt>Maximum temperature</dt>
          <dd>{stats.max.toFixed(1)}</dd>
          <dt>Minimum temperature</dt>
          <dd>{stats.min.toFixed(1)}</dd>
        </dl>
      </div>
    </main>
  );
}

export default App;

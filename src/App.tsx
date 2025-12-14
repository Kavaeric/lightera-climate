import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { TextureGridSimulation } from './util/TextureGridSimulation'
import { TextureGeodesicPolyhedron } from './components/TextureGeodesicPolyhedron'
import { CellPicker } from './components/CellPicker'
import { LatLonGrid } from './components/LatLonGrid'
import { ClimateSolver } from './components/ClimateSolver'
import { ClimateGraph } from './components/ClimateGraph'
import { DEFAULT_PLANET_CONFIG, type PlanetConfig } from './config/planetConfig'

const SIMULATION_RESOLUTION = 16; // 128 seems to be the max until it crashes

interface SceneProps {
  simulation: TextureGridSimulation
  planetConfig: PlanetConfig
  showLatLonGrid: boolean
  hoveredCell: number | null
  selectedCell: number | null
  onHoverCell: (cellIndex: number | null) => void
  onCellClick: (cellIndex: number) => void
}

function Scene({ simulation, planetConfig, showLatLonGrid, hoveredCell, selectedCell, onHoverCell, onCellClick }: SceneProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  return (
    <>
      {/* Climate solver - computes temperature for all time samples */}
      <ClimateSolver
        simulation={simulation}
        solarFlux={planetConfig.solarFlux}
        albedo={planetConfig.albedo}
        emissivity={planetConfig.emissivity}
        subsolarPoint={planetConfig.subsolarPoint}
        rotationsPerYear={planetConfig.rotationsPerYear}
        cosmicBackgroundTemp={planetConfig.cosmicBackgroundTemp}
        yearLength={planetConfig.yearLength}
        spinupOrbits={planetConfig.iterations}
        surfaceHeatCapacity={planetConfig.surfaceHeatCapacity}
        thermalConductivity={planetConfig.groundDiffusion}
      />

      {/* Visible geometry - reads from climate data */}
      <TextureGeodesicPolyhedron
        ref={meshRef}
        subdivisions={SIMULATION_RESOLUTION}
        radius={1}
        simulation={simulation}
        valueRange={planetConfig.displayRange}
        hoveredCellIndex={hoveredCell}
        selectedCellIndex={selectedCell}
      />

      {/* Cell picker */}
      <CellPicker
        simulation={simulation}
        meshRef={meshRef}
        onHoverCell={onHoverCell}
        onCellClick={onCellClick}
      />

      {/* Lat/Lon grid overlay */}
      <LatLonGrid segments={64} visible={showLatLonGrid} />
    </>
  )
}

// Helper component to fetch climate data (stays inside Canvas for gl access)
function ClimateDataFetcher({
  simulation,
  cellIndex,
  onDataFetched,
}: {
  simulation: TextureGridSimulation
  cellIndex: number | null
  onDataFetched: (data: Array<{ day: number; temperature: number; humidity: number; pressure: number }>) => void
}) {
  const { gl } = useThree()

  useEffect(() => {
    if (cellIndex === null) {
      onDataFetched([])
      return
    }

    const fetchData = async () => {
      const climateData = await simulation.getClimateDataForCell(cellIndex, gl)
      const formattedData = climateData.map((d, i) => ({
        day: i,
        ...d,
      }))
      onDataFetched(formattedData)
    }

    fetchData()
  }, [cellIndex, simulation, gl, onDataFetched])

  return null // Don't render anything in the Canvas
}

function App() {
  // Create climate simulation once at App level
  const simulation = useMemo(() => {
    return new TextureGridSimulation(SIMULATION_RESOLUTION)
  }, [])

  // Planet configuration
  const [planetConfig] = useState<PlanetConfig>(DEFAULT_PLANET_CONFIG)

  const [showLatLonGrid, setShowLatLonGrid] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<number | null>(null)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [selectedCellLatLon, setSelectedCellLatLon] = useState<{ lat: number; lon: number } | null>(null)
  const [climateData, setClimateData] = useState<Array<{ day: number; temperature: number; humidity: number; pressure: number }>>([])

  const handleCellClick = useCallback((cellIndex: number) => {
    setSelectedCell(cellIndex)
    setSelectedCellLatLon(simulation.getCellLatLon(cellIndex))
  }, [simulation])

  const handleCloseGraph = useCallback(() => {
    setSelectedCell(null)
    setSelectedCellLatLon(null)
    setClimateData([])
  }, [])

  const handleDataFetched = useCallback((data: Array<{ day: number; temperature: number; humidity: number; pressure: number }>) => {
    setClimateData(data)
  }, [])

  return (
    <main style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas camera={{ position: [2, 1, 2], fov: 60 }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <OrbitControls enablePan={false} />

        <GizmoHelper alignment="top-right" margin={[60, 60]}>
          <GizmoViewport />
        </GizmoHelper>

        {/* Climate simulation */}
        <Scene
          simulation={simulation}
          planetConfig={planetConfig}
          showLatLonGrid={showLatLonGrid}
          hoveredCell={hoveredCell}
          selectedCell={selectedCell}
          onHoverCell={setHoveredCell}
          onCellClick={handleCellClick}
        />

        {/* Climate data fetcher - needs to be inside Canvas to access gl context */}
        <ClimateDataFetcher simulation={simulation} cellIndex={selectedCell} onDataFetched={handleDataFetched} />
      </Canvas>

      {/* Info panel */}
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', background: 'rgba(0,0,0,0.5)', padding: '8px', fontFamily: 'monospace' }}>
        <dl style={{ margin: 0 }}>
          <dt>Cells</dt>
          <dd>{simulation.getCellCount()}</dd>
          <dt>Time samples</dt>
          <dd>{simulation.getTimeSamples()}</dd>
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

      {/* Climate graph - rendered outside Canvas */}
      {selectedCell !== null && climateData.length > 0 && selectedCellLatLon && (
        <ClimateGraph
          data={climateData}
          cellIndex={selectedCell}
          cellLatLon={selectedCellLatLon}
          onClose={handleCloseGraph}
        />
      )}
    </main>
  );
}

export default App;

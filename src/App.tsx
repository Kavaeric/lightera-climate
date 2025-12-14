import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { TextureGridSimulation } from './util/TextureGridSimulation'
import { PlanetRenderer } from './components/PlanetRenderer'
import { PlanetInteraction } from './components/PlanetInteraction'
import { ReferenceGridOverlay } from './components/ReferenceGridOverlay'
import { ClimateSimulationEngine } from './components/ClimateSimulationEngine'
import { ClimateDataChart } from './components/ClimateDataChart'
import { DEFAULT_PLANET_CONFIG, type PlanetConfig } from './config/planetConfig'
import { DEFAULT_SIMULATION_CONFIG, type SimulationConfig } from './config/simulationConfig'
import { DEFAULT_DISPLAY_CONFIG, type DisplayConfig } from './config/displayConfig'

interface SceneProps {
  simulation: TextureGridSimulation
  planetConfig: PlanetConfig
  simulationConfig: SimulationConfig
  displayConfig: DisplayConfig
  showLatLonGrid: boolean
  hoveredCell: number | null
  selectedCell: number | null
  onHoverCell: (cellIndex: number | null) => void
  onCellClick: (cellIndex: number) => void
}

function Scene({ simulation, planetConfig, simulationConfig, displayConfig, showLatLonGrid, hoveredCell, selectedCell, onHoverCell, onCellClick }: SceneProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  return (
    <>
      {/* Climate solver - computes temperature for all time samples */}
      <ClimateSimulationEngine
        simulation={simulation}
        solarFlux={planetConfig.solarFlux}
        albedo={planetConfig.albedo}
        emissivity={planetConfig.emissivity}
        subsolarPoint={planetConfig.subsolarPoint}
        rotationsPerYear={planetConfig.rotationsPerYear}
        cosmicBackgroundTemp={planetConfig.cosmicBackgroundTemp}
        yearLength={planetConfig.yearLength}
        iterations={simulationConfig.iterations}
        surfaceHeatCapacity={planetConfig.surfaceHeatCapacity}
        thermalConductivity={simulationConfig.groundDiffusion}
      />

      {/* Visible geometry - reads from climate data */}
      <PlanetRenderer
        ref={meshRef}
        subdivisions={simulationConfig.resolution}
        radius={1}
        simulation={simulation}
        valueRange={displayConfig.temperatureRange}
        hoveredCellIndex={hoveredCell}
        selectedCellIndex={selectedCell}
      />

      {/* Cell picker */}
      <PlanetInteraction
        simulation={simulation}
        meshRef={meshRef}
        onHoverCell={onHoverCell}
        onCellClick={onCellClick}
      />

      {/* Lat/Lon grid overlay */}
      <ReferenceGridOverlay
        segments={displayConfig.gridSegments}
        visible={showLatLonGrid}
        latitudeLines={displayConfig.latitudeLines}
        longitudeLines={displayConfig.longitudeLines}
      />
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
    return new TextureGridSimulation(DEFAULT_SIMULATION_CONFIG)
  }, [])

  // Configuration objects
  const [planetConfig] = useState<PlanetConfig>(DEFAULT_PLANET_CONFIG)
  const [simulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG)
  const [displayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG)

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
          simulationConfig={simulationConfig}
          displayConfig={displayConfig}
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
        <ClimateDataChart
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

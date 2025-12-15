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
        planetConfig={planetConfig}
        simulationConfig={simulationConfig}
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
  // UI configuration objects (mutable via input fields)
  const [pendingPlanetConfig, setPendingPlanetConfig] = useState<PlanetConfig>(DEFAULT_PLANET_CONFIG)
  const [pendingSimulationConfig, setPendingSimulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG)
  const [displayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG)

  // Active configuration objects (only updated when "Run simulation" is clicked)
  const [activeSimulationConfig, setActiveSimulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG)
  const [activePlanetConfig, setActivePlanetConfig] = useState<PlanetConfig>(DEFAULT_PLANET_CONFIG)
  const [simulationKey, setSimulationKey] = useState(0)

  // Create climate simulation - recreate only when activeSimulationConfig changes (i.e., on button click)
  const simulation = useMemo(() => {
    return new TextureGridSimulation(activeSimulationConfig)
  }, [activeSimulationConfig])

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
          key={simulationKey}
          simulation={simulation}
          planetConfig={activePlanetConfig}
          simulationConfig={activeSimulationConfig}
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
      <div style={{ position: 'absolute', top: 10, left: 10, width: '380px', height: '100vdh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '8px', fontFamily: 'monospace' }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2>Simulation settings</h2>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Resolution</span>
            <input
              type="number"
              value={pendingSimulationConfig.resolution}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setPendingSimulationConfig({ ...pendingSimulationConfig, resolution: isNaN(val) ? pendingSimulationConfig.resolution : val });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Time samples per orbit</span>
            <input
              type="number"
              value={pendingSimulationConfig.timeSamples}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setPendingSimulationConfig({ ...pendingSimulationConfig, timeSamples: isNaN(val) ? pendingSimulationConfig.timeSamples : val });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Iterations</span>
            <input
              type="number"
              value={pendingSimulationConfig.iterations}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setPendingSimulationConfig({ ...pendingSimulationConfig, iterations: isNaN(val) ? pendingSimulationConfig.iterations : val });
              }}
            />
          </label>
          <br />
          <h2>Planet settings</h2>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Solar flux (W/m²)</span>
            <input
              type="number"
              step="1"
              min="0"
              value={pendingPlanetConfig.solarFlux}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setPendingPlanetConfig({ ...pendingPlanetConfig, solarFlux: isNaN(val) ? pendingPlanetConfig.solarFlux : val });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Albedo (0-1)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={pendingPlanetConfig.albedo}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setPendingPlanetConfig({ ...pendingPlanetConfig, albedo: isNaN(val) ? pendingPlanetConfig.albedo : val });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Emissivity (0-1)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={pendingPlanetConfig.emissivity}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setPendingPlanetConfig({ ...pendingPlanetConfig, emissivity: isNaN(val) ? pendingPlanetConfig.emissivity : val });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Rotations per orbit</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={pendingPlanetConfig.rotationsPerYear}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setPendingPlanetConfig({ ...pendingPlanetConfig, rotationsPerYear: isNaN(val) ? pendingPlanetConfig.rotationsPerYear : val });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Axial tilt (degrees)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={pendingPlanetConfig.axialTilt}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setPendingPlanetConfig({ ...pendingPlanetConfig, axialTilt: isNaN(val) ? pendingPlanetConfig.axialTilt : val });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Ground conductivity (0-1)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={pendingPlanetConfig.groundConductivity}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setPendingPlanetConfig({ ...pendingPlanetConfig, groundConductivity: isNaN(val) ? pendingPlanetConfig.groundConductivity : val });
              }}
            />
          </label>
          <button
            onClick={() => {
              // Apply pending configs to active configs and restart simulation
              setActiveSimulationConfig(pendingSimulationConfig)
              setActivePlanetConfig(pendingPlanetConfig)
              setSelectedCell(null)
              setSelectedCellLatLon(null)
              setClimateData([])
              setSimulationKey((prev) => prev + 1)
            }}
          >
            Run simulation
          </button>
        </section>
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

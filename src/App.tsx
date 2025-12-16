import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { TextureGridSimulation } from './util/TextureGridSimulation'
import { PlanetRenderer } from './components/PlanetRenderer'
import { CellHighlightOverlay } from './components/CellHighlightOverlay'
import { PlanetInteraction } from './components/PlanetInteraction'
import { ReferenceGridOverlay } from './components/ReferenceGridOverlay'
import { ClimateSimulationEngine } from './components/ClimateSimulationEngine'
import { ClimateDataChart } from './components/ClimateDataChart'
import { DEFAULT_PLANET_CONFIG, type PlanetConfig } from './config/planetConfig'
import { DEFAULT_SIMULATION_CONFIG, type SimulationConfig } from './config/simulationConfig'
import { DEFAULT_DISPLAY_CONFIG, type DisplayConfig } from './config/displayConfig'
import { SimulationProvider, useSimulation } from './context/SimulationContext'
import type { TerrainConfig } from './config/terrainConfig'
import { TerrainDataLoader } from './util/TerrainDataLoader'

interface SceneProps {
  simulation: TextureGridSimulation
  displayConfig: DisplayConfig
  showLatLonGrid: boolean
  hoveredCell: number | null
  selectedCell: number | null
  onHoverCell: (cellIndex: number | null) => void
  onCellClick: (cellIndex: number) => void
}

function Scene({ simulation, displayConfig, showLatLonGrid, hoveredCell, selectedCell, onHoverCell, onCellClick }: SceneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const highlightRef = useRef<THREE.Mesh>(null)
  const { activeSimulationConfig, activePlanetConfig } = useSimulation()

  return (
    <>
      {/* Climate solver - computes temperature for all time samples */}
      <ClimateSimulationEngine
        simulation={simulation}
        planetConfig={activePlanetConfig}
        simulationConfig={activeSimulationConfig}
      />

      {/* Visible geometry - pure data visualization */}
      <PlanetRenderer
        ref={meshRef}
        subdivisions={activeSimulationConfig.resolution}
        radius={1}
        simulation={simulation}
        displayConfig={displayConfig}
      />

      {/* Cell highlighting overlay - separate mesh for interaction feedback */}
      <CellHighlightOverlay
        ref={highlightRef}
        subdivisions={activeSimulationConfig.resolution}
        radius={1}
        simulation={simulation}
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

function AppContent() {
  // UI configuration objects (mutable via input fields)
  const [pendingPlanetConfig, setPendingPlanetConfig] = useState<PlanetConfig>(DEFAULT_PLANET_CONFIG)
  const [pendingSimulationConfig, setPendingSimulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG)
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG)
  const [terrainConfig, setTerrainConfig] = useState<TerrainConfig | null>(null)

  // Get active config and simulation state from context
  const { activeSimulationConfig, simulationKey, simulationStatus, runSimulation } = useSimulation()

  // Create climate simulation - recreate only when activeSimulationConfig changes (i.e., on button click)
  const simulation = useMemo(() => {
    return new TextureGridSimulation(activeSimulationConfig)
  }, [activeSimulationConfig])

  // Load terrain and apply to simulation
  useEffect(() => {
    if (terrainConfig && simulation) {
      simulation.setTerrainData(terrainConfig)
    }
  }, [terrainConfig, simulation])

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
      <div style={{ position: 'absolute', width: '280px', height: '100dvh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '12px', fontFamily: 'monospace' }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2>Terrain settings</h2>
          <button
            onClick={async () => {
              // Generate procedural terrain with a random seed
              const loader = new TerrainDataLoader()
              const cellLatLons = Array.from({ length: simulation.getCellCount() }, (_, i) => {
                const cell = simulation.getCellLatLon(i)
                return { lat: cell.lat, lon: cell.lon }
              })
              const seed = Math.floor(Math.random() * 1000000)
              const terrain = loader.generateProcedural(simulation.getCellCount(), cellLatLons, seed)
              setTerrainConfig(terrain)
              console.log(`Generated procedural terrain with seed ${seed}`)
            }}
          >
            Generate procedural terrain
          </button>
          <button
            onClick={() => {
              // Create file input for image upload
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/png,image/jpeg'
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (!file) return
                try {
                  const loader = new TerrainDataLoader()
                  const cellLatLons = Array.from({ length: simulation.getCellCount() }, (_, i) => {
                    const cell = simulation.getCellLatLon(i)
                    return { lat: cell.lat, lon: cell.lon }
                  })
                  const url = URL.createObjectURL(file)
                  const terrain = await loader.loadFromHeightmap(url, simulation.getCellCount(), cellLatLons, {
                    elevationScale: 1000, // meters per pixel value
                  })
                  setTerrainConfig(terrain)
                  URL.revokeObjectURL(url)
                  console.log('Loaded heightmap from file')
                } catch (err) {
                  console.error('Failed to load heightmap:', err)
                }
              }
              input.click()
            }}
          >
            Load heightmap from file
          </button>
          <br />
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
              runSimulation(pendingSimulationConfig, pendingPlanetConfig)
              setSelectedCell(null)
              setSelectedCellLatLon(null)
              setClimateData([])
            }}
          >
            Run simulation
          </button>
        </section>
        <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.3)' }} />
        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2>Status</h2>
          <span>{simulationStatus}</span>
        </section>
        <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.3)' }} />
        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2>Display settings</h2>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Visualisation mode</span>
            <select
              value={displayConfig.visualisationMode}
              onChange={(e) => {
                setDisplayConfig({
                  ...displayConfig,
                  visualisationMode: e.target.value as 'temperature' | 'elevation' | 'waterDepth' | 'salinity' | 'albedo',
                })
              }}
            >
              <option value="temperature">Temperature</option>
              <option value="elevation">Elevation (greyscale)</option>
              <option value="waterDepth">Water depth (greyscale)</option>
              <option value="salinity">Salinity (greyscale)</option>
              <option value="albedo">Surface albedo</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Temperature range min (K)</span>
            <input
              type="number"
              step="1"
              value={displayConfig.temperatureRange.min}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setDisplayConfig({
                  ...displayConfig,
                  temperatureRange: {
                    ...displayConfig.temperatureRange,
                    min: isNaN(val) ? displayConfig.temperatureRange.min : val,
                  },
                });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Temperature range max (K)</span>
            <input
              type="number"
              step="1"
              value={displayConfig.temperatureRange.max}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setDisplayConfig({
                  ...displayConfig,
                  temperatureRange: {
                    ...displayConfig.temperatureRange,
                    max: isNaN(val) ? displayConfig.temperatureRange.max : val,
                  },
                });
              }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showLatLonGrid}
              onChange={(e) => setShowLatLonGrid(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Show latitude and longitude grid</span>
          </label>
        </section>
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

function App() {
  return (
    <SimulationProvider>
      <AppContent />
    </SimulationProvider>
  )
}

export default App;

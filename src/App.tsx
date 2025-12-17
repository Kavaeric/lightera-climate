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
import { TerrainDataLoader } from './util/TerrainDataLoader'
import { HydrologyInitializer } from './util/HydrologyInitializer'

interface SceneProps {
  simulation: TextureGridSimulation
  displayConfig: DisplayConfig
  showLatLonGrid: boolean
  hoveredCell: number | null
  selectedCell: number | null
  onHoverCell: (cellIndex: number | null) => void
  onCellClick: (cellIndex: number) => void
  stepsPerFrame: number
}

function Scene({ simulation, displayConfig, showLatLonGrid, hoveredCell, selectedCell, onHoverCell, onCellClick, stepsPerFrame }: SceneProps) {
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
        stepsPerFrame={stepsPerFrame}
      />

      {/* Visible geometry - pure data visualisation */}
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

// Helper component to fetch climate and hydrology data (stays inside Canvas for gl access)
function ClimateDataFetcher({
  simulation,
  cellIndex,
  onDataFetched,
}: {
  simulation: TextureGridSimulation
  cellIndex: number | null
  onDataFetched: (data: Array<{ day: number; temperature: number; humidity: number; pressure: number; waterDepth: number; iceThickness: number; salinity: number }>) => void
}) {
  const { gl } = useThree()

  useEffect(() => {
    if (cellIndex === null) {
      onDataFetched([])
      return
    }

    const fetchData = async () => {
      const climateData = await simulation.getClimateDataForCell(cellIndex, gl)
      const hydrologyData = await simulation.getHydrologyDataForCell(cellIndex, gl)
      // Since we no longer store time series, just show current state as a single data point
      const formattedData = [{
        day: 0,
        ...climateData,
        ...hydrologyData,
      }]
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
  const [seaLevel] = useState(0)
  // const [seaLevel, setSeaLevel] = useState(0)
  const [stepsPerFrame, setStepsPerFrame] = useState(500)

  // UI state
  const [showLatLonGrid, setShowLatLonGrid] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<number | null>(null)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [selectedCellLatLon, setSelectedCellLatLon] = useState<{ lat: number; lon: number } | null>(null)
  const [climateData, setClimateData] = useState<Array<{ day: number; temperature: number; humidity: number; pressure: number; waterDepth: number; iceThickness: number; salinity: number }>>([])

  // Get active config and simulation state from context
  const { activeSimulationConfig, simulationKey, simulationStatus, isRunning, newSimulation, play, pause, stepOnce } = useSimulation()

  // Create climate simulation - recreate only when activeSimulationConfig changes (i.e., on button click)
  const simulation = useMemo(() => {
    return new TextureGridSimulation(activeSimulationConfig)
  }, [activeSimulationConfig])

  // Generate terrain and hydrology when simulation is created
  useEffect(() => {
    if (!simulation) return

    // Generate random terrain
    const terrainLoader = new TerrainDataLoader()
    const hydrologyInit = new HydrologyInitializer()

    // Use simulationKey as seed for reproducible randomness
    const seed = simulationKey
    const cellCount = simulation.getCellCount()

    // Get cell lat/lons
    const cellLatLons: Array<{ lat: number; lon: number }> = []
    for (let i = 0; i < cellCount; i++) {
      cellLatLons.push(simulation.getCellLatLon(i))
    }

    // Generate procedural terrain
    const terrain = terrainLoader.generateProcedural(cellCount, cellLatLons, seed)
    simulation.setTerrainData(terrain)

    // Initialize hydrology from elevation (creates oceans below sea level)
    const hydrology = hydrologyInit.initializeFromElevation(terrain.elevation, seaLevel)
    simulation.setHydrologyData(hydrology.waterDepth, hydrology.salinity, hydrology.iceThickness)

    console.log(`Generated new terrain with seed ${seed}, sea level ${seaLevel}m`)
  }, [simulation, simulationKey, seaLevel])

  const handleCellClick = useCallback((cellIndex: number) => {
    setSelectedCell(cellIndex)
    setSelectedCellLatLon(simulation.getCellLatLon(cellIndex))
  }, [simulation])

  const handleCloseGraph = useCallback(() => {
    setSelectedCell(null)
    setSelectedCellLatLon(null)
    setClimateData([])
  }, [])

  const handleDataFetched = useCallback((data: Array<{ day: number; temperature: number; humidity: number; pressure: number; waterDepth: number; iceThickness: number; salinity: number }>) => {
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
          stepsPerFrame={stepsPerFrame}
        />

        {/* Climate data fetcher - needs to be inside Canvas to access gl context */}
        <ClimateDataFetcher simulation={simulation} cellIndex={selectedCell} onDataFetched={handleDataFetched} />
      </Canvas>

      {/* Info panel */}
      <div style={{ position: 'absolute', width: '280px', height: '100dvh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '12px', fontFamily: 'monospace' }}>
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
            <span>Physics steps per orbit</span>
            <input
              type="number"
              value={pendingSimulationConfig.stepsPerOrbit}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setPendingSimulationConfig({ ...pendingSimulationConfig, stepsPerOrbit: isNaN(val) ? pendingSimulationConfig.stepsPerOrbit : val });
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
              // Create new simulation with configs (doesn't start running)
              newSimulation(pendingSimulationConfig, pendingPlanetConfig)
              setSelectedCell(null)
              setSelectedCellLatLon(null)
              setClimateData([])
            }}
          >
            New simulation
          </button>
        </section>
        <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.3)' }} />
        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2>Controls</h2>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Steps per frame</span>
            <input
              type="number"
              min="1"
              value={stepsPerFrame}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setStepsPerFrame(isNaN(val) ? stepsPerFrame : Math.max(1, val));
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={play} disabled={isRunning}>
              Play
            </button>
            <button onClick={pause} disabled={!isRunning}>
              Pause
            </button>
            <button onClick={stepOnce}>
              Step once
            </button>
          </div>
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
                  visualisationMode: e.target.value as 'temperature' | 'elevation' | 'waterDepth' | 'salinity' | 'iceThickness' | 'albedo',
                })
              }}
            >
              <option value="temperature">Temperature</option>
              <option value="elevation">Elevation (greyscale)</option>
              <option value="waterDepth">Water depth</option>
              <option value="salinity">Salinity (greyscale)</option>
              <option value="iceThickness">Ice thickness</option>
              <option value="albedo">Albedo (greyscale)</option>
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
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Ice thickness range min (m)</span>
            <input
              type="number"
              step="1"
              value={displayConfig.iceThicknessRange.min}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setDisplayConfig({
                  ...displayConfig,
                  iceThicknessRange: {
                    ...displayConfig.iceThicknessRange,
                    min: isNaN(val) ? displayConfig.iceThicknessRange.min : val,
                  },
                });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Ice thickness range max (m)</span>
            <input
              type="number"
              step="1"
              value={displayConfig.iceThicknessRange.max}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setDisplayConfig({
                  ...displayConfig,
                  iceThicknessRange: {
                    ...displayConfig.iceThicknessRange,
                    max: isNaN(val) ? displayConfig.iceThicknessRange.max : val,
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

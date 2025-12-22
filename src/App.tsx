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
import { SimulationProvider } from './context/SimulationContext'
import { DisplayConfigProvider } from './context/DisplayConfigProvider'
import { useSimulation } from './context/useSimulation'
import { useDisplayConfig } from './context/useDisplayConfig'
import { TerrainDataLoader } from './util/TerrainDataLoader'
import { HydrologyInitialiser } from './util/HydrologyInitialiser'

interface SceneProps {
  simulation: TextureGridSimulation
  showLatLonGrid: boolean
  hoveredCell: number | null
  selectedCell: number | null
  onHoverCell: (cellIndex: number | null) => void
  onCellClick: (cellIndex: number) => void
  stepsPerFrame: number
  samplesPerOrbit: number
}

function Scene({ simulation, showLatLonGrid, hoveredCell, selectedCell, onHoverCell, onCellClick, stepsPerFrame, samplesPerOrbit }: SceneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const highlightRef = useRef<THREE.Mesh>(null)
  const { activeSimulationConfig, activePlanetConfig } = useSimulation()
  const { displayConfig } = useDisplayConfig()

  return (
    <>
      {/* Climate solver - computes surface temperature for all time samples */}
      <ClimateSimulationEngine
        simulation={simulation}
        planetConfig={activePlanetConfig}
        simulationConfig={activeSimulationConfig}
        stepsPerFrame={stepsPerFrame}
        samplesPerOrbit={samplesPerOrbit}
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
        colour={displayConfig.gridColour}
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
  onDataFetched: (data: Array<{ day: number; surfaceTemperature: number; atmosphericTemperature: number; atmosphericPressure: number; waterDepth: number; iceThickness: number; salinity: number; albedo: number; elevation: number }>) => void
}) {
  const { gl } = useThree()
  const { getRecorder } = useSimulation()

  useEffect(() => {
    if (cellIndex === null) {
      onDataFetched([])
      return
    }

    const fetchData = async () => {
      const recorder = getRecorder()
      
      // Always get current hydrology, surface, atmosphere, and terrain data (not time-series, just current state)
      const hydrologyData = await simulation.getHydrologyDataForCell(cellIndex, gl)
      const surfaceData = await simulation.getSurfaceDataForCell(cellIndex, gl)
      const atmosphereData = await simulation.getAtmosphereDataForCell(cellIndex, gl)
      const terrainData = simulation.getTerrainDataForCell(cellIndex)
      
      // Try to get complete orbit surface temperature data from recorder
      if (recorder && recorder.hasCompleteOrbit()) {
        const surfaceTemperatures = await recorder.getCompleteOrbitSurfaceTemperatureForCell(cellIndex)
        
        if (surfaceTemperatures && surfaceTemperatures.length > 0) {
          // Format as time series data (sample index as "day")
          // Use current hydrology, surface, atmosphere, and terrain data for all samples (since it's not time-series)
          const formattedData = surfaceTemperatures.map((surfaceTemp, index) => ({
            day: index,
            surfaceTemperature: surfaceTemp,
            atmosphericTemperature: atmosphereData.atmosphericTemperature,
            atmosphericPressure: atmosphereData.atmosphericPressure,
            waterDepth: hydrologyData.waterDepth,
            iceThickness: hydrologyData.iceThickness,
            salinity: hydrologyData.salinity,
            albedo: surfaceData.albedo,
            elevation: terrainData.elevation,
          }))
          onDataFetched(formattedData)
          return
        }
      }

      // Fallback: show current state if no complete orbit available
      const climateData = await simulation.getClimateDataForCell(cellIndex, gl)
      const formattedData = [{
        day: 0,
        ...climateData,
        ...atmosphereData,
        ...hydrologyData,
        ...surfaceData,
        ...terrainData,
      }]
      onDataFetched(formattedData)
    }

    fetchData()
  }, [cellIndex, simulation, gl, onDataFetched, getRecorder])

  return null // Don't render anything in the Canvas
}

function AppContent() {
  // UI configuration objects (mutable via input fields)
  const [pendingPlanetConfig, setPendingPlanetConfig] = useState<PlanetConfig>(DEFAULT_PLANET_CONFIG)
  const [pendingSimulationConfig, setPendingSimulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG)
  const { displayConfig, setDisplayConfig } = useDisplayConfig()
  const [seaLevel] = useState(0)
  // const [seaLevel, setSeaLevel] = useState(0)
  const [stepsPerFrame, setStepsPerFrame] = useState(500)
  const [samplesPerOrbit, setSamplesPerOrbit] = useState(50)

  // UI state
  const [showLatLonGrid, setShowLatLonGrid] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<number | null>(null)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [selectedCellLatLon, setSelectedCellLatLon] = useState<{ lat: number; lon: number } | null>(null)
  const [climateData, setClimateData] = useState<Array<{ day: number; surfaceTemperature: number; atmosphericTemperature: number; atmosphericPressure: number; waterDepth: number; iceThickness: number; salinity: number; albedo: number; elevation: number }>>([])

  // Get active config and simulation state from context
  const { activeSimulationConfig, simulationKey, isRunning, error, clearError, newSimulation, play, pause, stepOnce, getOrchestrator } = useSimulation()

  // Track simulation progress from orchestrator
  const [simulationProgress, setSimulationProgress] = useState<{ orbitIdx: number; physicsStep: number } | null>(null)

  // Poll orchestrator for progress updates
  useEffect(() => {
    let mounted = true

    const updateProgress = () => {
      if (!mounted) return
      const orchestrator = getOrchestrator()
      if (orchestrator) {
        const progress = orchestrator.getProgress()
        setSimulationProgress({
          orbitIdx: progress.orbitIdx,
          physicsStep: progress.physicsStep,
        })
      } else {
        setSimulationProgress(null)
      }
    }

    // Initial update
    updateProgress()

    // Update progress periodically - polling external system (orchestrator)
    const intervalId = setInterval(updateProgress, 17) // Update every 17ms (60fps)

    return () => {
      mounted = false
      clearInterval(intervalId)
    }
  }, [getOrchestrator, simulationKey, isRunning])

  // Create climate simulation - recreate only when activeSimulationConfig changes (i.e., on button click)
  const simulation = useMemo(() => {
    return new TextureGridSimulation(activeSimulationConfig)
  }, [activeSimulationConfig])

  // Generate terrain and hydrology when simulation is created
  useEffect(() => {
    if (!simulation) return

    // Generate random terrain
    const terrainLoader = new TerrainDataLoader()
    const hydrologyInit = new HydrologyInitialiser()

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

    // Initialise hydrology from elevation (creates oceans below sea level)
    const hydrology = hydrologyInit.initialiseFromElevation(terrain.elevation, seaLevel)
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


  const handleDataFetched = useCallback(
    (
      data: Array<{
        day: number
        surfaceTemperature: number
        atmosphericTemperature: number
        atmosphericPressure: number
        waterDepth: number
        iceThickness: number
        salinity: number
        albedo: number
        elevation: number
      }>
    ) => {

    setClimateData(data)
  }, [])

  return (
    <main style={{ width: '100vw', height: '100vh', background: 'black' }}>
      {/* Error banner */}
      {error && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: 'rgba(220, 38, 38, 0.95)',
          color: 'white',
          padding: '16px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          fontFamily: 'monospace',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠ Simulation Error</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>{error.message}</div>
          </div>
          <button
            onClick={() => clearError()}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              color: 'white',
              padding: '8px 16px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              borderRadius: '4px',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <Canvas camera={{ position: [2, 1, 2], fov: 60 }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <OrbitControls enablePan={false} />

        <GizmoHelper alignment="top-right" margin={[60, 60]}>
          <GizmoViewport />
        </GizmoHelper>

        {/* Climate simulation */}
        <Scene
          key={simulationKey}
          simulation={simulation}
          showLatLonGrid={showLatLonGrid}
          hoveredCell={hoveredCell}
          selectedCell={selectedCell}
          onHoverCell={setHoveredCell}
          onCellClick={handleCellClick}
          stepsPerFrame={stepsPerFrame}
          samplesPerOrbit={samplesPerOrbit}
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
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Samples per orbit</span>
            <input
              type="number"
              min="1"
              value={samplesPerOrbit}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setSamplesPerOrbit(isNaN(val) ? samplesPerOrbit : Math.max(1, val));
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
          <br />
          <h3 style={{ margin: 0 }}>Atmosphere</h3>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>CO₂ (Pa)</span>
            <input
              type="number"
              step="1"
              min="0"
              value={pendingPlanetConfig.atmosphereConfig?.composition.CO2 ?? 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && pendingPlanetConfig.atmosphereConfig) {
                  setPendingPlanetConfig({
                    ...pendingPlanetConfig,
                    atmosphereConfig: {
                      ...pendingPlanetConfig.atmosphereConfig,
                      composition: {
                        ...pendingPlanetConfig.atmosphereConfig.composition,
                        CO2: val,
                      },
                    },
                  });
                }
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>N₂ (Pa)</span>
            <input
              type="number"
              step="1"
              min="0"
              value={pendingPlanetConfig.atmosphereConfig?.composition.N2 ?? 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && pendingPlanetConfig.atmosphereConfig) {
                  setPendingPlanetConfig({
                    ...pendingPlanetConfig,
                    atmosphereConfig: {
                      ...pendingPlanetConfig.atmosphereConfig,
                      composition: {
                        ...pendingPlanetConfig.atmosphereConfig.composition,
                        N2: val,
                      },
                    },
                  });
                }
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>O₂ (Pa)</span>
            <input
              type="number"
              step="1"
              min="0"
              value={pendingPlanetConfig.atmosphereConfig?.composition.O2 ?? 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && pendingPlanetConfig.atmosphereConfig) {
                  setPendingPlanetConfig({
                    ...pendingPlanetConfig,
                    atmosphereConfig: {
                      ...pendingPlanetConfig.atmosphereConfig,
                      composition: {
                        ...pendingPlanetConfig.atmosphereConfig.composition,
                        O2: val,
                      },
                    },
                  });
                }
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Ar (Pa)</span>
            <input
              type="number"
              step="1"
              min="0"
              value={pendingPlanetConfig.atmosphereConfig?.composition.Ar ?? 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && pendingPlanetConfig.atmosphereConfig) {
                  setPendingPlanetConfig({
                    ...pendingPlanetConfig,
                    atmosphereConfig: {
                      ...pendingPlanetConfig.atmosphereConfig,
                      composition: {
                        ...pendingPlanetConfig.atmosphereConfig.composition,
                        Ar: val,
                      },
                    },
                  });
                }
              }}
            />
          </label>
          <button
            onClick={() => {
              // Create new simulation with configs
              clearError()
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
            <button onClick={stepOnce} disabled={isRunning}>
              Step once
            </button>
          </div>
        </section>
        <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.3)' }} />
        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2>Status</h2>
          <span>{isRunning ? 'Running' : 'Paused'}</span>
          {simulationProgress !== null ? (
            <>
              <span>Orbit {simulationProgress.orbitIdx}</span>
              <span>Physics step {simulationProgress.physicsStep} of {activeSimulationConfig.stepsPerOrbit}</span>
            </>
          ) : (
            <>
              <span>Orbit -</span>
              <span>Physics step - of {activeSimulationConfig.stepsPerOrbit}</span>
            </>
          )}
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
                  visualisationMode: e.target.value as 'terrain' | 'surfaceTemperature' | 'atmosphericTemperature' | 'elevation' | 'waterDepth' | 'salinity' | 'iceThickness' | 'albedo',
                })
              }}
            >
              <option value="terrain">Terrain</option>
              <option value="surfaceTemperature">Surface temperature</option>
              <option value="atmosphericTemperature">Atmospheric temperature</option>
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
              value={displayConfig.surfaceTemperatureRange.min}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setDisplayConfig({
                  ...displayConfig,
                  surfaceTemperatureRange: {
                    ...displayConfig.surfaceTemperatureRange,
                    min: isNaN(val) ? displayConfig.surfaceTemperatureRange.min : val,
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
              value={displayConfig.surfaceTemperatureRange.max}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setDisplayConfig({
                  ...displayConfig,
                  surfaceTemperatureRange: {
                    ...displayConfig.surfaceTemperatureRange,
                    max: isNaN(val) ? displayConfig.surfaceTemperatureRange.max : val,
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
      <DisplayConfigProvider>
        <AppContent />
      </DisplayConfigProvider>
    </SimulationProvider>
  )
}

export default App;

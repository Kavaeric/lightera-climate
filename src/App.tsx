import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { TextureGridSimulation } from './util/TextureGridSimulation'
import { PlanetRenderer } from './components/PlanetRenderer'
import { CellHighlightOverlay } from './components/CellHighlightOverlay'
//import { ReferenceGridOverlay } from './components/ReferenceGridOverlay'
import { createClimateEngine } from './engine/createClimateEngine'
import { ClimateDataChart } from './components/ClimateDataChart'
import { ORBITAL_CONFIG_EARTH, type OrbitalConfig } from './config/orbital'
import { SIMULATION_CONFIG_DEFAULT, type SimulationConfig } from './config/simulationConfig'
import { PLANETARY_CONFIG_EARTH, type PlanetaryConfig } from './config/planetary'
import { SimulationProvider } from './context/SimulationContext'
import { DisplayConfigProvider } from './context/DisplayConfigProvider'
import { useSimulation } from './context/useSimulation'
import { useDisplayConfig } from './context/useDisplayConfig'
import { TerrainDataLoader } from './util/TerrainDataLoader'
import { HydrologyInitialiser } from './util/HydrologyInitialiser'
import type { VisualisationModeId } from './types/visualisationModes'
import { VISUALISATION_MODES } from './config/visualisationModes'
import { LatLonGrid } from './components/LatLonGrid'

interface SceneProps {
  simulation: TextureGridSimulation
  hoveredCell: number | null
  selectedCell: number | null
  onHoverCell: (cellIndex: number | null) => void
  onCellClick: (cellIndex: number) => void
  stepsPerFrame: number
  samplesPerOrbit: number
}

function Scene({ simulation, hoveredCell, selectedCell, onHoverCell, onCellClick, stepsPerFrame, samplesPerOrbit }: SceneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const highlightRef = useRef<THREE.Mesh>(null)
  const { gl } = useThree()
  const {
    activeSimulationConfig,
    activeOrbitalConfig,
    activePlanetaryConfig,
    simulationKey,
    registerOrchestrator,
    registerRecorder,
    pause,
  } = useSimulation()
  const { displayConfig } = useDisplayConfig()

  // Use ref for stepsPerFrame so changes don't re-initialise the engine
  const stepsPerFrameRef = useRef(stepsPerFrame)
  useEffect(() => {
    stepsPerFrameRef.current = stepsPerFrame
  }, [stepsPerFrame])

  // Initialise climate engine
  useEffect(() => {
    return createClimateEngine({
      gl,
      simulation,
      orbitalConfig: activeOrbitalConfig,
      planetaryConfig: activePlanetaryConfig,
      simulationConfig: activeSimulationConfig,
      getStepsPerFrame: () => stepsPerFrameRef.current,
      samplesPerOrbit,
      registerOrchestrator,
      registerRecorder,
      onError: pause,
    })

  }, [
    gl,
    simulation,
    simulationKey,
    activeSimulationConfig,
    activeOrbitalConfig,
    activePlanetaryConfig,
    samplesPerOrbit,
    registerOrchestrator,
    registerRecorder,
    pause,
  ])

  // WebGL context loss handling
  useEffect(() => {
    const canvas = gl.domElement

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      console.error('[Scene] WebGL context lost')
      pause()
    }

    const handleContextRestored = () => {
      console.log('[Scene] WebGL context restored')
      // Context restored, but would need to reinitialise by incrementing simulationKey to trigger recreation
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
    }
  }, [gl, pause])

  return (
    <>
      {/* Visible geometry - pure data visualisation with built-in interaction */}
      <PlanetRenderer
        ref={meshRef}
        subdivisions={activeSimulationConfig.resolution}
        radius={1}
        simulation={simulation}
        displayConfig={displayConfig}
        onHoverCell={onHoverCell}
        onCellClick={onCellClick}
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
  onDataFetched: (data: Array<{ day: number; surfaceTemperature: number; atmosphericTemperature: number; precipitableWater: number; waterDepth: number; iceThickness: number; salinity: number; albedo: number; elevation: number }>) => void
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
      
      // Try to get complete orbit surface data (temperature and albedo) from recorder
      if (recorder && recorder.hasCompleteOrbit()) {
        const surfaceDataArray = await recorder.getCompleteOrbitSurfaceDataForCell(cellIndex)
        
        if (surfaceDataArray && surfaceDataArray.length > 0) {
          // Format as time series data (sample index as "day")
          // Use current hydrology, atmosphere, and terrain data for all samples (since it's not time-series)
          // Albedo is read from each recorded sample
          const formattedData = surfaceDataArray.map((surface, index) => ({
            day: index,
            surfaceTemperature: surface.temperature,
            atmosphericTemperature: atmosphereData.atmosphericTemperature,
            precipitableWater: atmosphereData.precipitableWater,
            waterDepth: hydrologyData.waterDepth,
            iceThickness: hydrologyData.iceThickness,
            salinity: hydrologyData.salinity,
            albedo: surface.albedo,
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
  const [pendingSimulationConfig, setPendingSimulationConfig] = useState<SimulationConfig>(SIMULATION_CONFIG_DEFAULT)
  const [orbitalConfig, setOrbitalConfig] = useState<OrbitalConfig>(ORBITAL_CONFIG_EARTH)
  const [planetaryConfig] = useState<PlanetaryConfig>(PLANETARY_CONFIG_EARTH)
  const { displayConfig, setDisplayConfig } = useDisplayConfig()
  const [seaLevel] = useState(0)
  // const [seaLevel, setSeaLevel] = useState(0)
  const [stepsPerFrame, setStepsPerFrame] = useState(500)
  const [samplesPerOrbit, setSamplesPerOrbit] = useState(50)
  const [showLatLonGrid, setShowLatLonGrid] = useState(true)

  // UI state
  const [hoveredCell, setHoveredCell] = useState<number | null>(null)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [selectedCellLatLon, setSelectedCellLatLon] = useState<{ lat: number; lon: number } | null>(null)
  const [selectedCellArea, setSelectedCellArea] = useState<number | null>(null)
  const [climateData, setClimateData] = useState<Array<{ day: number; surfaceTemperature: number; atmosphericTemperature: number; precipitableWater: number; waterDepth: number; iceThickness: number; salinity: number; albedo: number; elevation: number }>>([])

  // Get active config and simulation state from context
  const { activeSimulationConfig, activePlanetaryConfig, simulationKey, isRunning, newSimulation, play, pause, getOrchestrator } = useSimulation()

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
    // Area is calculated on unit sphere, scale by planet radius² to get actual area in m²
    const unitSphereArea = simulation.getCellArea(cellIndex)
    const actualArea = unitSphereArea * activePlanetaryConfig.radius * activePlanetaryConfig.radius
    setSelectedCellArea(actualArea)
  }, [simulation, activePlanetaryConfig])

  const handleCloseGraph = useCallback(() => {
    setSelectedCell(null)
    setSelectedCellLatLon(null)
    setSelectedCellArea(null)
    setClimateData([])
  }, [])


  const handleDataFetched = useCallback(
    (
      data: Array<{
        day: number
        surfaceTemperature: number
        atmosphericTemperature: number
        precipitableWater: number
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
      <Canvas camera={{ position: [2, 1, 2], fov: 60 }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <OrbitControls enablePan={false} />

        <GizmoHelper alignment="top-right" margin={[60, 60]}>
          <GizmoViewport />
        </GizmoHelper>

        {/* Climate simulation */}
        <Scene
          key={simulationKey}
          simulation={simulation}
          hoveredCell={hoveredCell}
          selectedCell={selectedCell}
          onHoverCell={setHoveredCell}
          onCellClick={handleCellClick}
          stepsPerFrame={stepsPerFrame}
          samplesPerOrbit={samplesPerOrbit}
        />

        {/* Climate data fetcher - needs to be inside Canvas to access gl context */}
        <ClimateDataFetcher simulation={simulation} cellIndex={selectedCell} onDataFetched={handleDataFetched} />
        
        {/* Lat/Lon grid overlay */}
        <LatLonGrid
          visible={showLatLonGrid}
          axialTilt={orbitalConfig.axialTilt}
        />
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
          <h2>Orbital settings</h2>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Solar flux (W/m²)</span>
            <input
              type="number"
              step="1"
              min="0"
              value={orbitalConfig.solarFlux}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOrbitalConfig({ ...orbitalConfig, solarFlux: isNaN(val) ? orbitalConfig.solarFlux : val });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Axial tilt (°)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="90"
              value={orbitalConfig.axialTilt}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOrbitalConfig({ ...orbitalConfig, axialTilt: isNaN(val) ? orbitalConfig.axialTilt : val });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Year length (s)</span>
            <input
              type="number"
              step="1"
              min="0"
              value={orbitalConfig.yearLength}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOrbitalConfig({ ...orbitalConfig, yearLength: isNaN(val) ? orbitalConfig.yearLength : val });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>Rotations per year</span>
            <input
              type="number"
              step="1"
              min="0"
              value={orbitalConfig.rotationsPerYear}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOrbitalConfig({ ...orbitalConfig, rotationsPerYear: isNaN(val) ? orbitalConfig.rotationsPerYear : val });
              }}
            />
          </label>

          {/* TODO: Currently you can't change simulation settings without creating a new simulation
                    Being able to change sim/planet settings on the fly would be fun. */}
          <button
            onClick={() => {
              newSimulation(pendingSimulationConfig, orbitalConfig, planetaryConfig)
              setSelectedCell(null)
              setSelectedCellLatLon(null)
              setSelectedCellArea(null)
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
                  visualisationMode: e.target.value as VisualisationModeId,
                })
              }}
            >
              {Object.values(VISUALISATION_MODES).map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.name}</option>
              ))}
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
              onChange={() => setShowLatLonGrid(!showLatLonGrid)}
              style={{ cursor: 'pointer' }}
            />
            <span>Show latitude and longitude grid</span>
          </label>
        </section>
      </div>

      {/* Climate graph - rendered outside Canvas */}
      {selectedCell !== null && climateData.length > 0 && selectedCellLatLon && selectedCellArea !== null && (
        <ClimateDataChart
          data={climateData}
          cellIndex={selectedCell}
          cellLatLon={selectedCellLatLon}
          cellArea={selectedCellArea}
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

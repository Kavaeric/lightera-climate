import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { TextureGridSimulation } from './climate/engine/TextureGridSimulation';
import { ClimateScene } from './components/ClimateScene';
import { ClimateOverlays } from './components/ClimateOverlays';
import { ClimateSceneControls } from './components/ClimateSceneControls';
import { ClimateDataFetcher } from './components/ClimateDataFetcher';
import { ClimateEngine } from './components/ClimateEngine';
import { SidePanel } from './components/SidePanel';
import { CanvasView } from './components/CanvasView';
import { ClimateDataChart } from './components/ClimateDataChart';
import { PLANETARY_CONFIG_EARTH, type PlanetaryConfig } from './config/planetaryConfig';
import { SimulationProvider } from './context/SimulationContext';
import { DisplayConfigProvider } from './context/DisplayConfigProvider';
import { SimulationConfigProvider } from './context/SimulationConfigProvider';
import { OrbitalConfigProvider } from './context/OrbitalConfigProvider';
import { RuntimeControlsProvider } from './context/RuntimeControlsProvider';
import { UIStateProvider } from './context/UIStateProvider';
import { useSimulation } from './context/useSimulation';
import { useDisplayConfig } from './context/useDisplayConfig';
import { useSimulationConfig } from './context/SimulationConfigProvider';
import { useOrbitalConfig } from './context/OrbitalConfigProvider';
import { useRuntimeControls } from './context/RuntimeControlsProvider';
import { useUIState } from './context/UIStateProvider';
import { TerrainDataLoader } from './terrain/TerrainDataLoader';
import { HydrologyInitialiser } from './climate/hydrology/HydrologyInitialiser';

function ClimateApp() {
  // Get state from hooks
  const { pendingSimulationConfig } = useSimulationConfig();
  const { orbitalConfig } = useOrbitalConfig();
  const { displayConfig, showLatLonGrid } = useDisplayConfig();
  const { stepsPerFrame, samplesPerOrbit } = useRuntimeControls();
  const {
    hoveredCell,
    setHoveredCell,
    selectedCell,
    selectedCellLatLon,
    setSelectedCellLatLon,
    selectedCellArea,
    setSelectedCellArea,
    climateData,
    setClimateData,
  } = useUIState();

  // Static config and simulation state
  const [planetaryConfig] = useState<PlanetaryConfig>(PLANETARY_CONFIG_EARTH);
  const [seaLevel] = useState(0);
  const {
    activeSimulationConfig,
    activePlanetaryConfig,
    simulationKey,
    isRunning,
    newSimulation,
    getOrchestrator,
  } = useSimulation();

  // Refs for 3D components
  const meshRef = useRef<THREE.Mesh>(null);
  const highlightRef = useRef<THREE.Mesh>(null);

  // Track simulation progress from orchestrator
  const [simulationProgress, setSimulationProgress] = useState<{
    orbitIdx: number;
    physicsStep: number;
  } | null>(null);

  // Poll orchestrator for progress updates
  useEffect(() => {
    let mounted = true;

    const updateProgress = () => {
      if (!mounted) return;
      const orchestrator = getOrchestrator();
      if (orchestrator) {
        const progress = orchestrator.getProgress();
        setSimulationProgress({
          orbitIdx: progress.orbitIdx,
          physicsStep: progress.physicsStep,
        });
      } else {
        setSimulationProgress(null);
      }
    };

    // Initial update
    updateProgress();

    // Update progress periodically - polling external system (orchestrator)
    const intervalId = setInterval(updateProgress, 17); // Update every 17ms (60fps)

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [getOrchestrator, simulationKey, isRunning]);

  // Create climate simulation - recreate only when activeSimulationConfig changes (i.e., on button click)
  const simulation = useMemo(() => {
    return new TextureGridSimulation(activeSimulationConfig);
  }, [activeSimulationConfig]);

  // Generate terrain and hydrology when simulation is created
  useEffect(() => {
    if (!simulation) return;

    // Generate random terrain
    const terrainLoader = new TerrainDataLoader();
    const hydrologyInit = new HydrologyInitialiser();

    // Use simulationKey as seed for reproducible randomness
    const seed = simulationKey;
    const cellCount = simulation.getCellCount();

    // Get cell lat/lons
    const cellLatLons: Array<{ lat: number; lon: number }> = [];
    for (let i = 0; i < cellCount; i++) {
      cellLatLons.push(simulation.getCellLatLon(i));
    }

    // Generate procedural terrain
    const terrain = terrainLoader.generateProcedural(cellCount, cellLatLons, seed);
    simulation.setTerrainData(terrain);

    // Initialise hydrology from elevation (creates oceans below sea level)
    const hydrology = hydrologyInit.initialiseFromElevation(terrain.elevation, seaLevel);
    simulation.setHydrologyData(hydrology.waterDepth, hydrology.salinity, hydrology.iceThickness);

    console.log(`Generated new terrain with seed ${seed}, sea level ${seaLevel}m`);
  }, [simulation, simulationKey, seaLevel]);

  const { setSelectedCell } = useUIState();

  const handleCellClick = useCallback(
    (cellIndex: number) => {
      setSelectedCell(cellIndex);
      setSelectedCellLatLon(simulation.getCellLatLon(cellIndex));
      // Area is calculated on unit sphere, scale by planet radius² to get actual area in m²
      const unitSphereArea = simulation.getCellArea(cellIndex);
      const actualArea =
        unitSphereArea * activePlanetaryConfig.radius * activePlanetaryConfig.radius;
      setSelectedCellArea(actualArea);
    },
    [simulation, activePlanetaryConfig, setSelectedCell, setSelectedCellLatLon, setSelectedCellArea]
  );

  const handleCloseGraph = useCallback(() => {
    setSelectedCell(null);
    setSelectedCellLatLon(null);
    setSelectedCellArea(null);
    setClimateData([]);
  }, [setSelectedCell, setSelectedCellLatLon, setSelectedCellArea, setClimateData]);

  const handleDataFetched = useCallback(
    (
      data: Array<{
        day: number;
        surfaceTemperature: number;
        atmosphericTemperature: number;
        precipitableWater: number;
        waterDepth: number;
        iceThickness: number;
        salinity: number;
        albedo: number;
        elevation: number;
      }>
    ) => {
      setClimateData(data);
    },
    [setClimateData]
  );

  return (
    <main style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <CanvasView>
        {/* Climate simulation engine */}
        <ClimateEngine
          key={simulationKey}
          simulation={simulation}
          stepsPerFrame={stepsPerFrame}
          samplesPerOrbit={samplesPerOrbit}
        />

        {/* Planet geometry */}
        <ClimateScene
          ref={meshRef}
          simulation={simulation}
          displayConfig={displayConfig}
          subdivisions={activeSimulationConfig.resolution}
          radius={1}
        />

        {/* Visual overlays */}
        <ClimateOverlays
          ref={highlightRef}
          simulation={simulation}
          subdivisions={activeSimulationConfig.resolution}
          radius={1}
          hoveredCellIndex={hoveredCell}
          selectedCellIndex={selectedCell}
          showLatLonGrid={showLatLonGrid}
          axialTilt={orbitalConfig.axialTilt}
        />

        {/* User interaction controls */}
        <ClimateSceneControls
          simulation={simulation}
          meshRef={meshRef}
          onHoverCell={setHoveredCell}
          onCellClick={handleCellClick}
        />

        {/* Climate data fetcher */}
        <ClimateDataFetcher
          simulation={simulation}
          cellIndex={selectedCell}
          onDataFetched={handleDataFetched}
        />
      </CanvasView>

      {/* Side panel with controls */}
      <SidePanel
        simulationProgress={simulationProgress}
        onNewSimulation={() => {
          newSimulation(pendingSimulationConfig, orbitalConfig, planetaryConfig);
          setSelectedCell(null);
          setSelectedCellLatLon(null);
          setSelectedCellArea(null);
          setClimateData([]);
        }}
      />

      {/* Climate graph - rendered outside Canvas */}
      {selectedCell !== null &&
        climateData.length > 0 &&
        selectedCellLatLon &&
        selectedCellArea !== null && (
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
        <SimulationConfigProvider>
          <OrbitalConfigProvider>
            <RuntimeControlsProvider>
              <UIStateProvider>
                <ClimateApp />
              </UIStateProvider>
            </RuntimeControlsProvider>
          </OrbitalConfigProvider>
        </SimulationConfigProvider>
      </DisplayConfigProvider>
    </SimulationProvider>
  );
}

export default App;

import { useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
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
import { DraftSimulationConfigProvider } from './context/DraftSimulationConfigProvider';
import { DraftOrbitalConfigProvider } from './context/DraftOrbitalConfigProvider';
import { RuntimeControlsProvider } from './context/RuntimeControlsProvider';
import { UIStateProvider } from './context/UIStateProvider';
import { useSimulation } from './context/useSimulation';
import { useDraftSimulationConfig } from './context/useDraftSimulationConfig';
import { useDraftOrbitalConfig } from './context/useDraftOrbitalConfig';
import { useRuntimeControls } from './context/useRuntimeControls';
import { useUIState } from './context/useUIState';

function ClimateApp() {
  // Get state from hooks
  const { draftSimulationConfig } = useDraftSimulationConfig();
  const { draftOrbitalConfig } = useDraftOrbitalConfig();
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
  const {
    activePlanetaryConfig,
    simulationKey,
    isRunning,
    newSimulation,
    getOrchestrator,
    getSimulation,
  } = useSimulation();

  // Get simulation from context
  const simulation = getSimulation();

  // Refs for 3D components
  const meshRef = useRef<THREE.Mesh>(null);

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

  // Simulation and terrain loading are now handled inside createClimateEngine

  const { setSelectedCell } = useUIState();

  const handleCellClick = useCallback(
    (cellIndex: number) => {
      setSelectedCell(cellIndex);
      setSelectedCellLatLon(simulation?.getCellLatLon(cellIndex) ?? null);
      // Area is calculated on unit sphere, scale by planet radius² to get actual area in m²
      const unitSphereArea = simulation?.getCellArea(cellIndex) ?? 0;
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
        surfacePressure: number;
        waterDepth: number;
        iceThickness: number;
        salinity: number;
        albedo: number;
        elevation: number;
        solarFlux: number;
        surfaceNetPower: number;
        atmosphereNetPower: number;
      }>
    ) => {
      setClimateData(data);
    },
    [setClimateData]
  );

  return (
    <main style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <CanvasView>
        {/* Climate simulation engine - always render to initialize simulation */}
        <ClimateEngine
          key={simulationKey}
          stepsPerFrame={stepsPerFrame}
          samplesPerOrbit={samplesPerOrbit}
        />

        {/* Only render visual components once simulation is ready */}
        {simulation ? (
          <>
            {/* Planet geometry */}
            <ClimateScene ref={meshRef} />

            {/* Visual overlays */}
            <ClimateOverlays
              hoveredCellIndex={hoveredCell}
              selectedCellIndex={selectedCell}
            />

            {/* User interaction controls */}
            <ClimateSceneControls
              meshRef={meshRef}
              onHoverCell={setHoveredCell}
              onCellClick={handleCellClick}
            />

            {/* Climate data fetcher */}
            <ClimateDataFetcher
              cellIndex={selectedCell}
              onDataFetched={handleDataFetched}
            />
          </>
        ) : (
          <mesh>
            <sphereGeometry args={[1, 32, 16]} />
            <meshBasicMaterial color="#222" />
          </mesh>
        )}
      </CanvasView>

      {/* Side panel with controls */}
      <SidePanel
        simulationProgress={simulationProgress}
        onNewSimulation={() => {
          newSimulation(draftSimulationConfig, draftOrbitalConfig, planetaryConfig);
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
        <DraftSimulationConfigProvider>
          <DraftOrbitalConfigProvider>
            <RuntimeControlsProvider>
              <UIStateProvider>
                <ClimateApp />
              </UIStateProvider>
            </RuntimeControlsProvider>
          </DraftOrbitalConfigProvider>
        </DraftSimulationConfigProvider>
      </DisplayConfigProvider>
    </SimulationProvider>
  );
}

export default App;

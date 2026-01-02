import type { VisualisationModeId } from '../types/visualisationModes';
import { VISUALISATION_MODES } from '../rendering/visualisationModes';
import { useDraftSimulationConfig } from '../context/useDraftSimulationConfig';
import { useDraftOrbitalConfig } from '../context/useDraftOrbitalConfig';
import { useDisplayConfig } from '../context/useDisplayConfig';
import { useRuntimeControls } from '../context/useRuntimeControls';
import { useSimulation } from '../context/useSimulation';

interface SidePanelProps {
  onNewSimulation: () => void;
  simulationProgress: { orbitIdx: number; physicsStep: number } | null;
}

export function SidePanel({ onNewSimulation, simulationProgress }: SidePanelProps) {
  // Get state from hooks
  const { draftSimulationConfig, setDraftSimulationConfig } = useDraftSimulationConfig();
  const { draftOrbitalConfig, setDraftOrbitalConfig } = useDraftOrbitalConfig();
  const { displayConfig, setDisplayConfig, showLatLonGrid, setShowLatLonGrid } = useDisplayConfig();
  const { stepsPerFrame, setStepsPerFrame, samplesPerOrbit, setSamplesPerOrbit } =
    useRuntimeControls();
  const { activeSimulationConfig, isRunning, play, pause } = useSimulation();

  return (
    <div
      style={{
        position: 'absolute',
        width: '280px',
        height: '100dvh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        color: 'white',
        background: 'rgba(0,0,0,0.5)',
        padding: '12px',
        fontFamily: 'monospace',
      }}
    >
      <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2>Simulation settings</h2>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Resolution</span>
          <input
            type="number"
            value={draftSimulationConfig.resolution}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setDraftSimulationConfig({
                ...draftSimulationConfig,
                resolution: isNaN(val) ? draftSimulationConfig.resolution : val,
              });
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Physics steps per orbit</span>
          <input
            type="number"
            value={draftSimulationConfig.stepsPerOrbit}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setDraftSimulationConfig({
                ...draftSimulationConfig,
                stepsPerOrbit: isNaN(val) ? draftSimulationConfig.stepsPerOrbit : val,
              });
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
            value={draftOrbitalConfig.solarFlux}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setDraftOrbitalConfig({
                ...draftOrbitalConfig,
                solarFlux: isNaN(val) ? draftOrbitalConfig.solarFlux : val,
              });
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
            value={draftOrbitalConfig.axialTilt}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setDraftOrbitalConfig({
                ...draftOrbitalConfig,
                axialTilt: isNaN(val) ? draftOrbitalConfig.axialTilt : val,
              });
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Year length (s)</span>
          <input
            type="number"
            step="1"
            min="0"
            value={draftOrbitalConfig.yearLength}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setDraftOrbitalConfig({
                ...draftOrbitalConfig,
                yearLength: isNaN(val) ? draftOrbitalConfig.yearLength : val,
              });
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Rotations per year</span>
          <input
            type="number"
            step="1"
            min="0"
            value={draftOrbitalConfig.rotationsPerYear}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setDraftOrbitalConfig({
                ...draftOrbitalConfig,
                rotationsPerYear: isNaN(val) ? draftOrbitalConfig.rotationsPerYear : val,
              });
            }}
          />
        </label>

        {/* TODO: Currently you can't change simulation settings without creating a new simulation
                  Being able to change sim/planet settings on the fly would be fun. */}
        <button onClick={onNewSimulation}>New simulation</button>
      </section>

      <hr
        style={{ margin: '8px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.3)' }}
      />

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

      <hr
        style={{ margin: '8px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.3)' }}
      />

      <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2>Status</h2>
        <span>{isRunning ? 'Running' : 'Paused'}</span>
        {simulationProgress !== null ? (
          <>
            <span>Orbit {simulationProgress.orbitIdx}</span>
            <span>
              Physics step {simulationProgress.physicsStep} of{' '}
              {activeSimulationConfig.stepsPerOrbit}
            </span>
          </>
        ) : (
          <>
            <span>Orbit -</span>
            <span>Physics step - of {activeSimulationConfig.stepsPerOrbit}</span>
          </>
        )}
      </section>

      <hr
        style={{ margin: '8px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.3)' }}
      />

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
              });
            }}
          >
            {Object.values(VISUALISATION_MODES).map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
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
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
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
  );
}

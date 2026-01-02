import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useSimulation } from '../context/useSimulation';
import type { Milestone } from '../climate/engine/SimulationOrchestrator';

interface ClimateDataFetcherProps {
  cellIndex: number | null;
  onDataFetched: (
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
  ) => void;
}

/**
 * Helper component to fetch climate and hydrology data (stays inside Canvas for gl access)
 * Fetches data for a specific cell and provides it to parent component
 * Automatically refreshes data when a new orbit completes
 */
export function ClimateDataFetcher({
  cellIndex,
  onDataFetched,
}: ClimateDataFetcherProps) {
  const { gl } = useThree();
  const { getSimulation, getRecorder, getOrchestrator, simulationKey } = useSimulation();
  const simulation = getSimulation();

  // Use refs to avoid stale closures in milestone callback
  const cellIndexRef = useRef(cellIndex);
  const fetchDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Update refs when props change
  useEffect(() => {
    cellIndexRef.current = cellIndex;
  }, [cellIndex]);

  // Define fetch function
  useEffect(() => {
    fetchDataRef.current = async () => {
      const currentCellIndex = cellIndexRef.current;
      if (currentCellIndex === null || !simulation) {
        onDataFetched([]);
        return;
      }

      const recorder = getRecorder();

      // Always get current hydrology, surface, atmosphere, and terrain data (not time-series, just current state)
      const hydrologyData = await simulation.getHydrologyDataForCell(currentCellIndex, gl);
      const surfaceData = await simulation.getSurfaceDataForCell(currentCellIndex, gl);
      const atmosphereData = await simulation.getAtmosphereDataForCell(currentCellIndex, gl);
      const terrainData = simulation.getTerrainDataForCell(currentCellIndex);

      // Try to get complete orbit surface data (temperature and albedo) from recorder
      if (recorder && recorder.hasCompleteOrbit()) {
        const surfaceDataArray =
          await recorder.getCompleteOrbitSurfaceDataForCell(currentCellIndex);

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
          }));
          onDataFetched(formattedData);
          return;
        }
      }

      // Fallback: show current state if no complete orbit available
      const climateData = await simulation.getClimateDataForCell(currentCellIndex, gl);
      const formattedData = [
        {
          day: 0,
          ...climateData,
          ...atmosphereData,
          ...hydrologyData,
          ...surfaceData,
          ...terrainData,
        },
      ];
      onDataFetched(formattedData);
    };
  }, [simulation, gl, onDataFetched, getRecorder]);

  // Fetch data when cellIndex changes
  useEffect(() => {
    if (fetchDataRef.current) {
      fetchDataRef.current();
    }
  }, [cellIndex]);

  // Subscribe to orbit completion milestones to auto-refresh data
  useEffect(() => {
    // When simulationKey changes, the orchestrator is recreated, so we need to wait for it
    // Use a small delay to ensure the orchestrator is registered
    const timeoutId = setTimeout(() => {
      const orchestrator = getOrchestrator();
      if (!orchestrator) return;

      const handleMilestone = (milestone: Milestone) => {
        // When an orbit completes, refresh data if a cell is selected
        if (milestone.type === 'orbit_complete' && cellIndexRef.current !== null) {
          if (fetchDataRef.current) {
            fetchDataRef.current();
          }
        }
      };

      orchestrator.onMilestone(handleMilestone);
    }, 100); // Small delay to ensure orchestrator is registered

    return () => {
      clearTimeout(timeoutId);
    };
  }, [getOrchestrator, simulationKey]);

  return null; // Don't render anything in the Canvas
}

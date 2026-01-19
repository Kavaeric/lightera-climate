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

      // Always get current hydrology, surface, auxiliary (flux), terrain, and layer data (not time-series, just current state)
      const hydrologyData = await simulation.getHydrologyDataForCell(currentCellIndex, gl);
      const surfaceData = await simulation.getSurfaceDataForCell(currentCellIndex, gl);
      const auxiliaryData = await simulation.getAuxiliaryDataForCell(currentCellIndex, gl);
      const terrainData = simulation.getTerrainDataForCell(currentCellIndex);

      // Get multi-layer atmosphere data
      const layer0ThermoData = await simulation.getLayerThermoDataForCell(0, currentCellIndex, gl);
      const layer1ThermoData = await simulation.getLayerThermoDataForCell(1, currentCellIndex, gl);
      const layer2ThermoData = await simulation.getLayerThermoDataForCell(2, currentCellIndex, gl);

      // Calculate column-integrated precipitable water from all layers
      // Precipitable water = sum of (humidity * layer_mass) for all layers
      // Layer mass = (pBot - pTop) / g
      const surfaceGravity = 9.81; // m/s²
      const surfacePressureValue = 101325; // Pa (approximate, should come from config)

      const layer0Mass = (surfacePressureValue - 50000) / surfaceGravity; // kg/m²
      const layer1Mass = (50000 - 10000) / surfaceGravity; // kg/m²
      const layer2Mass = (10000 - 100) / surfaceGravity; // kg/m²

      const layer0Water = layer0ThermoData.humidity * layer0Mass; // kg/m²
      const layer1Water = layer1ThermoData.humidity * layer1Mass; // kg/m²
      const layer2Water = layer2ThermoData.humidity * layer2Mass; // kg/m²

      const totalPrecipitableWater = layer0Water + layer1Water + layer2Water; // kg/m² = mm

      // Try to get complete orbit surface and auxiliary data from recorder
      if (recorder && recorder.hasCompleteOrbit()) {
        const surfaceDataArray =
          await recorder.getCompleteOrbitSurfaceDataForCell(currentCellIndex);
        const auxiliaryDataArray =
          await recorder.getCompleteOrbitAuxiliaryDataForCell(currentCellIndex);

        if (
          surfaceDataArray &&
          surfaceDataArray.length > 0 &&
          auxiliaryDataArray &&
          auxiliaryDataArray.length > 0
        ) {
          // Calculate orbital averages for flux data
          const avgSolarFlux = auxiliaryDataArray.reduce((sum, d) => sum + d.solarFlux, 0) / auxiliaryDataArray.length;
          const avgSurfaceNetPower = auxiliaryDataArray.reduce((sum, d) => sum + d.surfaceNetPower, 0) / auxiliaryDataArray.length;
          const avgAtmosphereNetPower = auxiliaryDataArray.reduce((sum, d) => sum + d.atmosphereNetPower, 0) / auxiliaryDataArray.length;

          // Format as time series data (sample index as "day")
          // Use current hydrology, terrain, and layer data for all samples (since it's not time-series)
          // Use orbital-averaged flux data for all samples (to avoid wild fluctuations)
          // Surface temperature and albedo are read from recorded samples
          const formattedData = surfaceDataArray.map((surface, index) => {
            return {
              day: index,
              surfaceTemperature: surface.temperature,
              atmosphericTemperature: layer0ThermoData.temperature, // Use layer 0 temperature
              precipitableWater: totalPrecipitableWater, // Column-integrated from all layers
              surfacePressure: surfacePressureValue, // Use actual surface pressure, not layer 0 pressure
              waterDepth: hydrologyData.waterDepth,
              iceThickness: hydrologyData.iceThickness,
              salinity: hydrologyData.salinity,
              albedo: surface.albedo,
              elevation: terrainData.elevation,
              solarFlux: avgSolarFlux,
              surfaceNetPower: avgSurfaceNetPower,
              atmosphereNetPower: avgAtmosphereNetPower,
              // Multi-layer atmosphere data (current state, not time-series)
              layer0: layer0ThermoData,
              layer1: layer1ThermoData,
              layer2: layer2ThermoData,
            };
          });
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
          atmosphericTemperature: layer0ThermoData.temperature, // Use layer 0 temperature
          precipitableWater: totalPrecipitableWater, // Column-integrated from all layers
          surfacePressure: surfacePressureValue, // Use actual surface pressure, not layer 0 pressure
          ...hydrologyData,
          ...surfaceData,
          ...terrainData,
          ...auxiliaryData,
          // Multi-layer atmosphere data
          layer0: layer0ThermoData,
          layer1: layer1ThermoData,
          layer2: layer2ThermoData,
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

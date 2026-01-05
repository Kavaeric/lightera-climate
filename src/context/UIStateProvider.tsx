import { useState, type ReactNode } from 'react';
import { UIStateContext } from './useUIState';

interface UIStateProviderProps {
  children: ReactNode;
}

export function UIStateProvider({ children }: UIStateProviderProps) {
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [selectedCellLatLon, setSelectedCellLatLon] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [selectedCellArea, setSelectedCellArea] = useState<number | null>(null);
  const [climateData, setClimateData] = useState<
    Array<{
      day: number;
      surfaceTemperature: number;
      atmosphericTemperature: number;
      precipitableWater: number;
      waterDepth: number;
      iceThickness: number;
      salinity: number;
      albedo: number;
      elevation: number;
      surfacePressure: number;
      solarFlux: number;
      surfaceNetPower: number;
      atmosphereNetPower: number;
    }>
  >([]);

  return (
    <UIStateContext.Provider
      value={{
        hoveredCell,
        setHoveredCell,
        selectedCell,
        setSelectedCell,
        selectedCellLatLon,
        setSelectedCellLatLon,
        selectedCellArea,
        setSelectedCellArea,
        climateData,
        setClimateData,
      }}
    >
      {children}
    </UIStateContext.Provider>
  );
}


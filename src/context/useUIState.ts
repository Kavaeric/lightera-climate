import { useContext, createContext } from 'react';

export interface UIStateContextType {
  hoveredCell: number | null;
  setHoveredCell: (cellIndex: number | null) => void;
  selectedCell: number | null;
  setSelectedCell: (cellIndex: number | null) => void;
  selectedCellLatLon: { lat: number; lon: number } | null;
  setSelectedCellLatLon: (latLon: { lat: number; lon: number } | null) => void;
  selectedCellArea: number | null;
  setSelectedCellArea: (area: number | null) => void;
  climateData: Array<{
    day: number;
    surfaceTemperature: number;
    atmosphericTemperature: number;
    precipitableWater: number;
    waterDepth: number;
    iceThickness: number;
    salinity: number;
    albedo: number;
    elevation: number;
  }>;
  setClimateData: (
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

export const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

export function useUIState() {
  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error('useUIState must be used within a UIStateProvider');
  }
  return context;
}

import { createContext, useContext, useState, type ReactNode } from 'react'

interface UIStateContextType {
  hoveredCell: number | null
  setHoveredCell: (cellIndex: number | null) => void
  selectedCell: number | null
  setSelectedCell: (cellIndex: number | null) => void
  selectedCellLatLon: { lat: number; lon: number } | null
  setSelectedCellLatLon: (latLon: { lat: number; lon: number } | null) => void
  selectedCellArea: number | null
  setSelectedCellArea: (area: number | null) => void
  climateData: Array<{
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
  setClimateData: (data: Array<{
    day: number
    surfaceTemperature: number
    atmosphericTemperature: number
    precipitableWater: number
    waterDepth: number
    iceThickness: number
    salinity: number
    albedo: number
    elevation: number
  }>) => void
}

const UIStateContext = createContext<UIStateContextType | null>(null)

interface UIStateProviderProps {
  children: ReactNode
}

export function UIStateProvider({ children }: UIStateProviderProps) {
  const [hoveredCell, setHoveredCell] = useState<number | null>(null)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [selectedCellLatLon, setSelectedCellLatLon] = useState<{ lat: number; lon: number } | null>(null)
  const [selectedCellArea, setSelectedCellArea] = useState<number | null>(null)
  const [climateData, setClimateData] = useState<Array<{
    day: number
    surfaceTemperature: number
    atmosphericTemperature: number
    precipitableWater: number
    waterDepth: number
    iceThickness: number
    salinity: number
    albedo: number
    elevation: number
  }>>([])

  return (
    <UIStateContext.Provider value={{
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
    }}>
      {children}
    </UIStateContext.Provider>
  )
}

export function useUIState() {
  const context = useContext(UIStateContext)
  if (!context) {
    throw new Error('useUIState must be used within a UIStateProvider')
  }
  return context
}
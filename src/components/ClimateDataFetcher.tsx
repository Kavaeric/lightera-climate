import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { TextureGridSimulation } from '../util/TextureGridSimulation'
import { useSimulation } from '../context/useSimulation'

interface ClimateDataFetcherProps {
  simulation: TextureGridSimulation
  cellIndex: number | null
  onDataFetched: (data: Array<{
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

/**
 * Helper component to fetch climate and hydrology data (stays inside Canvas for gl access)
 * Fetches data for a specific cell and provides it to parent component
 */
export function ClimateDataFetcher({
  simulation,
  cellIndex,
  onDataFetched,
}: ClimateDataFetcherProps) {
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

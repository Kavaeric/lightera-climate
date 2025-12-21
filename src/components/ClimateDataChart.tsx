import { useMemo } from 'react'
import { XYChart, Axis, Grid, LineSeries } from '@visx/xychart'
import { useDisplayConfig } from '../context/useDisplayConfig'


interface ClimateDataPoint {
  day: number
  surfaceTemperature: number
  atmosphericTemperature: number
  waterDepth: number
  iceThickness: number
  salinity: number
  albedo: number
  elevation: number
}

interface ClimateDataChartProps {
  data: ClimateDataPoint[]
  cellIndex: number | null
  cellLatLon: { lat: number; lon: number }
  onClose: () => void
}

export function ClimateDataChart({ data, cellIndex, cellLatLon, onClose }: ClimateDataChartProps) {
  const { displayConfig } = useDisplayConfig()

  const accessors = useMemo(
    () => ({
      xAccessor: (d: ClimateDataPoint) => d.day,
      yAccessor: (d: ClimateDataPoint) => d.surfaceTemperature,
      yAccessorAtmospheric: (d: ClimateDataPoint) => d.atmosphericTemperature,
    }),
    []
  )

  // Calculate surface temperature stats
  const stats = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 0, avg: 0 }
    const surfaceTemps = data.map((d) => d.surfaceTemperature)
    const min = Math.min(...surfaceTemps)
    const max = Math.max(...surfaceTemps)
    const avg = surfaceTemps.reduce((a, b) => a + b, 0) / surfaceTemps.length
    return { min, max, avg }
  }, [data])

  // Calculate atmospheric temperature stats
  const atmosphericStats = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 0, avg: 0 }
    const atmosphericTemps = data.map((d) => d.atmosphericTemperature)
    const min = Math.min(...atmosphericTemps)
    const max = Math.max(...atmosphericTemps)
    const avg = atmosphericTemps.reduce((a, b) => a + b, 0) / atmosphericTemps.length
    return { min, max, avg }
  }, [data])

  // Calculate hydrology stats
  const hydrologyStats = useMemo(() => {
    if (data.length === 0) return { waterDepthMax: 0, iceThicknessMax: 0 }
    const waterDepths = data.map((d) => d.waterDepth).filter((d) => d > 0)
    const iceThicknesses = data.map((d) => d.iceThickness).filter((d) => d > 0)
    return {
      waterDepthMax: waterDepths.length > 0 ? Math.max(...waterDepths) : 0,
      iceThicknessMax: iceThicknesses.length > 0 ? Math.max(...iceThicknesses) : 0,
    }
  }, [data])

  // Calculate albedo (current value, not time-series)
  const albedo = useMemo(() => {
    if (data.length === 0) return 0
    // Albedo is the same for all samples (current state), so just get the first one
    return data[0]?.albedo ?? 0
  }, [data])

  // Get elevation (static terrain data, same for all samples)
  const elevation = useMemo(() => {
    if (data.length === 0) return 0
    // Elevation is static terrain data, same for all samples
    return data[0]?.elevation ?? 0
  }, [data])

  if (cellIndex === null) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 10,
        right: 10,
        width: '40%',
        background: 'rgba(0, 0, 0, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: 4,
        padding: 16,
        color: 'white',
        fontFamily: 'monospace',
        fontSize: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <strong>Cell #{cellIndex}</strong> climate data
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 14 }}>
        <div>
          Lat: <strong>{cellLatLon.lat.toFixed(2)}°</strong>
        </div>
        <div>
          Lon: <strong>{cellLatLon.lon.toFixed(2)}°</strong>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, fontSize: 16 }}>
        <div>
          Surface min:
          <br />
          <strong>{stats.min.toFixed(1)}K</strong>
          <br />
          ({(stats.min - 273.15).toFixed(1)}°C)
        </div>
        <div>
          Surface avg:
          <br />
          <strong>{stats.avg.toFixed(1)}K</strong>
          <br />
          ({(stats.avg - 273.15).toFixed(1)}°C)
        </div>
        <div>
          Surface max:
          <br />
          <strong>{stats.max.toFixed(1)}K</strong>
          <br />
          ({(stats.max - 273.15).toFixed(1)}°C)
        </div>
      </div>

      {/* Atmospheric temperature stats */}
      <div style={{ display: 'flex', gap: 16, fontSize: 16, marginTop: 8 }}>
        <div>
          Atm Min:
          <br />
          <strong>{atmosphericStats.min.toFixed(1)}K</strong>
          <br />
          ({(atmosphericStats.min - 273.15).toFixed(1)}°C)
        </div>
        <div>
          Atm Avg:
          <br />
          <strong>{atmosphericStats.avg.toFixed(1)}K</strong>
          <br />
          ({(atmosphericStats.avg - 273.15).toFixed(1)}°C)
        </div>
        <div>
          Atm Max:
          <br />
          <strong>{atmosphericStats.max.toFixed(1)}K</strong>
          <br />
          ({(atmosphericStats.max - 273.15).toFixed(1)}°C)
        </div>
      </div>

      <br />

      <div style={{ display: 'flex', gap: 16, fontSize: 16 }}>
        <div>
          Elevation: <strong>{elevation.toFixed(1)} m</strong>
        </div>
        <div>
          Water depth: <strong>{hydrologyStats.waterDepthMax.toFixed(3)} m</strong>
        </div>
        <div>
          Ice thickness: <strong>{hydrologyStats.iceThicknessMax.toFixed(3)} m</strong>
        </div>
        <div>
          Albedo: <strong>{albedo.toFixed(2)}</strong>
        </div>
      </div>

      {/* Chart */}
      <XYChart
        height={240}
        xScale={{ type: 'linear' }}
        yScale={{ type: 'linear', domain: [displayConfig.surfaceTemperatureRange.min, displayConfig.surfaceTemperatureRange.max] }}
      >
        <Grid columns={false}/>
        <Axis orientation="bottom" label="Sample"/>
        <Axis orientation="left" label="Temperature (K)"/>
        <LineSeries
          dataKey="surfaceTemperature"
          data={data}
          xAccessor={accessors.xAccessor}
          yAccessor={accessors.yAccessor}
          stroke="#ef4444"
          strokeWidth={2}
        />
        <LineSeries
          dataKey="atmosphericTemperature"
          data={data}
          xAccessor={accessors.xAccessor}
          yAccessor={accessors.yAccessorAtmospheric}
          stroke="#3b82f6"
          strokeWidth={2}
        />
      </XYChart>
    </div>
  )
}

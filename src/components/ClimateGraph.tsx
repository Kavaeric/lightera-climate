import { useMemo } from 'react'
import { XYChart, Axis, Grid, LineSeries } from '@visx/xychart'

interface ClimateDataPoint {
  day: number
  temperature: number
  humidity: number
  pressure: number
}

interface ClimateGraphProps {
  data: ClimateDataPoint[]
  cellIndex: number | null
  cellLatLon: { lat: number; lon: number }
  onClose: () => void
}

export function ClimateGraph({ data, cellIndex, cellLatLon, onClose }: ClimateGraphProps) {
  const accessors = useMemo(
    () => ({
      xAccessor: (d: ClimateDataPoint) => d.day,
      yAccessor: (d: ClimateDataPoint) => d.temperature,
    }),
    []
  )

  // Calculate temperature stats
  const stats = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 0, avg: 0 }
    const temps = data.map((d) => d.temperature)
    const min = Math.min(...temps)
    const max = Math.max(...temps)
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length
    return { min, max, avg }
  }, [data])

  if (cellIndex === null) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 10,
        right: 10,
        width: 400,
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
          <strong>Cell #{cellIndex}</strong> Climate Data
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
          Min: <strong>{stats.min.toFixed(1)}K</strong> ({(stats.min - 273.15).toFixed(1)}°C)
        </div>
        <div>
          Avg: <strong>{stats.avg.toFixed(1)}K</strong> ({(stats.avg - 273.15).toFixed(1)}°C)
        </div>
        <div>
          Max: <strong>{stats.max.toFixed(1)}K</strong> ({(stats.max - 273.15).toFixed(1)}°C)
        </div>
      </div>

      {/* Chart */}
      <XYChart
        height={240}
        xScale={{ type: 'linear' }}
        yScale={{ type: 'linear', domain: [0, 700] }}
      >
        <Grid columns={false} numTicks={4} />
        <Axis orientation="bottom" label="Sample index" numTicks={6} />
        <Axis orientation="left" label="Temperature (K)" numTicks={5} />
        <LineSeries
          dataKey="temperature"
          data={data}
          {...accessors}
          stroke="#ef4444"
          strokeWidth={2}
        />
      </XYChart>
    </div>
  )
}

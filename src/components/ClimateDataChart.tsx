import { useMemo } from 'react';
import { XYChart, Axis, Grid, LineSeries } from '@visx/xychart';
import { useDisplayConfig } from '../context/useDisplayConfig';
import { useSimulation } from '../context/useSimulation';
import { getLayerAltitudeBoundaries } from '../climate/schema/atmosphereLayerSchema';

interface LayerData {
  temperature: number;
  pressure: number;
  humidity: number;
  cloudFraction: number;
}

interface ClimateDataPoint {
  day: number;
  surfaceTemperature: number;
  atmosphericTemperature: number; // Legacy - will be same as layer0.temperature
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
  // Multi-layer atmosphere data
  layer0?: LayerData; // Boundary layer (0-2km)
  layer1?: LayerData; // Troposphere (2-10km)
  layer2?: LayerData; // Stratosphere (10-50km)
}

interface ClimateDataChartProps {
  data: ClimateDataPoint[];
  cellIndex: number | null;
  cellLatLon: { lat: number; lon: number };
  cellArea: number;
  onClose: () => void;
}

export function ClimateDataChart({
  data,
  cellIndex,
  cellLatLon,
  cellArea,
  onClose,
}: ClimateDataChartProps) {
  const { displayConfig } = useDisplayConfig();
  const { activePlanetaryConfig } = useSimulation();

  // Calculate layer altitude ranges based on planetary configuration
  const layerAltitudes = useMemo(() => {
    const surfacePressure = activePlanetaryConfig.surfacePressure || 101325;
    const scaleHeight = activePlanetaryConfig.atmosphereScaleHeight;

    const layer0 = getLayerAltitudeBoundaries(0, surfacePressure, scaleHeight);
    const layer1 = getLayerAltitudeBoundaries(1, surfacePressure, scaleHeight);
    const layer2 = getLayerAltitudeBoundaries(2, surfacePressure, scaleHeight);

    return {
      layer0: `${(layer0.altitudeMin / 1000).toFixed(0)}-${(layer0.altitudeMax / 1000).toFixed(0)}km`,
      layer1: `${(layer1.altitudeMin / 1000).toFixed(0)}-${(layer1.altitudeMax / 1000).toFixed(0)}km`,
      layer2: `${(layer2.altitudeMin / 1000).toFixed(0)}-${(layer2.altitudeMax / 1000).toFixed(0)}km`,
    };
  }, [activePlanetaryConfig]);

  const accessors = useMemo(
    () => ({
      xAccessor: (d: ClimateDataPoint) => d.day,
      yAccessor: (d: ClimateDataPoint) => d.surfaceTemperature,
      yAccessorAtmospheric: (d: ClimateDataPoint) => d.atmosphericTemperature,
    }),
    []
  );

  // Calculate temperature stats for all levels
  const temperatureStats = useMemo(() => {
    if (data.length === 0) {
      return {
        surface: { min: 0, max: 0, avg: 0 },
        layer0: { min: 0, max: 0, avg: 0 },
        layer1: { min: 0, max: 0, avg: 0 },
        layer2: { min: 0, max: 0, avg: 0 },
      };
    }

    const calculateStats = (temps: number[]) => {
      if (temps.length === 0) return { min: 0, max: 0, avg: 0 };
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
      return { min, max, avg };
    };

    return {
      surface: calculateStats(data.map((d) => d.surfaceTemperature)),
      layer0: calculateStats(data.map((d) => d.layer0?.temperature ?? d.atmosphericTemperature)),
      layer1: calculateStats(data.map((d) => d.layer1?.temperature ?? 0).filter((t) => t > 0)),
      layer2: calculateStats(data.map((d) => d.layer2?.temperature ?? 0).filter((t) => t > 0)),
    };
  }, [data]);

  // Calculate hydrology stats
  const hydrologyStats = useMemo(() => {
    if (data.length === 0) return { waterDepthMax: 0, iceThicknessMax: 0, salinity: 0 };
    const waterDepths = data.map((d) => d.waterDepth).filter((d) => d > 0);
    const iceThicknesses = data.map((d) => d.iceThickness).filter((d) => d > 0);
    // Salinity is the same for all samples (current state), so just get the first one
    const salinity = data[0]?.salinity ?? 0;
    return {
      waterDepthMax: waterDepths.length > 0 ? Math.max(...waterDepths) : 0,
      iceThicknessMax: iceThicknesses.length > 0 ? Math.max(...iceThicknesses) : 0,
      salinity,
    };
  }, [data]);

  // Calculate albedo (current value, not time-series)
  const albedo = useMemo(() => {
    if (data.length === 0) return 0;
    // Albedo is the same for all samples (current state), so just get the first one
    return data[0]?.albedo ?? 0;
  }, [data]);

  // Get elevation (static terrain data, same for all samples)
  const elevation = useMemo(() => {
    if (data.length === 0) return 0;
    // Elevation is static terrain data, same for all samples
    return data[0]?.elevation ?? 0;
  }, [data]);

  // Get precipitable water (current value, not time-series)
  const precipitableWater = useMemo(() => {
    if (data.length === 0) return 0;
    // Precipitable water is the same for all samples (current state), so just get the first one
    return data[0]?.precipitableWater ?? 0;
  }, [data]);

  // Get surface pressure (current value, not time-series)
  const surfacePressure = useMemo(() => {
    if (data.length === 0) return 0;
    // Surface pressure is the same for all samples (current state), so just get the first one
    return data[0]?.surfacePressure ?? 0;
  }, [data]);

  // Get energy flux data (current value, not time-series)
  const fluxData = useMemo(() => {
    if (data.length === 0) return { solarFlux: 0, surfaceNetPower: 0, atmosphereNetPower: 0 };
    return {
      solarFlux: data[0]?.solarFlux ?? 0,
      surfaceNetPower: data[0]?.surfaceNetPower ?? 0,
      atmosphereNetPower: data[0]?.atmosphereNetPower ?? 0,
    };
  }, [data]);

  if (cellIndex === null) return null;

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
        <div>
          Area: <strong>{(cellArea / 1e6).toFixed(2)} km²</strong>
        </div>
      </div>

      {/* Temperature Table */}
      <table style={{
        width: '100%',
        fontSize: 14,
        borderCollapse: 'collapse',
        marginTop: 8,
        marginBottom: 8,
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.3)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Level</th>
            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Min</th>
            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Avg</th>
            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Max</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
            <td style={{ padding: '4px 8px' }}>Layer 2 ({layerAltitudes.layer2})</td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              {temperatureStats.layer2.min > 0
                ? <>
                  {(temperatureStats.layer2.min - 273.15).toFixed(1)}°C{' '}
                  <span style={{ color: '#bbb', fontSize: 12 }}>
                    ({temperatureStats.layer2.min.toFixed(1)}K)
                  </span>
                </>
                : '-'}
            </td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              <strong>
                {temperatureStats.layer2.avg > 0
                  ? <>
                    {(temperatureStats.layer2.avg - 273.15).toFixed(1)}°C{' '}
                    <span style={{ color: '#bbb', fontSize: 12 }}>
                      ({temperatureStats.layer2.avg.toFixed(1)}K)
                    </span>
                  </>
                  : '-'}
              </strong>
            </td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              {temperatureStats.layer2.max > 0
                ? <>
                  {(temperatureStats.layer2.max - 273.15).toFixed(1)}°C{' '}
                  <span style={{ color: '#bbb', fontSize: 12 }}>
                    ({temperatureStats.layer2.max.toFixed(1)}K)
                  </span>
                </>
                : '-'}
            </td>
          </tr>
          <tr style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
            <td style={{ padding: '4px 8px' }}>Layer 1 ({layerAltitudes.layer1})</td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              {temperatureStats.layer1.min > 0
                ? <>
                  {(temperatureStats.layer1.min - 273.15).toFixed(1)}°C{' '}
                  <span style={{ color: '#bbb', fontSize: 12 }}>
                    ({temperatureStats.layer1.min.toFixed(1)}K)
                  </span>
                </>
                : '-'}
            </td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              <strong>
                {temperatureStats.layer1.avg > 0
                  ? <>
                    {(temperatureStats.layer1.avg - 273.15).toFixed(1)}°C{' '}
                    <span style={{ color: '#bbb', fontSize: 12 }}>
                      ({temperatureStats.layer1.avg.toFixed(1)}K)
                    </span>
                  </>
                  : '-'}
              </strong>
            </td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              {temperatureStats.layer1.max > 0
                ? <>
                  {(temperatureStats.layer1.max - 273.15).toFixed(1)}°C{' '}
                  <span style={{ color: '#bbb', fontSize: 12 }}>
                    ({temperatureStats.layer1.max.toFixed(1)}K)
                  </span>
                </>
                : '-'}
            </td>
          </tr>
          <tr style={{ background: 'rgba(59, 130, 246, 0.3)' }}>
            <td style={{ padding: '4px 8px' }}>Layer 0 ({layerAltitudes.layer0})</td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              {(temperatureStats.layer0.min - 273.15).toFixed(1)}°C{' '}
              <span style={{ color: '#bbb', fontSize: 12 }}>
                ({temperatureStats.layer0.min.toFixed(1)}K)
              </span>
            </td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              <strong>
                {(temperatureStats.layer0.avg - 273.15).toFixed(1)}°C{' '}
                <span style={{ color: '#bbb', fontSize: 12 }}>
                  ({temperatureStats.layer0.avg.toFixed(1)}K)
                </span>
              </strong>
            </td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              {(temperatureStats.layer0.max - 273.15).toFixed(1)}°C{' '}
              <span style={{ color: '#bbb', fontSize: 12 }}>
                ({temperatureStats.layer0.max.toFixed(1)}K)
              </span>
            </td>
          </tr>
          <tr style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
            <td style={{ padding: '4px 8px' }}>Surface</td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              {(temperatureStats.surface.min - 273.15).toFixed(1)}°C{' '}
              <span style={{ color: '#bbb', fontSize: 12 }}>
                ({temperatureStats.surface.min.toFixed(1)}K)
              </span>
            </td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              <strong>
                {(temperatureStats.surface.avg - 273.15).toFixed(1)}°C{' '}
                <span style={{ color: '#bbb', fontSize: 12 }}>
                  ({temperatureStats.surface.avg.toFixed(1)}K)
                </span>
              </strong>
            </td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>
              {(temperatureStats.surface.max - 273.15).toFixed(1)}°C{' '}
              <span style={{ color: '#bbb', fontSize: 12 }}>
                ({temperatureStats.surface.max.toFixed(1)}K)
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <div style={{ display: 'flex', gap: 16, fontSize: 16 }}>
        <div>
          Elevation: <strong>{elevation.toFixed(1)} m</strong>
        </div>
        <div>
          Albedo: <strong>{albedo.toFixed(2)}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 16 }}>
        <div>
          Water depth: <strong>{hydrologyStats.waterDepthMax.toFixed(1)} m</strong>
        </div>
        <div>
          Ice thickness: <strong>{hydrologyStats.iceThicknessMax.toFixed(1)} m</strong>
        </div>
        <div>
          Salinity: <strong>{hydrologyStats.salinity.toFixed(1)} PSU</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 16, marginTop: 8 }}>
        <div>
          Precipitable water: <strong>{precipitableWater.toFixed(1)} mm</strong>
        </div>
        <div>
          Surface pressure: <strong>{(surfacePressure / 1000).toFixed(2)} kPa</strong>
        </div>
      </div>

      <br />
      <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>Energy fluxes (W/m²)</div>

      <div style={{ display: 'flex', gap: 16, fontSize: 16, marginTop: 4 }}>
        <div>
          Solar flux: <strong>{fluxData.solarFlux.toFixed(1)}</strong>
        </div>
        <div>
          Surface net: <strong>{fluxData.surfaceNetPower.toFixed(1)}</strong>
        </div>
        <div>
          Atmosphere net: <strong>{fluxData.atmosphereNetPower.toFixed(1)}</strong>
        </div>
      </div>

      {/* Chart */}
      <XYChart
        height={240}
        xScale={{ type: 'linear' }}
        yScale={{
          type: 'linear',
          domain: [
            displayConfig.surfaceTemperatureRange.min,
            displayConfig.surfaceTemperatureRange.max,
          ],
        }}
      >
        <Grid columns={false} />
        <Axis orientation="bottom" label="Sample" />
        <Axis orientation="left" label="Temperature (K)" />
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
  );
}

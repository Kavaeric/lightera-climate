/**
 * Atmosphere Layer Schema
 *
 * Single source of truth for the multi-layer atmospheric model structure.
 * This schema is used to generate GLSL accessor functions at build time.
 *
 * Each layer has two textures:
 * - Thermo: thermodynamic state (temperature, pressure, humidity, cloud fraction)
 * - Dynamics: wind and vertical motion (u, v, omega, reserved)
 */

// =============================================================================
// LAYER DEFINITIONS
// =============================================================================

export interface AtmosphereLayerDefinition {
  /** Layer index (0 = lowest) */
  index: number;
  /** Human-readable name */
  name: string;
  /** GLSL-safe identifier (camelCase) */
  glslName: string;
  /** Bottom pressure boundary (Pa) */
  pressureBottom: number;
  /** Top pressure boundary (Pa) */
  pressureTop: number;
  /** Reference pressure at layer midpoint (Pa) */
  referencePressure: number;
}

/**
 * Layer definitions use pressure boundaries (planetary-independent).
 * Altitudes are calculated from pressure using the barometric formula.
 *
 * Pressure fractions are relative to surface pressure:
 * - Layer 0 (boundary): Surface to ~50% pressure
 * - Layer 1 (troposphere): ~50% to ~10% pressure
 * - Layer 2 (stratosphere): ~10% to ~0.1% pressure
 */
export const ATMOSPHERE_LAYERS: readonly AtmosphereLayerDefinition[] = [
  {
    index: 0,
    name: 'Boundary Layer',
    glslName: 'boundary',
    pressureBottom: 1.0,   // Surface pressure (100%)
    pressureTop: 0.5,      // 50% of surface pressure
    referencePressure: 0.7, // ~70% (midpoint in log space)
  },
  {
    index: 1,
    name: 'Troposphere',
    glslName: 'troposphere',
    pressureBottom: 0.5,   // 50% of surface pressure
    pressureTop: 0.1,      // 10% of surface pressure
    referencePressure: 0.22, // ~22% (midpoint in log space)
  },
  {
    index: 2,
    name: 'Stratosphere',
    glslName: 'stratosphere',
    pressureBottom: 0.1,   // 10% of surface pressure
    pressureTop: 0.001,    // 0.1% of surface pressure (~100 Pa for Earth)
    referencePressure: 0.01, // ~1% (midpoint in log space)
  },
] as const;

export const NUM_ATMOSPHERE_LAYERS = ATMOSPHERE_LAYERS.length;

/**
 * Calculate altitude from pressure using barometric formula.
 * z = H * ln(P_surface / P) where H is scale height
 *
 * @param pressure Pressure at altitude (Pa)
 * @param surfacePressure Surface pressure (Pa)
 * @param scaleHeight Atmospheric scale height (m)
 * @returns Altitude in metres
 */
export function calculateAltitudeFromPressure(
  pressure: number,
  surfacePressure: number,
  scaleHeight: number
): number {
  return scaleHeight * Math.log(surfacePressure / pressure);
}

/**
 * Get layer altitude boundaries for a given planetary configuration.
 *
 * @param layerIndex Layer index (0, 1, or 2)
 * @param surfacePressure Surface pressure in Pa
 * @param scaleHeight Atmospheric scale height in m
 * @returns Object with altitudeMin and altitudeMax in metres
 */
export function getLayerAltitudeBoundaries(
  layerIndex: number,
  surfacePressure: number,
  scaleHeight: number
): { altitudeMin: number; altitudeMax: number } {
  const layer = ATMOSPHERE_LAYERS[layerIndex];
  const pressureBottom = layer.pressureBottom * surfacePressure;
  const pressureTop = layer.pressureTop * surfacePressure;

  return {
    altitudeMin: calculateAltitudeFromPressure(pressureBottom, surfacePressure, scaleHeight),
    altitudeMax: calculateAltitudeFromPressure(pressureTop, surfacePressure, scaleHeight),
  };
}

// =============================================================================
// TEXTURE CHANNEL LAYOUTS
// =============================================================================

export type GLSLChannel = 'r' | 'g' | 'b' | 'a';

export interface VariableDefinition {
  /** Variable name (camelCase) */
  name: string;
  /** GLSL channel in the texture */
  channel: GLSLChannel;
  /** Physical unit for documentation */
  unit: string;
  /** Description for documentation */
  description: string;
}

/**
 * Thermodynamic state texture layout.
 * One texture per layer, RGBA format.
 */
export const THERMO_VARIABLES: readonly VariableDefinition[] = [
  {
    name: 'temperature',
    channel: 'r',
    unit: 'K',
    description: 'Layer temperature',
  },
  {
    name: 'pressure',
    channel: 'g',
    unit: 'Pa',
    description: 'Layer pressure',
  },
  {
    name: 'humidity',
    channel: 'b',
    unit: 'kg/kg',
    description: 'Specific humidity (mass mixing ratio)',
  },
  {
    name: 'cloudFraction',
    channel: 'a',
    unit: '0-1',
    description: 'Cloud cover fraction',
  },
] as const;

/**
 * Dynamics state texture layout.
 * One texture per layer, RGBA format.
 */
export const DYNAMICS_VARIABLES: readonly VariableDefinition[] = [
  {
    name: 'windU',
    channel: 'r',
    unit: 'm/s',
    description: 'Eastward wind component',
  },
  {
    name: 'windV',
    channel: 'g',
    unit: 'm/s',
    description: 'Northward wind component',
  },
  {
    name: 'omega',
    channel: 'b',
    unit: 'Pa/s',
    description: 'Vertical velocity in pressure coordinates',
  },
  {
    name: 'reserved',
    channel: 'a',
    unit: '-',
    description: 'Reserved for future use',
  },
] as const;

// =============================================================================
// TEXTURE NAMING CONVENTIONS
// =============================================================================

/**
 * Get the uniform name for a layer's thermo texture.
 * e.g., "layer0ThermoData", "layer1ThermoData"
 */
export function getLayerThermoUniformName(layerIndex: number): string {
  return `layer${layerIndex}ThermoData`;
}

/**
 * Get the uniform name for a layer's dynamics texture.
 * e.g., "layer0DynamicsData", "layer1DynamicsData"
 */
export function getLayerDynamicsUniformName(layerIndex: number): string {
  return `layer${layerIndex}DynamicsData`;
}

/**
 * Get the accessor function name for a layer variable.
 * e.g., "getLayer0Temperature", "getLayer1WindU"
 */
export function getAccessorFunctionName(
  layerIndex: number,
  variableName: string
): string {
  const capitalizedVar = variableName.charAt(0).toUpperCase() + variableName.slice(1);
  return `getLayer${layerIndex}${capitalizedVar}`;
}

/**
 * Get the pack function name for a layer's texture type.
 * e.g., "packLayer0Thermo", "packLayer1Dynamics"
 */
export function getPackFunctionName(
  layerIndex: number,
  textureType: 'thermo' | 'dynamics'
): string {
  const capitalizedType = textureType.charAt(0).toUpperCase() + textureType.slice(1);
  return `packLayer${layerIndex}${capitalizedType}`;
}

// =============================================================================
// PHYSICAL CONSTANTS FOR LAYERS
// =============================================================================

/**
 * Calculate the mass of an atmospheric layer per unit area.
 * Uses hydrostatic equation: mass = (P_bottom - P_top) / g
 *
 * @param layerIndex - The layer index
 * @param surfacePressure - Surface pressure in Pa
 * @param gravity - Surface gravity in m/s²
 * @returns Layer mass in kg/m²
 */
export function calculateLayerMass(
  layerIndex: number,
  surfacePressure: number,
  gravity: number
): number {
  const layer = ATMOSPHERE_LAYERS[layerIndex];

  // Calculate absolute pressures from fractional boundaries
  const pBottom = layer.pressureBottom * surfacePressure;
  const pTop = layer.pressureTop * surfacePressure;

  return (pBottom - pTop) / gravity;
}

/**
 * Calculate the heat capacity of an atmospheric layer per unit area.
 * C = mass × cp where cp ≈ 1004 J/(kg·K) for dry air
 *
 * @param layerIndex - The layer index
 * @param surfacePressure - Surface pressure in Pa
 * @param gravity - Surface gravity in m/s²
 * @returns Layer heat capacity in J/(m²·K)
 */
export function calculateLayerHeatCapacity(
  layerIndex: number,
  surfacePressure: number,
  gravity: number
): number {
  const cpDryAir = 1004; // J/(kg·K)
  const mass = calculateLayerMass(layerIndex, surfacePressure, gravity);
  return mass * cpDryAir;
}

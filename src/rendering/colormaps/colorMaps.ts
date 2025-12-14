/**
 * Color mapping functions for visualization
 * All functions take a normalized value [0, 1] and return RGB [0, 1]
 */

export type ColorMapFunction = (value: number) => { r: number; g: number; b: number }

/**
 * Viridis-like perceptually uniform colormap
 */
export const viridis: ColorMapFunction = (value) => {
  // Simplified viridis approximation
  const r = Math.max(0, Math.min(1, 0.267 + 0.533 * value + 0.2 * Math.sin(value * Math.PI)))
  const g = Math.max(0, Math.min(1, 0.004 + 0.873 * value - 0.3 * value * value))
  const b = Math.max(0, Math.min(1, 0.329 - 0.329 * value + 0.5 * Math.sin(value * Math.PI)))
  return { r, g, b }
}

/**
 * Grayscale
 */
export const grayscale: ColorMapFunction = (value) => ({
  r: value,
  g: value,
  b: value,
})

/**
 * Moreland's Smooth Cool-Warm diverging colormap
 * Perceptually uniform diverging colormap designed by Kenneth Moreland
 * Goes from cool blue through neutral lavender to warm red
 * Excellent for scientific visualisation with meaningful center points
 */
export const moreland: ColorMapFunction = (value) => {
  // Control points in RGB (sampled from Moreland's original colormap)
  // These are perceptually uniform in CIELAB space
  const controlPoints = [
    { t: 0.0, r: 0.230, g: 0.299, b: 0.754 },  // Cool blue
    { t: 0.25, r: 0.483, g: 0.570, b: 0.874 }, // Light blue
    { t: 0.5, r: 0.865, g: 0.865, b: 0.865 },  // Neutral gray/lavender
    { t: 0.75, r: 0.943, g: 0.625, b: 0.472 }, // Light red/orange
    { t: 1.0, r: 0.706, g: 0.016, b: 0.150 },  // Warm red
  ]

  // Find the two control points to interpolate between
  let lower = controlPoints[0]
  let upper = controlPoints[controlPoints.length - 1]

  for (let i = 0; i < controlPoints.length - 1; i++) {
    if (value >= controlPoints[i].t && value <= controlPoints[i + 1].t) {
      lower = controlPoints[i]
      upper = controlPoints[i + 1]
      break
    }
  }

  // Linear interpolation between control points
  const range = upper.t - lower.t
  const t = range > 0 ? (value - lower.t) / range : 0

  return {
    r: lower.r + t * (upper.r - lower.r),
    g: lower.g + t * (upper.g - lower.g),
    b: lower.b + t * (upper.b - lower.b),
  }
}

/**
 * Extended black-body radiation colormap
 * Black -> Red -> Orange -> Yellow -> White -> Cyan -> Blue
 * Mimics the color of heating metal
 */
export const blackbody: ColorMapFunction = (value) => {
  if (value < 0.25) {
    // Black to red
    const t = value / 0.25
    return { r: t, g: 0, b: 0 }
  } else if (value < 0.5) {
    // Red to yellow
    const t = (value - 0.25) / 0.25
    return { r: 1, g: t, b: 0 }
  } else if (value < 0.75) {
    // Yellow to white
    const t = (value - 0.5) / 0.25
    return { r: 1, g: 1, b: t }
  } else {
    // White to blue (very hot)
    const t = (value - 0.75) / 0.25
    return { r: 1 - t * 0.3, g: 1 - t * 0.3, b: 1 }
  }
}

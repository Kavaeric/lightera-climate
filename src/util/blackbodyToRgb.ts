/**
 * Converts a blackbody temperature (in Kelvin) to an RGB colour value.
 * 
 * Uses an approximation algorithm based on Planck's law to calculate
 * the colour of a blackbody radiator at a given temperature.
 * 
 * @param temperature - Temperature in Kelvin (typically 1000-40000K for visible colours)
 * @returns A hex colour string (e.g., "#ff0000") that can be used with Three.js
 * 
 * @example
 * ```ts
 * const colour = blackbodyToRgb(6500); // Daylight white
 * // Returns: "#fff9fd"
 * ```
 */
export function blackbodyToRgb(temperature: number): string {
  // Clamp temperature to reasonable range
  const clampedTemp = Math.max(1000, Math.min(40000, temperature));
  
  // Normalise temperature (algorithm expects temperature / 100)
  const temp = clampedTemp / 100;
  
  // Calculate red component
  let r: number;
  if (temp <= 66) {
    r = 255;
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    r = Math.max(0, Math.min(255, r));
  }
  
  // Calculate green component
  let g: number;
  if (temp <= 66) {
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    g = Math.max(0, Math.min(255, g));
  } else {
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    g = Math.max(0, Math.min(255, g));
  }
  
  // Calculate blue component
  let b: number;
  if (temp >= 66) {
    b = 255;
  } else {
    if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
      b = Math.max(0, Math.min(255, b));
    }
  }
  
  // Convert to hex string
  const rHex = Math.round(r).toString(16).padStart(2, '0');
  const gHex = Math.round(g).toString(16).padStart(2, '0');
  const bHex = Math.round(b).toString(16).padStart(2, '0');
  
  return `#${rHex}${gHex}${bHex}`;
}


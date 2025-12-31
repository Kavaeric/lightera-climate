/**
 * Hydrology configuration - water and ice state types
 * Separate layer tracking water phase transitions and ice dynamics
 *
 * This layer sits between elevation (static input) and climate (dynamic output)
 * Evolution: elevation → hydrology → surface properties → climate → hydrology feedback
 */

/**
 * Hydrology state stored in GPU texture
 * Format: RGBA = [waterDepth, iceThickness, unused, salinity]
 *
 * waterDepth: in metres (range 0-10000)
 * iceThickness: in metres (range 0-10000)
 * unused: reserved for future use
 * salinity: in PSU (practical salinity units)
 */
export interface HydrologyTextureFormat {
  r: number // waterDepth (metres)
  g: number // iceThickness (metres)
  b: number // unused
  a: number // salinity (PSU)
}

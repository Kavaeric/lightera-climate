export { GridTextureManager } from './GridTextureManager';
export {
  // Primary API
  cellIndexToUV,
  uvToCellIndex,
  // Lower-level utilities
  indexTo2D,
  coordsToDataIndex,
  // Legacy
  getCellUV,
  // Utilities
  calculateTextureDimensions,
  createDataTextureSettings,
} from './CellAccessors';

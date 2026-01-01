import type { TerrainConfig } from '../config/terrainConfig';
import { createSimpleProcedural } from './terrainGenerators';

/**
 * Loads terrain data from various sources and converts to grid format.
 */
export class TerrainDataLoader {
  /**
   * Generate procedurally created terrain using a seed.
   * Useful for testing and creating varied terrain without image data.
   */
  generateProcedural(
    cellCount: number,
    cellLatLons: Array<{ lat: number; lon: number }>,
    seed: number = 42
  ): TerrainConfig {
    return createSimpleProcedural(cellCount, seed, cellLatLons);
  }

  /**
   * Load terrain from pre-computed elevation array.
   * Assumes array is already in the correct order (indexed by cell index).
   */
  loadFromArrays(elevation: number[]): TerrainConfig {
    return {
      elevation,
    };
  }

  /**
   * Load Earth terrain by combining separate topology and bathymetry heightmaps.
   *
   * @param topologyUrl URL to topology/elevation heightmap (land elevations)
   * @param bathymetryUrl URL to bathymetry heightmap (ocean depths)
   * @param cellCount Number of cells in the geodesic grid
   * @param cellLatLons Array of lat/lon positions for each cell
   * @param options Configuration for how to interpret the heightmaps
   */
  async loadEarthTerrain(
    topologyUrl: string,
    bathymetryUrl: string,
    cellCount: number,
    cellLatLons: Array<{ lat: number; lon: number }>,
    options: {
      topologyScale?: number; // metres for max pixel value (default: 6400 for NASA BMNG)
      bathymetryScale?: number; // metres for max depth (default: 8000 for NASA BMNG)
    } = {}
  ): Promise<TerrainConfig> {
    const topologyScale = options.topologyScale ?? 6400;
    const bathymetryScale = options.bathymetryScale ?? 8000;

    // Load topology (land elevation: 0 to topologyScale metres)
    const topologyData = await this.loadFromHeightmap(
      topologyUrl,
      cellCount,
      cellLatLons,
      {
        elevationScale: topologyScale / 128, // Map 0-255 to 0-topologyScale
        seaLevel: 0, // 0 in image = 0m elevation
      }
    );

    // Load bathymetry (ocean depth: -bathymetryScale to 0 metres)
    const bathymetryData = await this.loadFromHeightmap(
      bathymetryUrl,
      cellCount,
      cellLatLons,
      {
        elevationScale: bathymetryScale / 255, // Map pixel 0-255 to -bathymetryScale-0 metres
        seaLevel: 255, // Pixel 255 in image = 0m (sea level), pixel 0 = -bathymetryScale
      }
    );

    // Combine: use bathymetry for negative elevations (ocean), topology for positive (land)
    const combinedElevation = new Float32Array(cellCount);

    // Debug: sample some values to understand the data
    console.log('Sample terrain values:');
    for (let i = 0; i < Math.min(10, cellCount); i++) {
      console.log(`Cell ${i}: topo=${topologyData.elevation[i].toFixed(1)}m, bathy=${bathymetryData.elevation[i].toFixed(1)}m`);
    }

    for (let i = 0; i < cellCount; i++) {
      const topo = topologyData.elevation[i];
      const bathy = bathymetryData.elevation[i];

      // Use bathymetry if it's below sea level, otherwise use topology
      combinedElevation[i] = bathy < 0 ? bathy : topo;
    }

    return {
      elevation: Array.from(combinedElevation),
    };
  }

  /**
   * Load terrain from an equirectangular heightmap image.
   * Resamples the image to match geodesic grid using bilinear interpolation.
   *
   * @param imageOrUrl Image data or URL to load.
   * @param cellCount Number of cells in the geodesic grid.
   * @param cellLatLons Array of lat/lon positions for each cell.
   * @param options Configuration for heightmap interpretation.
   */
  async loadFromHeightmap(
    imageOrUrl: HTMLImageElement | ImageData | string,
    cellCount: number,
    cellLatLons: Array<{ lat: number; lon: number }>,
    options: {
      elevationScale?: number; // metres per pixel value (default: 1)
      seaLevel?: number; // pixel value for sea level (default: 128 for 8-bit)
    } = {}
  ): Promise<TerrainConfig> {
    const elevationScale = options.elevationScale ?? 1;
    const seaLevel = options.seaLevel ?? 128;

    // Get image data
    let imageData: ImageData;
    if (typeof imageOrUrl === 'string') {
      // Load from URL
      const img = await this.loadImage(imageOrUrl);
      imageData = this.imageToImageData(img);
    } else if (imageOrUrl instanceof HTMLImageElement) {
      imageData = this.imageToImageData(imageOrUrl);
    } else {
      imageData = imageOrUrl;
    }

    // Resample image to geodesic grid
    const elevation = new Float32Array(cellCount);

    const { width, height, data } = imageData;

    for (let i = 0; i < cellCount; i++) {
      const { lat, lon } = cellLatLons[i];

      // Convert lat/lon to equirectangular pixel coordinates
      // Longitude: -180 to 180 → 0 to width
      // Latitude: 90 to -90 → 0 to height (note: image y increases downward)
      const u = ((lon + 180) / 360) * (width - 1);
      const v = ((90 - lat) / 180) * (height - 1);

      // Bilinear interpolation
      const pixelValue = this.bilinearSample(data, width, height, u, v);

      // Convert pixel value to elevation
      // Formula: (pixelValue - seaLevel) * elevationScale
      // The elevationScale parameter should already account for the pixel range (e.g., scale / 255)
      elevation[i] = (pixelValue - seaLevel) * elevationScale;
    }

    return {
      elevation: Array.from(elevation),
    };
  }

  /**
   * Load image from URL.
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image from ${url}`));
      img.src = url;
    });
  }

  /**
   * Convert HTMLImageElement to ImageData.
   */
  private imageToImageData(img: HTMLImageElement): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height);
  }

  /**
   * Bilinear interpolation for image sampling.
   * Samples a grayscale value (uses red channel only).
   */
  private bilinearSample(
    imageData: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number
  ): number {
    // Clamp to image bounds
    x = Math.max(0, Math.min(x, width - 1));
    y = Math.max(0, Math.min(y, height - 1));

    // Get integer and fractional parts
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    // Get the four corner pixels
    const x0 = Math.max(0, Math.min(xi, width - 1));
    const x1 = Math.max(0, Math.min(xi + 1, width - 1));
    const y0 = Math.max(0, Math.min(yi, height - 1));
    const y1 = Math.max(0, Math.min(yi + 1, height - 1));

    // Sample red channel (assuming grayscale, all channels are similar)
    const p00 = imageData[(y0 * width + x0) * 4 + 0]; // Red channel
    const p10 = imageData[(y0 * width + x1) * 4 + 0];
    const p01 = imageData[(y1 * width + x0) * 4 + 0];
    const p11 = imageData[(y1 * width + x1) * 4 + 0];

    // Bilinear interpolation
    const p0 = p00 * (1 - xf) + p10 * xf;
    const p1 = p01 * (1 - xf) + p11 * xf;
    const result = p0 * (1 - yf) + p1 * yf;

    return result;
  }
}

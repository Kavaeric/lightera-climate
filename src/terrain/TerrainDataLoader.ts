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
      topologyMin?: number; // minimum elevation in metres (default: 0)
      topologyMax?: number; // maximum elevation in metres (default: 6400 for NASA BMNG)
      bathymetryMin?: number; // minimum depth in metres (default: -8000 for NASA BMNG)
      bathymetryMax?: number; // maximum depth in metres (default: 0 - sea level)
    } = {}
  ): Promise<TerrainConfig> {
    // Support legacy parameters while adding new min/max parameters
    const topologyMin = options.topologyMin ?? 0;
    const topologyMax = options.topologyMax ?? 6400;
    const bathymetryMin = options.bathymetryMin ?? -8000;
    const bathymetryMax = options.bathymetryMax ?? 0;

    // Load topology (land elevation: topologyMin to topologyMax metres)
    const topologyData = await this.loadFromHeightmap(
      topologyUrl,
      cellCount,
      cellLatLons,
      {
        elevationScale: (topologyMax - topologyMin) / 255, // Map 0-255 to topologyMin-topologyMax
        seaLevel: 0,
      }
    );

    // Load bathymetry (ocean depth: bathymetryMin to bathymetryMax metres)
    const bathymetryData = await this.loadFromHeightmap(
      bathymetryUrl,
      cellCount,
      cellLatLons,
      {
        elevationScale: (bathymetryMax - bathymetryMin) / 255, // Map pixel 0-255 to bathymetryMin-bathymetryMax
        seaLevel: -bathymetryMin / ((bathymetryMax - bathymetryMin) / 255), // Adjust so deepest point maps correctly
      }
    );

    // Combine: use bathymetry for negative elevations (ocean), topology for positive (land)
    const combinedElevation = new Float32Array(cellCount);

    for (let i = 0; i < cellCount; i++) {
      const topo = topologyData.elevation[i];
      const bathy = bathymetryData.elevation[i];

      // Use bathymetry if it's below sea level, otherwise use topology
      combinedElevation[i] = bathy < bathymetryMax ? bathy : topo;
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
    const seaLevel = options.seaLevel ?? 0;

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

      // Bicubic interpolation
      const pixelValue = this.bicubicSample(data, width, height, u, v);

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
   * Catmull-Rom cubic interpolation (1D).
   * Used as helper for bicubic interpolation.
   */
  private cubicInterpolate(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const a0 = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
    const a1 = p0 - 2.5 * p1 + 2.0 * p2 - 0.5 * p3;
    const a2 = -0.5 * p0 + 0.5 * p2;
    const a3 = p1;

    return a0 * t * t * t + a1 * t * t + a2 * t + a3;
  }

  /**
   * Bicubic interpolation for image sampling using Catmull-Rom spline.
   * Samples a grayscale value (uses red channel only).
   * Provides smoother results than bilinear interpolation.
   */
  private bicubicSample(
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

    // Sample 4x4 grid of pixels
    const pixels: number[] = [];
    for (let j = -1; j <= 2; j++) {
      for (let i = -1; i <= 2; i++) {
        const px = Math.max(0, Math.min(xi + i, width - 1));
        const py = Math.max(0, Math.min(yi + j, height - 1));
        // Sample red channel (assuming grayscale, all channels are similar)
        pixels.push(imageData[(py * width + px) * 4 + 0]);
      }
    }

    // Perform bicubic interpolation
    const row0 = this.cubicInterpolate(pixels[0], pixels[1], pixels[2], pixels[3], xf);
    const row1 = this.cubicInterpolate(pixels[4], pixels[5], pixels[6], pixels[7], xf);
    const row2 = this.cubicInterpolate(pixels[8], pixels[9], pixels[10], pixels[11], xf);
    const row3 = this.cubicInterpolate(pixels[12], pixels[13], pixels[14], pixels[15], xf);

    const result = this.cubicInterpolate(row0, row1, row2, row3, yf);

    // Clamp result to valid pixel range [0, 255]
    return Math.max(0, Math.min(255, result));
  }

  /**
   * Bilinear interpolation for image sampling (legacy, replaced by bicubic).
   * Samples a grayscale value (uses red channel only).
   * @deprecated Use bicubicSample instead
   */
  // @ts-expect-error - Kept for reference but not currently used
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

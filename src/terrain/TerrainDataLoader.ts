import type { TerrainConfig } from '../config/terrainConfig';
import { createSimpleProcedural } from './terrainGenerators';
import UPNG from 'upng-js';

/**
 * Interface for 16-bit image data.
 */
interface ImageData16Bit {
  width: number;
  height: number;
  data: Uint16Array; // RGBA, 16-bit per channel
}

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
   * @param heightmapUrl URL to heightmap
   * @param cellCount Number of cells in the geodesic grid
   * @param cellLatLons Array of lat/lon positions for each cell
   * @param options Configuration for how to interpret the heightmaps
   */
  async loadEarthTerrain(
    heightmapUrl: string,
    cellCount: number,
    cellLatLons: Array<{ lat: number; lon: number }>,
    options: {
      elevationMin?: number; // minimum elevation in metres
      elevationMax?: number; // maximum elevation in metres
      bitDepth?: 8 | 16; // bit depth of the image (default: 16 for high precision)
    } = {}
  ): Promise<TerrainConfig> {
    // Support legacy parameters while adding new min/max parameters
    const elevationMin = options.elevationMin ?? -10919;
    const elevationMax = options.elevationMax ?? 8600;
    const bitDepth = options.bitDepth ?? 16;

    // Calculate elevation scale based on bit depth
    const maxPixelValue = bitDepth === 16 ? 65535 : 255;
    const elevationScale = (elevationMax - elevationMin) / maxPixelValue;

    // Load topology (land elevation: topologyMin to topologyMax metres)
    const earthTerrain = await this.loadFromHeightmap(
      heightmapUrl,
      cellCount,
      cellLatLons,
      {
        elevationScale,
        seaLevel: 0,
        bitDepth,
      }
    );

    // Offset by elevationMin to ensure the sea level is at 0
    earthTerrain.elevation = earthTerrain.elevation.map(elevation => elevation + elevationMin);

    return earthTerrain;
  }

  /**
   * Load terrain from an equirectangular heightmap image.
   * Resamples the image to match geodesic grid using bicubic interpolation.
   *
   * @param imageOrUrl Image data or URL to load.
   * @param cellCount Number of cells in the geodesic grid.
   * @param cellLatLons Array of lat/lon positions for each cell.
   * @param options Configuration for heightmap interpretation.
   */
  async loadFromHeightmap(
    imageOrUrl: HTMLImageElement | ImageData | ImageData16Bit | string,
    cellCount: number,
    cellLatLons: Array<{ lat: number; lon: number }>,
    options: {
      elevationScale?: number; // metres per pixel value (default: 1)
      seaLevel?: number; // pixel value for sea level
      bitDepth?: 8 | 16; // bit depth of the image (default: 8)
    } = {}
  ): Promise<TerrainConfig> {
    const elevationScale = options.elevationScale ?? 1;
    const seaLevel = options.seaLevel ?? 0;
    const bitDepth = options.bitDepth ?? 8;

    // Get image data
    let imageData8: ImageData | null = null;
    let imageData16: ImageData16Bit | null = null;

    if (typeof imageOrUrl === 'string') {
      // Load from URL using parse-png for proper 16-bit support
      if (bitDepth === 16) {
        imageData16 = await this.loadPngFromUrl(imageOrUrl);
      } else {
        // For 8-bit, we can still use the browser's Image API for compatibility
        const img = await this.loadImage(imageOrUrl);
        imageData8 = this.imageToImageData(img);
      }
    } else if (imageOrUrl instanceof HTMLImageElement) {
      // For HTMLImageElement, convert to ImageData (8-bit only, browser limitation)
      imageData8 = this.imageToImageData(imageOrUrl);
      if (bitDepth === 16) {
        console.warn('[TerrainDataLoader] HTMLImageElement cannot preserve 16-bit precision, using 8-bit data');
      }
    } else if ('data' in imageOrUrl && imageOrUrl.data instanceof Uint16Array) {
      // Already 16-bit ImageData
      imageData16 = imageOrUrl as ImageData16Bit;
    } else {
      // 8-bit ImageData
      imageData8 = imageOrUrl as ImageData;
    }

    // Resample image to geodesic grid
    const elevation = new Float32Array(cellCount);

    if (imageData16) {
      const { width, height, data } = imageData16;
      for (let i = 0; i < cellCount; i++) {
        const { lat, lon } = cellLatLons[i];
        const u = ((lon + 180) / 360) * (width - 1);
        const v = ((90 - lat) / 180) * (height - 1);
        const pixelValue = this.bicubicSample16Bit(data, width, height, u, v);
        elevation[i] = (pixelValue - seaLevel) * elevationScale;
      }
    } else if (imageData8) {
      const { width, height, data } = imageData8;
      for (let i = 0; i < cellCount; i++) {
        const { lat, lon } = cellLatLons[i];
        const u = ((lon + 180) / 360) * (width - 1);
        const v = ((90 - lat) / 180) * (height - 1);
        const pixelValue = this.bicubicSample8Bit(data, width, height, u, v);
        elevation[i] = (pixelValue - seaLevel) * elevationScale;
      }
    } else {
      throw new Error('Failed to load image data');
    }

    return {
      elevation: Array.from(elevation),
    };
  }

  /**
   * Load image from URL (8-bit, uses browser's Image API).
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
   * Load and parse PNG from URL using UPNG.js.
   */
  private async loadPngFromUrl(url: string): Promise<ImageData16Bit> {
    // Fetch PNG as ArrayBuffer
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PNG from ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // Parse PNG using UPNG.js
    const png = UPNG.decode(new Uint8Array(arrayBuffer));
    
    if (!png) {
      throw new Error(`Failed to decode PNG from ${url}`);
    }

    const width = png.width;
    const height = png.height;
    const depth = png.depth; // Bit depth: 8 or 16
    const ctype = png.ctype; // Color type: 0=grayscale, 2=RGB, 4=grayscale+alpha, 6=RGBA

    // Handle different bit depths
    if (depth === 16) {
      // 16-bit PNG: use raw data property to preserve precision
      // png.data contains raw pixel data in big-endian format (decompressed and unfiltered)
      const rawData = png.data; // Uint8Array with raw pixel data
      const data16 = new Uint16Array(width * height * 4);

      // Determine channels per pixel based on color type
      const hasAlpha = ctype === 4 || ctype === 6; // Grayscale+Alpha or RGBA
      const isGrayscale = ctype === 0 || ctype === 4; // Grayscale or Grayscale+Alpha
      const channelsPerPixel = hasAlpha ? (isGrayscale ? 2 : 4) : (isGrayscale ? 1 : 3);

      // PNG stores 16-bit values as big-endian, convert to little-endian
      let srcIdx = 0;
      let dstIdx = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (isGrayscale) {
            // Grayscale: read 16-bit value (big-endian)
            const gray = (rawData[srcIdx] << 8) | rawData[srcIdx + 1];
            data16[dstIdx + 0] = gray; // R
            data16[dstIdx + 1] = gray; // G
            data16[dstIdx + 2] = gray; // B
            data16[dstIdx + 3] = hasAlpha
              ? (rawData[srcIdx + 2] << 8) | rawData[srcIdx + 3]
              : 65535; // A
            srcIdx += channelsPerPixel * 2; // 2 bytes per 16-bit channel
            dstIdx += 4;
          } else {
            // RGB/RGBA: read red channel for heightmap (assuming grayscale heightmap)
            const red = (rawData[srcIdx] << 8) | rawData[srcIdx + 1];
            data16[dstIdx + 0] = red; // R
            data16[dstIdx + 1] = red; // G
            data16[dstIdx + 2] = red; // B
            data16[dstIdx + 3] = hasAlpha
              ? (rawData[srcIdx + 6] << 8) | rawData[srcIdx + 7]
              : 65535; // A
            srcIdx += channelsPerPixel * 2; // 2 bytes per 16-bit channel
            dstIdx += 4;
          }
        }
      }

      return {
        width,
        height,
        data: data16,
      };
    } else {
      // 8-bit PNG: use toRGBA8() and scale to 16-bit range
      const rgba = UPNG.toRGBA8(png)[0]; // Returns array of frames, get first frame
      const data16 = new Uint16Array(width * height * 4);
      
      // Determine if grayscale or RGB based on color type
      const isGrayscale = ctype === 0 || ctype === 4; // Grayscale or Grayscale+Alpha
      const hasAlpha = ctype === 4 || ctype === 6; // Grayscale+Alpha or RGBA
      
      if (isGrayscale) {
        // Grayscale: use red channel for all channels
        for (let i = 0; i < width * height; i++) {
          const gray = rgba[i * 4 + 0]; // Red channel
          data16[i * 4 + 0] = (gray << 8) | gray; // R
          data16[i * 4 + 1] = (gray << 8) | gray; // G
          data16[i * 4 + 2] = (gray << 8) | gray; // B
          data16[i * 4 + 3] = hasAlpha
            ? ((rgba[i * 4 + 3] << 8) | rgba[i * 4 + 3])
            : 65535; // A
        }
      } else {
        // RGB/RGBA: use red channel for heightmap (assuming grayscale heightmap)
        for (let i = 0; i < width * height; i++) {
          const red = rgba[i * 4 + 0];
          data16[i * 4 + 0] = (red << 8) | red; // R
          data16[i * 4 + 1] = (red << 8) | red; // G
          data16[i * 4 + 2] = (red << 8) | red; // B
          data16[i * 4 + 3] = hasAlpha
            ? ((rgba[i * 4 + 3] << 8) | rgba[i * 4 + 3])
            : 65535; // A
        }
      }

      return {
        width,
        height,
        data: data16,
      };
    }
  }

  /**
   * Convert HTMLImageElement to ImageData (8-bit).
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
   * Bicubic interpolation for 8-bit image sampling using Catmull-Rom spline.
   * Samples a grayscale value (uses red channel only).
   */
  private bicubicSample8Bit(
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
        const index = (py * width + px) * 4 + 0;
        pixels.push(imageData[index]);
      }
    }

    // Perform bicubic interpolation
    const row0 = this.cubicInterpolate(pixels[0], pixels[1], pixels[2], pixels[3], xf);
    const row1 = this.cubicInterpolate(pixels[4], pixels[5], pixels[6], pixels[7], xf);
    const row2 = this.cubicInterpolate(pixels[8], pixels[9], pixels[10], pixels[11], xf);
    const row3 = this.cubicInterpolate(pixels[12], pixels[13], pixels[14], pixels[15], xf);

    const result = this.cubicInterpolate(row0, row1, row2, row3, yf);

    // Clamp result to valid pixel range (0-255)
    return Math.max(0, Math.min(255, result));
  }

  /**
   * Bicubic interpolation for 16-bit image sampling using Catmull-Rom spline.
   * Samples a grayscale value (uses red channel only).
   */
  private bicubicSample16Bit(
    imageData: Uint16Array,
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
        const index = (py * width + px) * 4 + 0;
        pixels.push(imageData[index]);
      }
    }

    // Perform bicubic interpolation
    const row0 = this.cubicInterpolate(pixels[0], pixels[1], pixels[2], pixels[3], xf);
    const row1 = this.cubicInterpolate(pixels[4], pixels[5], pixels[6], pixels[7], xf);
    const row2 = this.cubicInterpolate(pixels[8], pixels[9], pixels[10], pixels[11], xf);
    const row3 = this.cubicInterpolate(pixels[12], pixels[13], pixels[14], pixels[15], xf);

    const result = this.cubicInterpolate(row0, row1, row2, row3, yf);

    // Clamp result to valid pixel range (0-65535)
    return Math.max(0, Math.min(65535, result));
  }

  /**
   * Bilinear interpolation for image sampling (legacy, replaced by bicubic).
   * Samples a grayscale value (uses red channel only).
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

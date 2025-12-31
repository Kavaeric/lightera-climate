import * as THREE from 'three'
import { kDistributionData, wavelengthBinWidthData } from '../gasTextures/co2'

/**
 * Create texture containing k-distribution data for radiative transfer
 *
 * Wraps pre-computed HITRAN k-distribution data in a GPU texture.
 * The data is pre-processed by scripts/convertHitranToTS.js to avoid runtime overhead.
 *
 * Texture format:
 *   - Size: 128×1 (one texel per wavelength bin)
 *   - Format: RGBA (stores 4 k-values per bin)
 *   - Type: FloatType (high precision needed for k-values)
 *   - Data: k-values in cm²/molecule
 *
 * @returns DataTexture containing k-values for CO2
 */
export function createKDistributionTexture(): THREE.DataTexture {
	const texture = new THREE.DataTexture(
		kDistributionData,
		128, // width
		1,   // height
		THREE.RGBAFormat,
		THREE.FloatType
	)

	texture.minFilter = THREE.NearestFilter
	texture.magFilter = THREE.NearestFilter
	texture.wrapS = THREE.ClampToEdgeWrapping
	texture.wrapT = THREE.ClampToEdgeWrapping
	texture.needsUpdate = true

	return texture
}

/**
 * Create texture containing wavelength bin centers and widths
 *
 * Texture format:
 *   - Size: 128×1 (one texel per wavelength bin)
 *   - Format: RG (R = wavelength in μm, G = binWidth in μm)
 *   - Type: FloatType (high precision)
 *
 * @returns DataTexture containing wavelength + binWidth for CO2
 */
export function createWavelengthBinWidthTexture(): THREE.DataTexture {
	const texture = new THREE.DataTexture(
		wavelengthBinWidthData,
		128, // width
		1,   // height
		THREE.RGFormat,
		THREE.FloatType
	)

	texture.minFilter = THREE.NearestFilter
	texture.magFilter = THREE.NearestFilter
	texture.wrapS = THREE.ClampToEdgeWrapping
	texture.wrapT = THREE.ClampToEdgeWrapping
	texture.needsUpdate = true

	return texture
}

/**
 * Get wavelength data for use in Planck lookup table generation.
 * Extracts wavelength values from the combined wavelength + binWidth data.
 */
export function getWavelengthData(): Float32Array {
	// Extract R channel (wavelength) from RG format
	const wavelengths = new Float32Array(128);
	for (let i = 0; i < 128; i++) {
		wavelengths[i] = wavelengthBinWidthData[i * 2]; // R channel
	}
	return wavelengths;
}

import * as THREE from 'three'
import { kDistributionData, wavelengthData } from '../data/gasTextures/co2'

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
 * Create texture containing wavelength bin centers
 *
 * Wraps pre-computed wavelength data in a GPU texture.
 * The data is pre-processed by scripts/convertHitranToTS.js to avoid runtime overhead.
 *
 * Texture format:
 *   - Size: 128×1 (one texel per wavelength bin)
 *   - Format: RED (single channel, wavelength in μm)
 *   - Type: FloatType (high precision)
 *
 * @returns DataTexture containing wavelengths in micrometers for CO2
 */
export function createWavelengthTexture(): THREE.DataTexture {
	const texture = new THREE.DataTexture(
		wavelengthData,
		128, // width
		1,   // height
		THREE.RedFormat,
		THREE.FloatType
	)

	texture.minFilter = THREE.NearestFilter
	texture.magFilter = THREE.NearestFilter
	texture.wrapS = THREE.ClampToEdgeWrapping
	texture.wrapT = THREE.ClampToEdgeWrapping
	texture.needsUpdate = true

	return texture
}

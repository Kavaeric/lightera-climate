import * as THREE from 'three'
import { kDistributionData as co2K, wavelengthBinWidthData } from '../data/gasTextures/co2'
import { kDistributionData as h2oK } from '../data/gasTextures/h2o'
import { kDistributionData as ch4K } from '../data/gasTextures/ch4'
import { kDistributionData as n2oK } from '../data/gasTextures/n2o'
import { kDistributionData as o3K } from '../data/gasTextures/o3'
import { kDistributionData as o2K } from '../data/gasTextures/o2'
import { kDistributionData as n2K } from '../data/gasTextures/n2'

/**
 * Gas types supported by the radiative transfer model
 */
export type GasType = 'co2' | 'h2o' | 'ch4' | 'n2o' | 'o3' | 'o2' | 'n2'

/**
 * Create a combined k-distribution texture containing all gases
 *
 * Texture layout: numBins×7 (wavelength bins × 7 gases)
 * Each texel contains RGBA = [k0, k1, k2, k3]
 *
 * Row mapping:
 *   y=0: CO2
 *   y=1: H2O
 *   y=2: CH4
 *   y=3: N2O
 *   y=4: O3
 *   y=5: O2
 *   y=6: N2
 */
export function createMultiGasKDistributionTexture(): THREE.DataTexture {
	const numGases = 7
	const numKValues = 4 // RGBA channels

	// Gas order matches shader constants
	const gasData = [co2K, h2oK, ch4K, n2oK, o3K, o2K, n2K]

	// Detect number of bins from first gas data (all gases should have same size)
	// Data format: numBins × numKValues
	if (gasData[0].length % numKValues !== 0) {
		throw new Error(
			`[Multi-Gas K-Distribution] Invalid data size: ${gasData[0].length} elements is not divisible by ${numKValues}`
		)
	}
	const numBins = gasData[0].length / numKValues

	// Validate all gases have the same size
	for (let gasIdx = 0; gasIdx < numGases; gasIdx++) {
		const gasK = gasData[gasIdx]
		const expectedSize = numBins * numKValues
		if (gasK.length !== expectedSize) {
			throw new Error(
				`[Multi-Gas K-Distribution] Gas ${gasIdx} data size mismatch: expected ${expectedSize} elements (${numBins} bins × ${numKValues} k-values), got ${gasK.length}`
			)
		}
	}

	const data = new Float32Array(numBins * numGases * numKValues)

	for (let gasIdx = 0; gasIdx < numGases; gasIdx++) {
		const gasK = gasData[gasIdx]
		for (let binIdx = 0; binIdx < numBins; binIdx++) {
			const srcOffset = binIdx * numKValues
			const dstOffset = (gasIdx * numBins + binIdx) * numKValues

			data[dstOffset + 0] = gasK[srcOffset + 0] // k0 (R channel)
			data[dstOffset + 1] = gasK[srcOffset + 1] // k1 (G channel)
			data[dstOffset + 2] = gasK[srcOffset + 2] // k2 (B channel)
			data[dstOffset + 3] = gasK[srcOffset + 3] // k3 (A channel)
		}
	}

	// Validate output data size
	const expectedSize = numBins * numGases * numKValues
	if (data.length !== expectedSize) {
		throw new Error(
			`[Multi-Gas K-Distribution] Output data size mismatch: expected ${expectedSize} elements, got ${data.length}`
		)
	}

	console.log(`[Multi-Gas K-Distribution] Created texture: ${numBins}×${numGases} (${numBins} bins detected from data)`)
	
	// Warning: Shader expects 128 bins, but data has ${numBins} bins
	// This mismatch may cause incorrect radiative transfer calculations
	// Regenerate data with 128 bins or update shader to use ${numBins} bins
	if (numBins !== 128) {
		console.warn(
			`[Multi-Gas K-Distribution] WARNING: Data has ${numBins} bins but shader expects 128 bins. ` +
			`This may cause incorrect calculations. Regenerate data with 128 bins or update shader.`
		)
	}

	const texture = new THREE.DataTexture(
		data,
		numBins, // width = 128
		numGases, // height = 7
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
 * Create wavelength + binWidth texture (same for all gases)
 */
export function createWavelengthBinWidthTexture(): THREE.DataTexture {
	// Detect number of bins from data size
	// Data format: numBins × 2 (RG channels: wavelength, binWidth)
	if (wavelengthBinWidthData.length % 2 !== 0) {
		throw new Error(
			`[Wavelength Bin Width] Invalid data size: ${wavelengthBinWidthData.length} elements is not divisible by 2`
		)
	}
	const numBins = wavelengthBinWidthData.length / 2

	const texture = new THREE.DataTexture(
		wavelengthBinWidthData,
		numBins, // width (detected from data)
		1,       // height
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

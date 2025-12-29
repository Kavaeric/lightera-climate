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
 * Texture layout: 128×7 (128 wavelength bins × 7 gases)
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
	const numBins = 128
	const numGases = 7
	const data = new Float32Array(numBins * numGases * 4)

	// Gas order matches shader constants
	const gasData = [co2K, h2oK, ch4K, n2oK, o3K, o2K, n2K]

	for (let gasIdx = 0; gasIdx < numGases; gasIdx++) {
		const gasK = gasData[gasIdx]
		for (let binIdx = 0; binIdx < numBins; binIdx++) {
			const srcOffset = binIdx * 4
			const dstOffset = (gasIdx * numBins + binIdx) * 4

			data[dstOffset + 0] = gasK[srcOffset + 0] // k0 (R channel)
			data[dstOffset + 1] = gasK[srcOffset + 1] // k1 (G channel)
			data[dstOffset + 2] = gasK[srcOffset + 2] // k2 (B channel)
			data[dstOffset + 3] = gasK[srcOffset + 3] // k3 (A channel)
		}
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

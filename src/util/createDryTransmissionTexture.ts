import * as THREE from 'three'
import { kDistributionData as co2K } from '../data/gasTextures/co2'
import { kDistributionData as ch4K } from '../data/gasTextures/ch4'
import { kDistributionData as n2oK } from '../data/gasTextures/n2o'
import { kDistributionData as o3K } from '../data/gasTextures/o3'
import { kDistributionData as coK } from '../data/gasTextures/co'
import { kDistributionData as so2K } from '../data/gasTextures/so2'
import { kDistributionData as hclK } from '../data/gasTextures/hcl'
import { kDistributionData as hfK } from '../data/gasTextures/hfl'
import { wavelengthBinWidthData } from '../data/gasTextures/co2'
import { planckLookupData, PLANCK_LOOKUP_CONFIG } from '../data/gasTextures/planckLookup'

/**
 * Configuration for the dry transmission lookup texture
 */
export const DRY_TRANSMISSION_CONFIG = {
	tempMin: PLANCK_LOOKUP_CONFIG.tempMin,
	tempMax: PLANCK_LOOKUP_CONFIG.tempMax,
	tempStep: PLANCK_LOOKUP_CONFIG.tempStep,
	numTemps: PLANCK_LOOKUP_CONFIG.numTemps,
} as const

/**
 * Number of wavelength bins in the k-distribution data
 */
const NUM_WAVELENGTH_BINS = 128

/**
 * Number of k-values per wavelength bin (for correlated-k method)
 */
const NUM_K_VALUES = 4

/**
 * Pre-computed weight for k-distribution (equal weights)
 */
const K_WEIGHT = 1.0 / NUM_K_VALUES

/**
 * Gas indices for dry atmosphere gases (excludes H2O)
 * These are radiatively active gases with permanent dipole moments
 */
const DRY_GAS_DATA = [
	{ data: co2K, name: 'CO2' },
	{ data: ch4K, name: 'CH4' },
	{ data: n2oK, name: 'N2O' },
	{ data: o3K, name: 'O3' },
	{ data: coK, name: 'CO' },
	{ data: so2K, name: 'SO2' },
	{ data: hclK, name: 'HCl' },
	{ data: hfK, name: 'HF' },
	// Note: O2 and N2 are excluded as they have negligible IR absorption
]

/**
 * Gas concentration configuration for dry transmission calculation
 * These are the default planetary atmospheric concentrations
 */
export interface DryGasConcentrations {
	co2: number  // molar fraction
	ch4: number  // molar fraction
	n2o: number  // molar fraction
	o3: number   // molar fraction
	co: number   // molar fraction
	so2: number  // molar fraction
	hcl: number  // molar fraction
	hf: number   // molar fraction
}

/**
 * Calculate transmission for a single wavelength bin for a specific gas
 *
 * T_bin = Σ w_i × exp(-k_i × N)
 *
 * @param kValues Array of 4 k-values for this bin (cm²/molecule)
 * @param columnDensity Gas column density (molecules/cm²)
 * @returns Transmission coefficient [0, 1]
 */
function calculateBinTransmission(kValues: number[], columnDensity: number): number {
	let transmission = 0.0
	for (let i = 0; i < NUM_K_VALUES; i++) {
		const opticalDepth = kValues[i] * columnDensity
		transmission += K_WEIGHT * Math.exp(-opticalDepth)
	}
	return transmission
}

/**
 * Get k-values for a specific gas and wavelength bin
 *
 * @param gasData The k-distribution data array for this gas
 * @param binIndex Wavelength bin index (0-127)
 * @returns Array of 4 k-values
 */
function getKValues(gasData: Float32Array, binIndex: number): number[] {
	const offset = binIndex * NUM_K_VALUES
	return [
		gasData[offset + 0],
		gasData[offset + 1],
		gasData[offset + 2],
		gasData[offset + 3],
	]
}

/**
 * Get Planck spectral exitance from lookup data
 *
 * @param binIndex Wavelength bin index (0-127)
 * @param tempIndex Temperature index (0-999)
 * @returns Spectral exitance in W/(m²·μm)
 */
function getPlanckValue(binIndex: number, tempIndex: number): number {
	const index = tempIndex * NUM_WAVELENGTH_BINS + binIndex
	return planckLookupData[index]
}

/**
 * Calculate blackbody-weighted dry transmission for a given temperature
 *
 * This computes the effective transmission coefficient for all dry gases
 * (CO2, CH4, N2O, O3, CO, SO2, HCl, HF) weighted by the Planck blackbody spectrum.
 *
 * T_eff = (∫ T_total(λ) B(λ,T) dλ) / (∫ B(λ,T) dλ)
 *
 * @param tempIndex Temperature index (0-999, corresponding to 1-1000K)
 * @param columnDensities Array of column densities for each dry gas
 * @returns Effective transmission coefficient [0, 1]
 */
function calculateDryTransmission(
	tempIndex: number,
	columnDensities: number[]
): number {
	let totalFlux = 0.0
	let transmittedFlux = 0.0

	// Integrate over wavelength bins (exclude last bin which has zero width)
	for (let binIndex = 0; binIndex < NUM_WAVELENGTH_BINS - 1; binIndex++) {
		// Get bin width (wavelength not needed for transmission calculation)
		const binWidth = wavelengthBinWidthData[binIndex * 2 + 1]

		// Get Planck spectral exitance for this temperature and wavelength
		const spectralExitance = getPlanckValue(binIndex, tempIndex)
		const binFlux = spectralExitance * binWidth

		// Calculate combined transmission for all dry gases (multiplicative - Beer's law)
		let transmission = 1.0
		for (let gasIdx = 0; gasIdx < DRY_GAS_DATA.length; gasIdx++) {
			const gasK = DRY_GAS_DATA[gasIdx].data
			const kValues = getKValues(gasK, binIndex)
			const gasTransmission = calculateBinTransmission(kValues, columnDensities[gasIdx])
			transmission *= gasTransmission
		}

		// Accumulate weighted fluxes
		totalFlux += binFlux
		transmittedFlux += binFlux * transmission
	}

	// Return fraction transmitted
	return totalFlux > 0 ? transmittedFlux / totalFlux : 1.0
}

/**
 * Calculate total atmospheric column density from surface pressure and gravity
 *
 * Uses hydrostatic equilibrium: N_total = (P / g) / m_mean
 *
 * @param pressure_Pa Surface pressure in Pascals
 * @param gravity Surface gravity in m/s²
 * @param meanMolecularMass Mean molecular mass in kg/molecule
 * @returns Column density in molecules/cm²
 */
function calculateColumnDensity(
	pressure_Pa: number,
	gravity: number,
	meanMolecularMass: number
): number {
	// N = (P / g) / m_mean in molecules/m²
	const totalColumn_m2 = pressure_Pa / gravity / meanMolecularMass
	// Convert to molecules/cm² (1 m² = 10⁴ cm²)
	return totalColumn_m2 / 1e4
}

export interface DryTransmissionTextureConfig {
	surfacePressure: number      // Pa
	surfaceGravity: number       // m/s²
	meanMolecularMass: number    // kg/molecule
	gasConcentrations: DryGasConcentrations
}

/**
 * Create dry transmission lookup texture
 *
 * Pre-computes the blackbody-weighted transmission coefficient for dry gases
 * (CO2, CH4, N2O, O3, CO, SO2, HCl, HF) across the temperature range. This allows
 * the GPU to look up dry transmission with a single texture fetch instead of
 * computing ~1000 transmission calculations per fragment.
 *
 * The resulting texture is indexed by temperature and returns the effective
 * transmission coefficient for the entire dry atmosphere.
 *
 * Texture format:
 *   - Size: 1 × numTemps (1 × 1000)
 *   - Format: RED (single channel, transmission coefficient [0, 1])
 *   - Type: FloatType (high precision)
 *   - Temperature range: 1-1000K in 1K steps
 *
 * @param config Configuration containing atmospheric properties
 * @returns DataTexture containing pre-computed dry transmission values
 */
export function createDryTransmissionTexture(
	config: DryTransmissionTextureConfig
): THREE.DataTexture {
	const { surfacePressure, surfaceGravity, meanMolecularMass, gasConcentrations } = config
	const { numTemps } = DRY_TRANSMISSION_CONFIG

	console.log('[Dry Transmission] Computing lookup texture...')
	console.log(`  Temperature range: ${DRY_TRANSMISSION_CONFIG.tempMin}-${DRY_TRANSMISSION_CONFIG.tempMax}K`)
	console.log(`  Surface pressure: ${surfacePressure} Pa`)
	console.log(`  Surface gravity: ${surfaceGravity} m/s²`)

	// Calculate total column density
	const totalColumn = calculateColumnDensity(surfacePressure, surfaceGravity, meanMolecularMass)
	console.log(`  Total column density: ${totalColumn.toExponential(3)} molecules/cm²`)

	// Calculate column densities for each dry gas
	const columnDensities = [
		totalColumn * gasConcentrations.co2,
		totalColumn * gasConcentrations.ch4,
		totalColumn * gasConcentrations.n2o,
		totalColumn * gasConcentrations.o3,
		totalColumn * gasConcentrations.co,
		totalColumn * gasConcentrations.so2,
		totalColumn * gasConcentrations.hcl,
		totalColumn * gasConcentrations.hf,
	]

	console.log('  Gas column densities:')
	DRY_GAS_DATA.forEach((gas, idx) => {
		console.log(`    ${gas.name}: ${columnDensities[idx].toExponential(3)} molecules/cm²`)
	})

	// Allocate texture data
	const data = new Float32Array(numTemps)

	// Compute transmission for each temperature
	for (let tempIdx = 0; tempIdx < numTemps; tempIdx++) {
		data[tempIdx] = calculateDryTransmission(tempIdx, columnDensities)
	}

	// Log some sample values for debugging
	const sampleTemps = [200, 255, 288, 300, 400]
	console.log('  Sample transmission values:')
	sampleTemps.forEach(temp => {
		const idx = temp - DRY_TRANSMISSION_CONFIG.tempMin
		if (idx >= 0 && idx < numTemps) {
			console.log(`    ${temp}K: ${data[idx].toFixed(4)}`)
		}
	})

	// Validate data size matches expected texture size
	// For RedFormat: expected size = width * height * 1 channel
	const expectedSize = numTemps * 1 * 1
	if (data.length !== expectedSize) {
		throw new Error(
			`[Dry Transmission] Data size mismatch: expected ${expectedSize} elements, got ${data.length}`
		)
	}

	// Create texture
	const texture = new THREE.DataTexture(
		data,
		numTemps,  // width = temperatures
		1,         // height = 1 (1D lookup)
		THREE.RedFormat,
		THREE.FloatType
	)

	// Use linear filtering for smooth temperature interpolation
	texture.minFilter = THREE.LinearFilter
	texture.magFilter = THREE.LinearFilter
	texture.wrapS = THREE.ClampToEdgeWrapping
	texture.wrapT = THREE.ClampToEdgeWrapping
	texture.needsUpdate = true

	console.log(`[Dry Transmission] Texture created: ${numTemps}×1 (${data.length} elements)`)

	return texture
}

/**
 * Get configuration for shader uniforms
 */
export function getDryTransmissionConfig() {
	return {
		tempMin: DRY_TRANSMISSION_CONFIG.tempMin,
		tempMax: DRY_TRANSMISSION_CONFIG.tempMax,
		numTemps: DRY_TRANSMISSION_CONFIG.numTemps,
	}
}

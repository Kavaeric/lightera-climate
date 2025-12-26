import React from 'react'
import { ch4Spectrum, co2Spectrum, n2oSpectrum, o3Spectrum, waterVapourSpectrum } from './spectraData'
import { LinePath, Bar, AreaClosed } from '@visx/shape'
import { scaleLog, scaleLinear } from '@visx/scale'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { LinearGradient } from '@visx/gradient';
import { Group } from '@visx/group'

// === LOG-BINNING UTILITIES ===

// Generate N log-spaced wavelength bins from min to max
const generateLogBins = (min: number, max: number, n: number): number[] => {
	return Array.from({length: n}, (_, i) =>
		min * Math.pow(max / min, i / (n - 1))
	);
};

// Compute bin widths for proper weighted averaging
const computeBinWidths = (bins: number[]): number[] => {
	return bins.map((_, i) => {
		if (i === 0) return bins[1] - bins[0];
		if (i === bins.length - 1) return bins[i] - bins[i - 1];
		return (bins[i + 1] - bins[i - 1]) / 2;
	});
};

// Bin irregular CSV data into the log grid using linear interpolation
const binSpectrum = (
	csvData: Array<[number, number]>, // [wavelength, absorption] pairs
	bins: number[]
): number[] => {
	// Sort CSV data by wavelength
	const sorted = [...csvData].sort((a, b) => a[0] - b[0]);

	return bins.map(binWavelength => {
		// Find surrounding points in the CSV data
		let i = 0;
		while (i < sorted.length && sorted[i][0] < binWavelength) i++;

		// Edge cases
		if (i === 0) return sorted[0][1]; // extrapolate from first point
		if (i === sorted.length) return sorted[sorted.length - 1][1]; // extrapolate from last point

		// Linear interpolation between sorted[i-1] and sorted[i]
		const [λ1, a1] = sorted[i - 1];
		const [λ2, a2] = sorted[i];
		const t = (binWavelength - λ1) / (λ2 - λ1);
		return a1 + t * (a2 - a1);
	});
};

// Weighted average accounting for bin widths
const weightedAverageAbsorption = (
	binnedValues: number[],
	binWidths: number[]
): number => {
	let totalValue = 0;
	let totalWidth = 0;

	binnedValues.forEach((value, i) => {
		totalValue += value * binWidths[i];
		totalWidth += binWidths[i];
	});

	return totalValue / totalWidth;
};

// Planck's law for blackbody radiation - spectral exitance (total hemispheric emission)
// Returns spectral exitance in W/(m²·μm) for a given wavelength (μm) and temperature (K)
const planckSpectralExitance = (wavelength_um: number, temperature_K: number): number => {
	const h = 6.62607015e-34; // Planck constant (J·s)
	const c = 299792458; // Speed of light (m/s)
	const k = 1.380649e-23; // Boltzmann constant (J/K)

	const wavelength_m = wavelength_um * 1e-6; // Convert μm to m

	// Spectral radiance (per steradian)
	const numerator = 2 * h * c * c;
	const denominator = Math.pow(wavelength_m, 5) * (Math.exp((h * c) / (wavelength_m * k * temperature_K)) - 1);
	const spectralRadiance = numerator / denominator;

	// Convert to spectral exitance (total hemispheric emission) by multiplying by π
	return (spectralRadiance * Math.PI) * 1e-6; // Convert from W/(m²·m) to W/(m²·μm)
};

// === SETUP ===

const NUM_BINS = 256;
const WAVELENGTH_MIN = 1.0; // micrometers
const WAVELENGTH_MAX = 70.0; // micrometers

// Atmospheric parameters
const SCALE_HEIGHT = 8500; // meters (Earth-like)

// === PHYSICAL INTERPRETATION OF CSV DATA ===
// The CSV absorption values (0-1) from the Wikipedia chart represent ABSORPTANCE
// (fraction absorbed) for a standard Earth atmosphere column at REFERENCE concentrations.
//
// To use this data for arbitrary atmospheres:
// 1. CSV value = absorptance = 1 - transmission_ref
// 2. transmission_ref = exp(-tau_ref) where tau_ref is optical depth at reference conditions
// 3. tau_ref = -ln(transmission_ref) = -ln(1 - absorptance)
// 4. For arbitrary atmosphere: tau = tau_ref × (concentration / concentration_ref)
//
// Reference concentrations (Earth's atmosphere used in the Wikipedia chart):
const REF_CO2_CONCENTRATION = 412 * 1e-6; // 412 ppm (approximate modern Earth)
const REF_H2O_CONCENTRATION = 15000 * 1e-6; // 15000 ppm (varies greatly with location/altitude)
const REF_CH4_CONCENTRATION = 1.79 * 1e-6; //1.79 ppm
const REF_N2O_CONCENTRATION = 0.33 * 1e-6; // 0.33 ppm
const REF_O3_CONCENTRATION = 4 * 1e-7; // Variable, ~0.00004% average

// Gas-specific reference concentration lookup
const getRefConcentration = (gas: string): number => {
	switch(gas) {
		case 'co2': return REF_CO2_CONCENTRATION;
		case 'h2o': return REF_H2O_CONCENTRATION;
		case 'ch4': return REF_CH4_CONCENTRATION;
		case 'n2o': return REF_N2O_CONCENTRATION;
		case 'o3': return REF_O3_CONCENTRATION;
		default: return 1.0; // Default for unknown gases
	}
};

const bins = generateLogBins(WAVELENGTH_MIN, WAVELENGTH_MAX, NUM_BINS);
const binWidths = computeBinWidths(bins);

// Bin the real gas spectra
const co2Binned = binSpectrum(co2Spectrum, bins);
const h2oBinned = binSpectrum(waterVapourSpectrum, bins);
const ch4Binned = binSpectrum(ch4Spectrum, bins);
const n2oBinned = binSpectrum(n2oSpectrum, bins);
const o3Binned = binSpectrum(o3Spectrum, bins);
const gasMixture = [
	{
		gas: 'co2',
		concentration: 412 * 1e-6, // 400 ppm (volume fraction)
		binnedAbsorption: co2Binned,
	},
	{
		gas: 'h2o',
		concentration: 15000 * 1e-6, // 15000 ppm (volume fraction)
		binnedAbsorption: h2oBinned,
	},
	{
		gas: 'ch4',
		concentration: 1.79 * 1e-6, // 1.79 ppm (volume fraction)
		binnedAbsorption: ch4Binned,
	},
	{
		gas: 'n2o',
		concentration: 0.33 * 1e-6, // 0.33 ppm (volume fraction)
		binnedAbsorption: n2oBinned,
	},
	{
		gas: 'o3',
		concentration: 4 * 1e-7, // 0.00004% (~0.1 ppm) average (volume fraction)
		binnedAbsorption: o3Binned,
	}
]

// === BINNED TRANSMISSION CALCULATION ===

// Calculate mixture transmission using log-binned spectra
const calculateBinnedMixtureTransmission = (
	gasMixture: Array<{ gas: string, concentration: number, binnedAbsorption: number[] }>,
	scaleHeight: number = SCALE_HEIGHT
): number[] => {
	// Initialise optical depth at each bin
	const opticalDepth = new Array(NUM_BINS).fill(0);

	// Sum optical depths from each gas
	gasMixture.forEach(({ gas, concentration, binnedAbsorption }) => {
		const refConcentration = getRefConcentration(gas);

		binnedAbsorption.forEach((absorptance, binIdx) => {
			// CSV absorptance represents: 1 - transmission_ref
			// We need optical depth: tau_ref = -ln(1 - absorptance)
			// Clamp absorptance to prevent log(0) issues
			const clampedAbsorptance = Math.min(absorptance, 0.9999);
			const transmissionRef = 1 - clampedAbsorptance;

			// Calculate reference optical depth from the CSV data
			const tauRef = -Math.log(transmissionRef);

			// Scale optical depth by actual concentration vs reference concentration
			// and by atmospheric column depth (scale height)
			const concentrationRatio = concentration / refConcentration;
			const scaleHeightRatio = scaleHeight / 8500; // Normalize to Earth's scale height

			opticalDepth[binIdx] += tauRef * concentrationRatio * scaleHeightRatio;
		});
	});

	// Convert optical depth to transmission using Beer-Lambert law
	const transmission = opticalDepth.map(tau => Math.exp(-tau));

	console.log("Binned optical depth:", opticalDepth);
	console.log("Binned transmission:", transmission);

	return transmission;
};

// Calculate weighted average transmission coefficient
const calculateAverageTransmissionCoefficient = (transmission: number[]): number => {
	return weightedAverageAbsorption(transmission, binWidths);
};

// Calculate blackbody-weighted transmission spectrum
// Models outgoing radiation from a surface at a given temperature passing through the atmosphere
const calculateBlackbodyWeightedSpectrum = (
	transmission: number[],
	temperature_K: number
): Array<{ wavelength: number; exitance: number; transmitted: number }> => {
	return bins.map((wavelength, i) => {
		const exitance = planckSpectralExitance(wavelength, temperature_K);
		const transmitted = exitance * transmission[i];
		return { wavelength, exitance, transmitted };
	});
};

// Calculate blackbody-weighted average transmission
// Accounts for how much energy is actually at each wavelength
const calculateBlackbodyWeightedTransmission = (
	transmission: number[],
	temperature_K: number
): number => {
	let totalIncident = 0;
	let totalTransmitted = 0;

	bins.forEach((wavelength, i) => {
		const exitance = planckSpectralExitance(wavelength, temperature_K);
		const binWidth = binWidths[i];

		totalIncident += exitance * binWidth;
		totalTransmitted += exitance * transmission[i] * binWidth;
	});

	return totalTransmitted / totalIncident;
};

export const GasExperiment: React.FC = () => {
	const mixtureTransmission = calculateBinnedMixtureTransmission(gasMixture);
	const avgTransmission = calculateAverageTransmissionCoefficient(mixtureTransmission);

	// Calculate blackbody-weighted spectra for different temperatures
	const SURFACE_TEMP = 288; // Earth surface temperature in K (288K = ~15°C)
	const blackbodySpectrum = calculateBlackbodyWeightedSpectrum(mixtureTransmission, SURFACE_TEMP);
	const blackbodyWeightedTransmission = calculateBlackbodyWeightedTransmission(mixtureTransmission, SURFACE_TEMP);

	// Chart dimensions
	const width = 800;
	const height = 200;
	const margin = { top: 20, right: 20, bottom: 60, left: 60 };
	const chartWidth = width - margin.left - margin.right;
	const chartHeight = height - margin.top - margin.bottom;

	// Scales for transmission spectrum
	const xScaleTransmission = scaleLog({
		domain: [WAVELENGTH_MIN, WAVELENGTH_MAX],
		range: [0, chartWidth],
	});

	const yScaleTransmission = scaleLinear({
		domain: [0, 1],
		range: [chartHeight, 0],
	});

	// Scales for individual gas spectra
	const xScaleSpectra = scaleLog({
		domain: [WAVELENGTH_MIN, WAVELENGTH_MAX],
		range: [0, chartWidth],
	});

	const yScaleSpectra = scaleLinear({
		domain: [0, 1],
		range: [chartHeight, 0],
	});

	// Scales for blackbody radiation
	const maxExitance = Math.max(...blackbodySpectrum.map(d => d.exitance));
	const yScaleExitance = scaleLinear({
		domain: [0, maxExitance],
		range: [chartHeight, 0],
	});

	return (
		<main style={{ width: '100vw', height: '100vh', padding: '40px', display: 'flex', flexDirection: 'column', gap: '40px', overflowY: 'auto'}}>
			<h1>Gas Experiment - Log-Binned Spectra</h1>

			<div style={{ backgroundColor: 'rgba(255 255 255 / 0.1', padding: '12px' }}>
				<h2>Configuration</h2>
				<p>Wavelength range: {WAVELENGTH_MIN} - {WAVELENGTH_MAX} μm</p>
				<p>Number of log-spaced bins: {NUM_BINS}</p>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
				<h2>Gas Mixture</h2>
				{gasMixture.map((gas) => (
					<div key={gas.gas} style={{ backgroundColor: 'rgba(255 255 255 / 0.1', padding: '12px' }}>
						<h3>{gas.gas.toUpperCase()}</h3>
						<p>Concentration: {gas.concentration.toFixed(4)}%
							{ gas.concentration < 0.01
								? ` (${gas.concentration * 1000000} ppm)`
								: null}
						</p>
					</div>
				))}
			</div>

			<div style={{ backgroundColor: 'rgba(255 255 255 / 0.1', padding: '12px' }}>
				<h2>Individual gas absorption spectra (input data)</h2>
				<svg width={width} height={height}>
					<Group left={margin.left} top={margin.top}>
						<GridRows scale={yScaleTransmission} width={chartWidth} stroke="#e0e0e0" />

						{/* CO2 spectrum */}
						<LinePath
							data={co2Spectrum}
							x={(d) => xScaleSpectra(d[0])}
							y={(d) => yScaleSpectra(d[1])}
							stroke="#f00"
							strokeWidth={1}
						/>

						<LinearGradient id="co2-gradient" from="#f00" to="#000" />
						<AreaClosed
							data={co2Spectrum}
							x={(d) => xScaleSpectra(d[0])}
							y={(d) => yScaleSpectra(d[1])}
							fill="url(#co2-gradient)"
							opacity={0.2}
							yScale={yScaleSpectra}
						/>

						{/* Water vapor spectrum */}
						<LinePath
							data={waterVapourSpectrum}
							x={(d) => xScaleSpectra(d[0])}
							y={(d) => yScaleSpectra(d[1])}
							stroke="#05f"
							strokeWidth={1}
						/>

						<LinearGradient id="h2o-gradient" from="#05f" to="#000" />
						<AreaClosed
							data={waterVapourSpectrum}
							x={(d) => xScaleSpectra(d[0])}
							y={(d) => yScaleSpectra(d[1])}
							fill="url(#h2o-gradient)"
							opacity={0.2}
							yScale={yScaleSpectra}
						/>

						{/* CH4 spectrum */}

						<LinePath
							data={ch4Spectrum}
							x={(d) => xScaleSpectra(d[0])}
							y={(d) => yScaleSpectra(d[1])}
							stroke="#0a0"
							strokeWidth={1}
						/>

						<LinearGradient id="ch4-gradient" from="#0a0" to="#000" />
						<AreaClosed
							data={ch4Spectrum}
							x={(d) => xScaleSpectra(d[0])}
							y={(d) => yScaleSpectra(d[1])}
							fill="url(#ch4-gradient)"
							opacity={0.2}
							yScale={yScaleSpectra}
						/>

						<AxisBottom
							top={chartHeight}
							scale={xScaleSpectra}
							label="Wavelength (μm)"
							labelOffset={15}
							tickStroke="#fff"
							stroke='#fff'
							labelProps={{ fill: '#fff' }}
							tickLabelProps={{ fill: '#fff' }}
						/>
						<AxisLeft
							scale={yScaleSpectra}
							label="Absorption"
							labelOffset={40}
							tickStroke="#fff"
							stroke='#fff'
							labelProps={{ fill: '#fff' }}
							tickLabelProps={{ fill: '#fff' }}
						/>
					</Group>
				</svg>
				<div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<div style={{ width: '20px', height: '2px', backgroundColor: '#f00' }} />
						CO2
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<div style={{ width: '20px', height: '2px', backgroundColor: '#05f' }} />
						H2O
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<div style={{ width: '20px', height: '2px', backgroundColor: '#0a0' }} />
						CH4
					</div>
				</div>
			</div>

			<div style={{ backgroundColor: 'rgba(255 255 255 / 0.1', padding: '12px' }}>
				<h2>Binned mixture transmission spectrum</h2>
				<svg width={width} height={height}>
					<Group left={margin.left} top={margin.top}>
						<GridRows scale={yScaleTransmission} width={chartWidth} stroke="#e0e0e0" />
						<LinearGradient id="transmission-gradient" from="#a32" to="#27272b" />

						{/* Bar chart showing bin widths, offset left by half its width bc histograms babyyy */}
						{bins.map((wavelength, i) => {
							const barWidth = i < bins.length - 1
								? xScaleTransmission(bins[i + 1]) - xScaleTransmission(bins[i])
								: xScaleTransmission(bins[i]) - xScaleTransmission(bins[i - 1]);

							return (
								<Bar
									key={i}
									x={xScaleTransmission(wavelength)}
									y={yScaleTransmission(mixtureTransmission[i])}
									width={barWidth}
									height={chartHeight - yScaleTransmission(mixtureTransmission[i])}
									fill="url(#transmission-gradient)"
									opacity={0.7}
									stroke="#f64"
									strokeWidth={1}
									strokeOpacity={0.5}
								/>
							);
						})}

						<AxisBottom
							top={chartHeight}
							scale={xScaleTransmission}
							label="Wavelength (μm)"
							labelOffset={15}
							numTicks={8}
							tickStroke="#fff"
							stroke='#fff'
							labelProps={{ fill: '#fff' }}
							tickLabelProps={{ fill: '#fff' }}
						/>
						<AxisLeft
							scale={yScaleTransmission}
							label="Transmission"
							labelOffset={40}
							tickStroke="#fff"
							stroke='#fff'
							labelProps={{ fill: '#fff' }}
							tickLabelProps={{ fill: '#fff' }}
						/>
					</Group>
				</svg>
				<p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
					Bars show log-spaced bins (wider at longer wavelengths). Line connects bin centers.
				</p>
			</div>
			
			{/*<div style={{ backgroundColor: 'rgba(255 255 255 / 0.1', padding: '12px' , display: 'flex', flexDirection: 'column', gap: '12px' }}>
				<h2>Weighted average transmission coefficient</h2>
				<p style={{ fontSize: '24px' }}>{avgTransmission.toFixed(4)}</p>
			</div>*/}

			<div style={{ backgroundColor: 'rgba(255 255 255 / 0.1', padding: '12px' }}>
				<h2>Blackbody-weighted outgoing radiation ({SURFACE_TEMP}K)</h2>
				<svg width={width} height={height}>
					<Group left={margin.left} top={margin.top}>
						<GridRows scale={yScaleExitance} width={chartWidth} stroke="#e0e0e0" />
						<LinearGradient id="exitance-gradient" from="#ff8800" to="#27272b" />
						<LinearGradient id="transmitted-gradient" from="#00ff88" to="#27272b" />

						{/* Incident blackbody radiation */}
						<AreaClosed
							data={blackbodySpectrum}
							x={(d) => xScaleTransmission(d.wavelength)}
							y={(d) => yScaleExitance(d.exitance)}
							fill="url(#exitance-gradient)"
							opacity={0.4}
							yScale={yScaleExitance}
						/>
						<LinePath
							data={blackbodySpectrum}
							x={(d) => xScaleTransmission(d.wavelength)}
							y={(d) => yScaleExitance(d.exitance)}
							stroke="#ff8800"
							strokeWidth={2}
						/>

						{/* Transmitted radiation */}
						<AreaClosed
							data={blackbodySpectrum}
							x={(d) => xScaleTransmission(d.wavelength)}
							y={(d) => yScaleExitance(d.transmitted)}
							fill="url(#transmitted-gradient)"
							opacity={0.4}
							yScale={yScaleExitance}
						/>
						<LinePath
							data={blackbodySpectrum}
							x={(d) => xScaleTransmission(d.wavelength)}
							y={(d) => yScaleExitance(d.transmitted)}
							stroke="#00ff88"
							strokeWidth={2}
						/>

						<AxisBottom
							top={chartHeight}
							scale={xScaleTransmission}
							label="Wavelength (μm)"
							labelOffset={15}
							numTicks={8}
							tickStroke="#fff"
							stroke='#fff'
							labelProps={{ fill: '#fff' }}
							tickLabelProps={{ fill: '#fff' }}
						/>
						<AxisLeft
							scale={yScaleExitance}
							label="Spectral exitance (W/(m²·μm))"
							labelOffset={25}
							tickStroke="#fff"
							stroke='#fff'
							labelProps={{ fill: '#fff' }}
							tickLabelProps={{ fill: '#fff' }}
						/>
					</Group>
				</svg>
				<div style={{ display: 'flex', flexDirection: 'row', gap: '20px', marginTop: '10px' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<div style={{ width: '20px', height: '2px', backgroundColor: '#ff8800' }} />
						Incident (surface emission)
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<div style={{ width: '20px', height: '2px', backgroundColor: '#00ff88' }} />
						Transmitted (escapes to space)
					</div>
				</div>
			</div>

			<div style={{ backgroundColor: 'rgba(255 255 255 / 0.1', padding: '12px' , display: 'flex', flexDirection: 'column', gap: '12px' }}>
				<h2>Blackbody-weighted transmission coefficient</h2>
				<p style={{ fontSize: '24px' }}>{blackbodyWeightedTransmission.toFixed(4)}</p>
			</div>

			<div style={{ backgroundColor: 'rgba(255 255 255 / 0.1', padding: '12px' }}>
				<h2>Binned transmission spectrum (table)</h2>
				<div style={{ maxHeight: '400px', overflowY: 'auto' }}>
					<table style={{ border: '1px solid #27272b', borderCollapse: 'collapse', width: '100%' }}>
						<thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(255 255 255 / 0.1' }}>
							<tr>
								<th style={{ border: '1px solid black', padding: '4px' }}>Bin #</th>
								<th style={{ border: '1px solid black', padding: '4px' }}>Wavelength (μm)</th>
								<th style={{ border: '1px solid black', padding: '4px' }}>Bin Width (μm)</th>
								<th style={{ border: '1px solid black', padding: '4px' }}>Transmission</th>
							</tr>
						</thead>
						<tbody>
							{bins.map((wavelength, i) => (
								<tr key={i}>
									<td style={{ border: '1px solid black', padding: '4px' }}>{i}</td>
									<td style={{ border: '1px solid black', padding: '4px' }}>{wavelength.toFixed(3)}</td>
									<td style={{ border: '1px solid black', padding: '4px' }}>{binWidths[i].toFixed(3)}</td>
									<td style={{ border: '1px solid black', padding: '4px' }}>{mixtureTransmission[i].toFixed(4)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</main>
	)
}

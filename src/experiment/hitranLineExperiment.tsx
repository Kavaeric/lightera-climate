import React from 'react';
import { allHitranCrossSections } from './hitranCrossSections';
import type { HitranCrossSectionSpectrum } from './hitranCrossSections';
import { LinePath, AreaClosed } from '@visx/shape';
import { scaleLog, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { LinearGradient } from '@visx/gradient';
import { Group } from '@visx/group';

import { PHYSICS_CONSTANTS, planckSpectralExitance } from './physics';
import type { GasConfig } from './gases';
import type { AtmosphereConfig } from './atmosphere';
import { EARTH_ATMOSPHERE, MARS_ATMOSPHERE, VENUS_ATMOSPHERE } from './atmosphere';

/**
 * Calculate atmospheric transmission using absorption cross-sections
 *
 * For each gas and wavelength:
 *   1. Get absorption cross-section σ (cm²/molecule) from cross-section data
 *   2. Calculate column density N (molecules/cm²) from atmosphere params
 *   3. Calculate optical depth: τ = σ × N
 *   4. Calculate transmission: T = exp(-τ)
 *   5. Multiply transmissions from all gases
 */
const calculateMixtureTransmission = (
	spectra: Record<string, HitranCrossSectionSpectrum>,
	gases: GasConfig[],
	atmosphere: AtmosphereConfig
): { wavelengths: number[]; transmission: number[] } => {
	// Use first available gas's wavelength grid as reference
	const refGas = Object.keys(spectra)[0];
	const refWavelengths = spectra[refGas].wavelengths;
	const numBins = refWavelengths.length;

	// Initialise total transmission at each wavelength (start at 1 = fully transparent)
	const totalTransmission = new Array(numBins).fill(1.0);

	// Calculate total atmospheric column (molecules/cm²)
	// N_total = (P / g) × (1 / m_mean)
	// Units: (Pa / (m/s²)) × (1 / kg) = (kg·m/s²)/m² / (m/s²) / kg = molecules/m²
	const totalColumn_m2 = (atmosphere.surfacePressure_Pa / atmosphere.surfaceGravity_m_s2)
		/ atmosphere.meanMolecularMass_kg;

	// Convert to molecules/cm²
	const totalColumn_cm2 = totalColumn_m2 / 1e4; // 1 m² = 10⁴ cm²

	console.log(`Total atmospheric column: ${totalColumn_cm2.toExponential(3)} molecules/cm²`);

	// Process each gas
	for (const { gas, concentration } of gases) {
		const spectrum = spectra[gas];
		if (!spectrum) {
			console.warn(`No cross-section data for gas: ${gas}`);
			continue;
		}

		// Calculate column density for this gas
		const gasColumn_cm2 = totalColumn_cm2 * concentration;

		console.log(`${gas}: column = ${gasColumn_cm2.toExponential(3)} molecules/cm², max cross-section = ${Math.max(...spectrum.crossSections).toExponential(3)}`);

		// For each wavelength bin
		let maxTau = 0;
		for (let i = 0; i < numBins; i++) {
			const crossSection = spectrum.crossSections[i]; // cm/molecule (HITRAN units)

			// Calculate optical depth
			const tau = crossSection * gasColumn_cm2;
			maxTau = Math.max(maxTau, tau);

			// Calculate transmission for this gas
			const transmission = Math.exp(-tau);

			// Multiply into total (transmissions combine multiplicatively)
			totalTransmission[i] *= transmission;
		}
		console.log(`${gas}: max optical depth = ${maxTau.toExponential(3)}`);
	}

	const finalTransmission = totalTransmission.filter(t => t < 0.99);
	console.log(`Final transmission: min = ${Math.min(...totalTransmission).toExponential(3)}, samples < 0.99: ${finalTransmission.length}`);

	return { wavelengths: refWavelengths, transmission: totalTransmission };
};

// Calculate blackbody-weighted transmission coefficient
const calculateBlackbodyWeightedTransmission = (
	wavelengths: number[],
	transmission: number[],
	temperature_K: number
): number => {
	let totalFlux = 0;
	let transmittedFlux = 0;

	for (let i = 0; i < wavelengths.length - 1; i++) {
		const λ1 = wavelengths[i];
		const λ2 = wavelengths[i + 1];
		const dλ = λ2 - λ1;

		const exitance = planckSpectralExitance(λ1, temperature_K);
		const flux = exitance * dλ;

		totalFlux += flux;
		transmittedFlux += flux * transmission[i];
	}

	return transmittedFlux / totalFlux;
};

export const HitranLineExperiment: React.FC = () => {
	const spectra = allHitranCrossSections;
	const atmosphere = EARTH_ATMOSPHERE;

	const { wavelengths, transmission } = calculateMixtureTransmission(spectra, atmosphere.composition, atmosphere);

	const SURFACE_TEMP = 288;
	// 288K for Earth
	// 213K for Mars
	// 737K for Venus

	const blackbodyWeightedTransmission = calculateBlackbodyWeightedTransmission(
		wavelengths, transmission, SURFACE_TEMP
	);

	// Calculate blackbody spectrum for visualisation
	const blackbodySpectrum = wavelengths.map((λ, i) => ({
		wavelength: λ,
		exitance: planckSpectralExitance(λ, SURFACE_TEMP),
		transmitted: planckSpectralExitance(λ, SURFACE_TEMP) * transmission[i],
	}));

	// Chart dimensions
	const width = 1000;
	const height = 500;
	const margin = { top: 20, right: 20, bottom: 60, left: 80 };
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;

	const WAVELENGTH_MIN = 1;
	const WAVELENGTH_MAX = 70;

	const xScale = scaleLog({
		domain: [WAVELENGTH_MIN, WAVELENGTH_MAX],
		range: [0, innerWidth],
	});

	const maxExitance = Math.max(...blackbodySpectrum.map(d => d.exitance));
	const yScale = scaleLinear({
		domain: [0, maxExitance * 1.1],
		range: [innerHeight, 0],
	});

	return (
		<main style={{ width: '100vw', height: '100vh', padding: '40px', display: 'flex', flexDirection: 'column', gap: '40px', overflowY: 'auto' }}>
			<h1>HITRAN Line-by-Line Experiment</h1>

			<div style={{ backgroundColor: 'rgba(255 255 255 / 0.1)', padding: '12px' }}>
				<h2>Configuration</h2>
				<p>Data source: HITRAN line-by-line (binned to 512 wavelength bins, 1-70 μm)</p>
				<p>Reference temperature: 296 K</p>
				<p>Surface pressure: {atmosphere.surfacePressure_Pa.toFixed(0)} Pa ({(atmosphere.surfacePressure_Pa / 101325).toFixed(2)} atm)</p>
				<p>Surface gravity: {atmosphere.surfaceGravity_m_s2} m/s²</p>
				<p>Mean molecular mass: {(atmosphere.meanMolecularMass_kg * PHYSICS_CONSTANTS.AVOGADRO * 1000).toFixed(1)} g/mol</p>
				<p>Total column: {((atmosphere.surfacePressure_Pa / atmosphere.surfaceGravity_m_s2) / atmosphere.meanMolecularMass_kg / 1e4).toExponential(3)} molecules/cm²</p>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
				<h2>Atmospheric composition</h2>
				{atmosphere.composition.map((g) => {
					const totalColumn_cm2 = (atmosphere.surfacePressure_Pa / atmosphere.surfaceGravity_m_s2)
						/ atmosphere.meanMolecularMass_kg / 1e4;
					const column = totalColumn_cm2 * g.concentration;
					const hasData = spectra[g.gas] !== undefined;
					const spectrum = spectra[g.gas];

					// Mini chart dimensions
					const miniWidth = 400;
					const miniHeight = 80;
					const miniMargin = { top: 5, right: 10, bottom: 20, left: 50 };
					const miniInnerWidth = miniWidth - miniMargin.left - miniMargin.right;
					const miniInnerHeight = miniHeight - miniMargin.top - miniMargin.bottom;

					const miniXScale = scaleLog({
						domain: [WAVELENGTH_MIN, WAVELENGTH_MAX],
						range: [0, miniInnerWidth],
					});

					// Log scale for cross-sections (they vary over many orders of magnitude)
					const maxCrossSection = hasData ? Math.max(...spectrum.crossSections.filter(v => v > 0)) : 1;
					const minCrossSection = hasData ? Math.min(...spectrum.crossSections.filter(v => v > 0)) : 1e-30;
					const miniYScale = scaleLog({
						domain: [minCrossSection, maxCrossSection * 10],
						range: [miniInnerHeight, 0],
					});

					return (
						<div key={g.gas} style={{ backgroundColor: 'rgba(255 255 255 / 0.1)', padding: '12px' }}>
							<h3>{g.gas.toUpperCase()}</h3>
							<p>Concentration: {(g.concentration * 100).toFixed(6)}% ({(g.concentration * 1e6).toFixed(2)} ppm)</p>
							<p>Column density: {column.toExponential(3)} molecules/cm²</p>
							{hasData && (
								<>
									<p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
										Cross-section range: {minCrossSection.toExponential(2)} - {maxCrossSection.toExponential(2)} cm²/molecule
									</p>
									<svg width={miniWidth} height={miniHeight}>
										<Group left={miniMargin.left} top={miniMargin.top}>
											<LinePath
												data={spectrum.wavelengths.map((λ, i) => ({ x: λ, y: spectrum.crossSections[i] })).filter(d => d.y > 0)}
												x={d => miniXScale(d.x)}
												y={d => miniYScale(d.y)}
												stroke="cyan"
												strokeWidth={1}
											/>
											<AxisBottom
												top={miniInnerHeight}
												scale={miniXScale}
												stroke="white"
												tickStroke="white"
												numTicks={5}
												tickLabelProps={() => ({ fill: 'white', fontSize: 9, textAnchor: 'middle' })}
											/>
											<AxisLeft
												scale={miniYScale}
												stroke="white"
												tickStroke="white"
												numTicks={3}
												tickFormat={v => Number(v).toExponential(0)}
												tickLabelProps={() => ({ fill: 'white', fontSize: 8, textAnchor: 'end', dy: '0.33em' })}
											/>
										</Group>
									</svg>
								</>
							)}
						</div>
					);
				})}
			</div>

			<div style={{ backgroundColor: 'rgba(255 255 255 / 0.1)', padding: '12px' }}>
				<h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>
					Blackbody-weighted transmission coefficient: {blackbodyWeightedTransmission.toFixed(4)}
				</h2>
				<p>({(blackbodyWeightedTransmission * 100).toFixed(2)}% of surface radiation escapes to space)</p>
			</div>

			<div>
				<h2>Blackbody spectrum with atmospheric transmission</h2>
				<svg width={width} height={height}>
					<LinearGradient id="area-gradient" from="rgba(255, 165, 0, 1)" to="rgba(255, 165, 0, 0.5)" vertical={true} />
					<Group left={margin.left} top={margin.top}>
						<GridRows scale={yScale} width={innerWidth} stroke="rgba(255,255,255,0.1)" />

						{/* Original blackbody spectrum (line) */}
						<LinePath
							data={blackbodySpectrum}
							x={d => xScale(d.wavelength)}
							y={d => yScale(d.exitance)}
							stroke="red"
							strokeWidth={8}
							opacity={0.2}
						/>
						<LinePath
							data={blackbodySpectrum}
							x={d => xScale(d.wavelength)}
							y={d => yScale(d.exitance)}
							stroke="red"
							strokeWidth={1}
							opacity={1}
						/>

						{/* Transmitted spectrum (filled area) */}
						<LinePath
							data={blackbodySpectrum}
							x={d => xScale(d.wavelength)}
							y={d => yScale(d.transmitted)}
							stroke="#ff9900"
							strokeWidth={1}
						/>
						<AreaClosed
							data={blackbodySpectrum}
							x={d => xScale(d.wavelength)}
							y={d => yScale(d.transmitted)}
							yScale={yScale}
							fill="url(#area-gradient)"
							opacity={0.6}
						/>

						<AxisBottom
							top={innerHeight}
							scale={xScale}
							label="Wavelength (μm)"
							stroke="white"
							tickStroke="white"
							tickLabelProps={() => ({ fill: 'white', fontSize: 11, textAnchor: 'middle' })}
							labelProps={{ fill: 'white', fontSize: 14, textAnchor: 'middle' }}
						/>
						<AxisLeft
							scale={yScale}
							label="Spectral exitance (W/m²/μm)"
							stroke="white"
							tickStroke="white"
							tickLabelProps={() => ({ fill: 'white', fontSize: 11, textAnchor: 'end', dy: '0.33em' })}
							labelProps={{ fill: 'white', fontSize: 14, textAnchor: 'middle' }}
						/>
					</Group>
				</svg>
			</div>

			<div>
				<h2>Transmission spectrum</h2>
				<svg width={width} height={400}>
					<Group left={margin.left} top={margin.top}>
						<GridRows
							scale={scaleLinear({ domain: [0, 1], range: [300, 0] })}
							width={innerWidth}
							stroke="rgba(255,255,255,0.1)"
						/>

						<LinePath
							data={wavelengths.map((λ, i) => ({ wavelength: λ, transmission: transmission[i] }))}
							x={d => xScale(d.wavelength)}
							y={d => scaleLinear({ domain: [0, 1], range: [300, 0] })(d.transmission)}
							stroke="cyan"
							strokeWidth={1.5}
						/>

						<AxisBottom
							top={300}
							scale={xScale}
							label="Wavelength (μm)"
							stroke="white"
							tickStroke="white"
							tickLabelProps={() => ({ fill: 'white', fontSize: 11, textAnchor: 'middle' })}
							labelProps={{ fill: 'white', fontSize: 14, textAnchor: 'middle' }}
						/>
						<AxisLeft
							scale={scaleLinear({ domain: [0, 1], range: [300, 0] })}
							label="Transmission (0-1)"
							stroke="white"
							tickStroke="white"
							tickLabelProps={() => ({ fill: 'white', fontSize: 11, textAnchor: 'end', dy: '0.33em' })}
							labelProps={{ fill: 'white', fontSize: 14, textAnchor: 'middle' }}
						/>
					</Group>
				</svg>
			</div>
		</main>
	);
};

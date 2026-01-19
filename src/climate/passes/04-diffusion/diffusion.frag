/**
 * Pass 3: Thermal Diffusion
 *
 * Implements thermal conduction between cells using Fourier's law.
 * Heat flows from warmer cells to cooler cells through the surface and air.
 *
 * Fourier's law: Q = -k * A * (dT/dx)
 * In discrete form: Q_net = sum(k * A * (T_neighbor - T_self) / distance)
 *
 * Temperature change: ΔT = Q_net * dt / (heat_capacity * area)
 *
 * This is a simple/passive diffusion process that smooths temperature
 * gradients across the planet surface.
 */

precision highp float;

#include "../../../rendering/shaders/utility/textureAccessors.glsl"
#include "../../shaders/constants.glsl"
#include "../../shaders/surfaceThermal.glsl"

in vec2 vUv;

// Input uniforms
uniform float dt;  // Timestep in seconds
uniform float planetRadius;  // Planet radius in metres

// Neighbor access uniforms
uniform sampler2D neighbourIndices1; // RGB = neighbours 0,1,2
uniform sampler2D neighbourIndices2; // RGB = neighbours 3,4,5
uniform float textureWidth;
uniform float textureHeight;

// Output: Updated surface state
layout(location = 0) out vec4 outSurfaceState;

/**
 * Convert cell index to UV coordinate (2D layout)
 */
vec2 indexToUV(float index) {
  float width = textureWidth;
  float height = textureHeight;
  float x = mod(index, width);
  float y = floor(index / width);
  float u = (x + 0.5) / width;
  float v = (y + 0.5) / height;
  return vec2(u, v);
}

void main() {
  // Read current surface state (after hydrology pass)
  vec4 surfaceState = texture(surfaceData, vUv);
  float currentTemperature = surfaceState.r;
  float surfaceAlbedo = surfaceState.a;

  // Read hydrology state to determine surface thermal properties
  vec4 hydrologyState = texture(hydrologyData, vUv);
  float waterDepth = hydrologyState.r;
  float iceThickness = hydrologyState.g;

  // Calculate surface thermal properties
  float heatCapacity = getSurfaceHeatCapacity(waterDepth, iceThickness);
  float thermalConductivity = getSurfaceThermalConductivity(waterDepth, iceThickness);

  // Calculate cell spacing from cell area
  // Cell area is stored in cellInformation texture as unit sphere area (area on sphere of radius 1)
  // Need to scale by radius² to get actual area, then calculate spacing
  float unitSphereArea = getCellArea(vUv); // Unit sphere area (dimensionless, area on sphere of radius 1)
  float cellArea = unitSphereArea * planetRadius * planetRadius; // Actual area in m²
  
  // For a geodesic grid, approximate spacing between cell centers
  // Using great circle distance approximation: spacing ≈ 2 * sqrt(area / PI)
  // This gives the approximate distance between centers of adjacent hexagonal cells
  float cellSpacing = 2.0 * sqrt(cellArea / PI);

  // Read neighbour indices
  vec3 neighbours1 = texture(neighbourIndices1, vUv).rgb;
  vec3 neighbours2 = texture(neighbourIndices2, vUv).rgb;

  // Calculate net heat flux from all neighbors
  // Branchless neighbour sampling using step() to handle invalid neighbors
  float netHeatFlux = 0.0;
  float validNeighborCount = 0.0;

  // Process all 6 neighbours
  vec3 valid1 = step(0.0, neighbours1); // 1.0 if >= 0 (valid), else 0.0
  vec3 valid2 = step(0.0, neighbours2);

  // Neighbor 0
  float neighbor0Temp = texture(surfaceData, indexToUV(neighbours1.r)).r;
  float tempDiff0 = neighbor0Temp - currentTemperature;
  netHeatFlux += thermalConductivity * tempDiff0 / cellSpacing * valid1.r;
  validNeighborCount += valid1.r;

  // Neighbor 1
  float neighbor1Temp = texture(surfaceData, indexToUV(neighbours1.g)).r;
  float tempDiff1 = neighbor1Temp - currentTemperature;
  netHeatFlux += thermalConductivity * tempDiff1 / cellSpacing * valid1.g;
  validNeighborCount += valid1.g;

  // Neighbor 2
  float neighbor2Temp = texture(surfaceData, indexToUV(neighbours1.b)).r;
  float tempDiff2 = neighbor2Temp - currentTemperature;
  netHeatFlux += thermalConductivity * tempDiff2 / cellSpacing * valid1.b;
  validNeighborCount += valid1.b;

  // Neighbor 3
  float neighbor3Temp = texture(surfaceData, indexToUV(neighbours2.r)).r;
  float tempDiff3 = neighbor3Temp - currentTemperature;
  netHeatFlux += thermalConductivity * tempDiff3 / cellSpacing * valid2.r;
  validNeighborCount += valid2.r;

  // Neighbor 4
  float neighbor4Temp = texture(surfaceData, indexToUV(neighbours2.g)).r;
  float tempDiff4 = neighbor4Temp - currentTemperature;
  netHeatFlux += thermalConductivity * tempDiff4 / cellSpacing * valid2.g;
  validNeighborCount += valid2.g;

  // Neighbor 5
  float neighbor5Temp = texture(surfaceData, indexToUV(neighbours2.b)).r;
  float tempDiff5 = neighbor5Temp - currentTemperature;
  netHeatFlux += thermalConductivity * tempDiff5 / cellSpacing * valid2.b;
  validNeighborCount += valid2.b;

  // netHeatFlux is already the sum of heat flux from all valid neighbors
  // Units: W/m² (heat flux per unit area)

  // Calculate temperature change from heat flux
  // Q = netHeatFlux (W/m²) - heat flux per unit area
  // ΔT = Q * dt / C, where C is heat capacity per unit area (J/(m²·K))
  float temperatureChange = (netHeatFlux * dt) / max(heatCapacity, 1.0);

  // Apply temperature change
  float newTemperature = currentTemperature + temperatureChange;

  // Output: Updated surface state (albedo unchanged)
  // RGBA = [temperature, unused, unused, albedo]
  outSurfaceState = packSurfaceData(newTemperature, surfaceAlbedo);
}

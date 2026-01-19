import { useMemo, forwardRef, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Grid } from '../climate/geometry/geodesic';
import { getVisualisationMode } from '../rendering/visualisationModes';
import { useSimulation } from '../context/useSimulation';
import { useDisplayConfig } from '../context/useDisplayConfig'

// Import vertex shader for all visualisations
import visualiseVertexShader from '../rendering/shaders/display/visualise.vert?raw';
// Import atmosphere shaders
import atmosphereVertexShader from '../rendering/shaders/display/atmosphere.vert?raw';
import atmosphereFragmentShader from '../rendering/shaders/display/atmosphere.frag?raw';

/**
 * Renders the 3D planet visualisation with surface temperature data from GPU texture.
 * Each vertex has a UV coordinate pointing to its cell's pixel in the state texture.
 */
export const PlanetRenderer = forwardRef<THREE.Mesh, void>(function PlanetRenderer(_props, ref) {
  // Get simulation and display config from contexts
  const { getSimulation, activeSimulationConfig, activePlanetaryConfig } = useSimulation();
  const { displayConfig } = useDisplayConfig();
  const simulation = getSimulation();
  const subdivisions = activeSimulationConfig.resolution;
  const radius = activePlanetaryConfig.radius;
  const atmosphereHeight = activePlanetaryConfig.atmosphereScaleHeight * 5;

  // Generate geometry with UV coordinates mapped to texture
  const planetGeometry = useMemo(() => {
    if (!simulation) return new THREE.BufferGeometry();
    const grid = new Grid(subdivisions);
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    // Process each cell in the grid
    const cells = Array.from(grid);
    cells.forEach((cell, cellIndex) => {
      if (!cell.vertices || !cell.faceTriangles) return;

      // Get UV coordinates for this cell (maps to pixel in texture)
      const [cellU, cellV] = simulation.getCellUV(cellIndex);

      // Add triangles for this cell. NO SHARED VERTICES
      // Each triangle gets its own 3 vertices for per-face coloring
      for (const triangle of cell.faceTriangles) {
        // Vertex A
        const scaledA = triangle.a.clone().multiplyScalar(radius);
        vertices.push(scaledA.x, scaledA.y, scaledA.z);
        normals.push(triangle.a.x, triangle.a.y, triangle.a.z);
        uvs.push(cellU, cellV); // 2D UV coordinates

        // Vertex B
        const scaledB = triangle.b.clone().multiplyScalar(radius);
        vertices.push(scaledB.x, scaledB.y, scaledB.z);
        normals.push(triangle.b.x, triangle.b.y, triangle.b.z);
        uvs.push(cellU, cellV);

        // Vertex C
        const scaledC = triangle.c.clone().multiplyScalar(radius);
        vertices.push(scaledC.x, scaledC.y, scaledC.z);
        normals.push(triangle.c.x, triangle.c.y, triangle.c.z);
        uvs.push(cellU, cellV);
      }
    });

    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bufferGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    bufferGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

    return bufferGeometry;
  }, [subdivisions, radius, simulation]);

  // Create shader material with custom fragment shader from visualisation mode
  const planetMaterial = useMemo(() => {
    if (!simulation) return new THREE.MeshBasicMaterial();

    // Get visualisation mode configuration
    const mode = getVisualisationMode(displayConfig.visualisationMode);

    if (!mode) {
      throw new Error(`Visualisation mode '${displayConfig.visualisationMode}' not found`);
    }

    // Build uniforms for this visualisation mode
    const shaderUniforms = mode.buildCustomUniforms(simulation, displayConfig);

    const shaderMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: shaderUniforms,
      vertexShader: visualiseVertexShader,
      fragmentShader: mode.customFragmentShader,
    });

    return shaderMaterial;
  }, [simulation, displayConfig]);

  // Store material ref for useFrame updates
  const materialRef = useRef(planetMaterial);
  useEffect(() => {
    materialRef.current = planetMaterial;
  }, [planetMaterial]);

  // Update texture uniforms every frame to handle buffer swaps
  // This ensures the visualisation always shows the most recent simulation state
  useFrame(() => {
    if (!simulation) return;

    const currentMaterial = materialRef.current;
    if (!currentMaterial || !('uniforms' in currentMaterial)) return;

    const uniforms = currentMaterial.uniforms;

    // Update standardised data texture uniforms that may change between frames
    if (uniforms.surfaceData) {
      uniforms.surfaceData.value = simulation.getClimateDataCurrent().texture;
    }
    if (uniforms.hydrologyData) {
      uniforms.hydrologyData.value = simulation.getHydrologyDataCurrent().texture;
    }
    if (uniforms.auxiliaryData) {
      uniforms.auxiliaryData.value = simulation.getAuxiliaryTarget().texture;
    }
    // terrainData is static and doesn't need updating
  });

  // Create atmosphere geometry based on the planet radius and atmosphere height
  const atmosphereGeometry = useMemo(() => {
    const geometry = new THREE.SphereGeometry(radius, 128, 64);
    return geometry;
  }, [radius]);

  // Create atmosphere material with shader uniforms
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        radius: { value: radius },
        atmosphereHeight: { value: atmosphereHeight },
      },
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      transparent: true,
      depthWrite: false,
    });
  }, [radius, atmosphereHeight]);

  return (
    <>
      <mesh ref={ref} geometry={planetGeometry} material={planetMaterial}>
        {/* Material is already set via shader */}
      </mesh>
      <mesh geometry={atmosphereGeometry} material={atmosphereMaterial}>
        {/* Material is already set via shader */}
      </mesh>
    </>
  );
});

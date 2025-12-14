import { useMemo, forwardRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Grid } from '../simulation/geometry/geodesic'
import { TextureGridSimulation } from '../util/TextureGridSimulation'

// Import shaders
import displayVertexShader from '../shaders/display.vert?raw'
import displayFragmentShader from '../shaders/display.frag?raw'

interface PlanetRendererProps {
  subdivisions: number
  radius: number
  simulation: TextureGridSimulation
  valueRange?: { min: number; max: number }
  hoveredCellIndex?: number | null
  selectedCellIndex?: number | null
}

/**
 * Renders the 3D planet visualization with temperature data from GPU texture
 * Each vertex has a UV coordinate pointing to its cell's pixel in the state texture
 */
export const PlanetRenderer = forwardRef<THREE.Mesh, PlanetRendererProps>(
  function PlanetRenderer({
    subdivisions,
    radius,
    simulation,
    valueRange = { min: -40, max: 30 },
    hoveredCellIndex = null,
    selectedCellIndex = null,
  }, ref) {
    // Generate geometry with UV coordinates mapped to texture
    const geometry = useMemo(() => {
    const grid = new Grid(subdivisions)
    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []

    // Process each cell in the grid
    const cells = Array.from(grid)
    cells.forEach((cell, cellIndex) => {
      if (!cell.vertices || !cell.faceTriangles) return

      // Get UV coordinates for this cell (maps to pixel in texture)
      const [cellU, cellV] = simulation.getCellUV(cellIndex)

      // Add triangles for this cell - NO SHARED VERTICES
      // Each triangle gets its own 3 vertices for per-face coloring
      for (const triangle of cell.faceTriangles) {
        // Vertex A
        const scaledA = triangle.a.clone().multiplyScalar(radius)
        vertices.push(scaledA.x, scaledA.y, scaledA.z)
        normals.push(triangle.a.x, triangle.a.y, triangle.a.z)
        uvs.push(cellU, cellV) // 2D UV coordinates

        // Vertex B
        const scaledB = triangle.b.clone().multiplyScalar(radius)
        vertices.push(scaledB.x, scaledB.y, scaledB.z)
        normals.push(triangle.b.x, triangle.b.y, triangle.b.z)
        uvs.push(cellU, cellV)

        // Vertex C
        const scaledC = triangle.c.clone().multiplyScalar(radius)
        vertices.push(scaledC.x, scaledC.y, scaledC.z)
        normals.push(triangle.c.x, triangle.c.y, triangle.c.z)
        uvs.push(cellU, cellV)
      }
    })

    const bufferGeometry = new THREE.BufferGeometry()
    bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    bufferGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    bufferGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))

    return bufferGeometry
  }, [subdivisions, radius, simulation])

  // Create shader material once
  const material = useMemo(() => {
    // Fast colormap - 32 control points for wider gamut and extended discrimination
    // Data from Moreland's Fast colormap
    const fastColors = [
      new THREE.Vector3(0.05639932216773367, 0.056399092153948, 0.4700000908789252),
      new THREE.Vector3(0.11062118079323027, 0.1380849483224675, 0.5318811940715031),
      new THREE.Vector3(0.15062834225956712, 0.2122970107362595, 0.5947551775157331),
      new THREE.Vector3(0.18364776204016361, 0.28582408330692705, 0.6585723468980588),
      new THREE.Vector3(0.21181580762686186, 0.36018628717252055, 0.723291561166658),
      new THREE.Vector3(0.2360260502066791, 0.4358696051302966, 0.7888773509714441),
      new THREE.Vector3(0.267625116022063, 0.5083081607706341, 0.8350281801403023),
      new THREE.Vector3(0.299465177629453, 0.5797542700808809, 0.8717621559957862),
      new THREE.Vector3(0.32712079411491907, 0.6523755202804778, 0.9084510967262647),
      new THREE.Vector3(0.3512259015236105, 0.7261574853335666, 0.9450952510932998),
      new THREE.Vector3(0.43259949308056317, 0.7774846818972193, 0.9484812495789637),
      new THREE.Vector3(0.5182455112269085, 0.8215939429675145, 0.9401532282112622),
      new THREE.Vector3(0.5934960027213793, 0.8663909235918918, 0.9312813400678497),
      new THREE.Vector3(0.6622681009426095, 0.9118331985033377, 0.9218254834134191),
      new THREE.Vector3(0.7567155629708813, 0.9342020135461144, 0.87542938939741),
      new THREE.Vector3(0.8552551162202264, 0.9411667420787914, 0.8045038976467505),
      new THREE.Vector3(0.9137962604822488, 0.924270570873576, 0.7211958107780932),
      new THREE.Vector3(0.9369921574114255, 0.8836812571866447, 0.6264560093359551),
      new THREE.Vector3(0.9539324119899434, 0.8432846209187139, 0.531408480407559),
      new THREE.Vector3(0.9534516720681238, 0.789549848191143, 0.467841913400552),
      new THREE.Vector3(0.9465758462825115, 0.7316223955774923, 0.4146496642068541),
      new THREE.Vector3(0.9374475033003385, 0.6735004931047588, 0.3619568066943428),
      new THREE.Vector3(0.9245647500491415, 0.6148545383132992, 0.3113167841796553),
      new THREE.Vector3(0.8970517755591756, 0.5546951612479929, 0.2748146276825057),
      new THREE.Vector3(0.8685551960480525, 0.49413078643328173, 0.2389732264611919),
      new THREE.Vector3(0.839074560826857, 0.43274518533936923, 0.20382337636329811),
      new THREE.Vector3(0.8086084101977041, 0.3698342833209696, 0.16939757383932763),
      new THREE.Vector3(0.7676278529327417, 0.315264653443075, 0.15429163686512834),
      new THREE.Vector3(0.72300106561469, 0.26344676525169936, 0.14610655130616268),
      new THREE.Vector3(0.6785270372029161, 0.20934429344113736, 0.13757932265353492),
      new THREE.Vector3(0.6341969500479122, 0.1502395759815047, 0.12870449492087047),
      new THREE.Vector3(0.5900001145322249, 0.07669636770019067, 0.11947505935767005),
    ]

    // TODO: Replace with actual climate data texture once simulation is running
    // For now, use first time sample as placeholder
    const placeholderTexture = simulation.getClimateDataTarget(0).texture

    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        stateTex: { value: placeholderTexture },
        valueMin: { value: valueRange.min },
        valueMax: { value: valueRange.max },
        fastColors: { value: fastColors },
        underflowColor: { value: new THREE.Vector3(0.0, 0.0, 0.2) },
        overflowColor: { value: new THREE.Vector3(1.0, 0.0, 1.0) },
        highlightThreshold: { value: 0.01 },
        hoveredCellIndex: { value: -1 },
        selectedCellIndex: { value: -1 },
        textureWidth: { value: simulation.getTextureWidth() },
        textureHeight: { value: simulation.getTextureHeight() },
      },
      vertexShader: displayVertexShader,
      fragmentShader: displayFragmentShader,
      // Enable polygon offset to prevent z-fighting between coplanar faces at cell boundaries
      polygonOffset: true,
      polygonOffsetFactor: 1.0,
      polygonOffsetUnits: 1.0,
    })

    return shaderMaterial
  }, [simulation, valueRange])

    // Update hovered and selected cell indices each frame
    useFrame(() => {
      const mesh = (ref as React.RefObject<THREE.Mesh>)?.current
      if (mesh?.material && (mesh.material as THREE.ShaderMaterial).uniforms) {
        const mat = mesh.material as THREE.ShaderMaterial
        mat.uniforms.hoveredCellIndex.value = hoveredCellIndex ?? -1
        mat.uniforms.selectedCellIndex.value = selectedCellIndex ?? -1
      }
    })

    return (
      <mesh ref={ref} geometry={geometry} material={material}>
        {/* Material is already set via shader */}
      </mesh>
    )
  }
)

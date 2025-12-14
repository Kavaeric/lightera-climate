/**
 * Display material factory - creates a shader material for visualizing climate data
 * Maps GPU texture data to visual colors using Fast colormap
 */

import * as THREE from 'three'
import { TextureGridSimulation } from '../../util/TextureGridSimulation'
import type { DisplayConfig } from '../../config/displayConfig'
import displayVertexShader from '../../shaders/display.vert?raw'
import displayFragmentShader from '../../shaders/display.frag?raw'

export interface DisplayMaterialConfig {
  simulation: TextureGridSimulation
  displayConfig: DisplayConfig
  hoveredCellIndex: number | null
  selectedCellIndex: number | null
  currentTimeSample: number
}

/**
 * Fast colormap - 32 control points for perceptually uniform color rendering
 * Data from Kenneth Moreland's Fast colormap
 */
const FAST_COLORMAP = [
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

/**
 * Create a display material for visualizing climate simulation data
 * Samples temperature texture and renders with Fast colormap
 */
export function createDisplayMaterial(config: DisplayMaterialConfig): THREE.ShaderMaterial {
  const { simulation, displayConfig, hoveredCellIndex, selectedCellIndex, currentTimeSample } = config

  return new THREE.ShaderMaterial({
    vertexShader: displayVertexShader,
    fragmentShader: displayFragmentShader,
    uniforms: {
      // Texture data
      stateTex: { value: simulation.getClimateDataTarget(currentTimeSample).texture },

      // Display range and colormapping
      valueMin: { value: displayConfig.temperatureRange.min },
      valueMax: { value: displayConfig.temperatureRange.max },
      fastColors: { value: FAST_COLORMAP },
      underflowColor: {
        value: new THREE.Vector3(
          displayConfig.underflowColor[0],
          displayConfig.underflowColor[1],
          displayConfig.underflowColor[2]
        ),
      },
      overflowColor: {
        value: new THREE.Vector3(
          displayConfig.overflowColor[0],
          displayConfig.overflowColor[1],
          displayConfig.overflowColor[2]
        ),
      },

      // Cell highlighting
      hoveredCellIndex: { value: hoveredCellIndex ?? -1 },
      selectedCellIndex: { value: selectedCellIndex ?? -1 },
      highlightThreshold: { value: displayConfig.highlightThreshold },

      // Texture dimensions for cell lookup
      textureWidth: { value: simulation.getTextureWidth() },
      textureHeight: { value: simulation.getTextureHeight() },
    },
  })
}

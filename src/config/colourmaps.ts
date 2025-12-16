/**
 * Colourmap definitions for data visualization
 * Each colourmap defines color ramps and underflow/overflow colors
 */

import * as THREE from 'three'

export interface Colourmap {
  name: string
  // Control points: array of RGB colors (0-1 range)
  colors: THREE.Vector3[]
  // Color for values below the minimum range
  underflowColor: THREE.Vector3
  // Color for values above the maximum range
  overflowColor: THREE.Vector3
}

/**
 * Fast colourmap - 32 control points for wide gamut and extended discrimination
 * Data from Moreland's Fast colourmap
 * Good for: Temperature, continuous data with distinct features
 */
export const COLOURMAP_FAST: Colourmap = {
  name: 'fast',
  colors: [
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
  ],
  underflowColor: new THREE.Vector3(0.0, 0.0, 0.2), // Navy blue
  overflowColor: new THREE.Vector3(1.0, 0.0, 1.0), // Magenta
}

/**
 * Greyscale colourmap - simple black to white
 * Good for: Elevation, water depth, and other neutral data
 */
export const COLOURMAP_GREYSCALE: Colourmap = {
  name: 'greyscale',
  colors: [
    new THREE.Vector3(0.0, 0.0, 0.0),   // Black
    new THREE.Vector3(1.0, 1.0, 1.0),   // White
  ],
  underflowColor: new THREE.Vector3(0.0, 0.0, 0.2), // Navy blue for underflow
  overflowColor: new THREE.Vector3(1.0, 0.0, 1.0), // Magenta for overflow
}

/**
 * Water depth colourmap ("BlueB1" from ParaView)
 * Good for: Water depth visualization.
 * 
 */

export const COLOURMAP_WATERDEPTH: Colourmap = {
  name: 'waterdepth',
  colors: [
    new THREE.Vector3(0.882353, 0.980392, 0.964706), // x=0.0
    new THREE.Vector3(0.690196, 0.921569, 0.913725), // x=0.1
    new THREE.Vector3(0.552941, 0.823529, 0.850980), // x=0.2
    new THREE.Vector3(0.478431, 0.737255, 0.800000), // x=0.3
    new THREE.Vector3(0.384314, 0.596078, 0.701961), // x=0.4
    new THREE.Vector3(0.321569, 0.490196, 0.639216), // x=0.5
    new THREE.Vector3(0.262745, 0.392157, 0.580392), // x=0.6
    new THREE.Vector3(0.207843, 0.301961, 0.521569), // x=0.7
    new THREE.Vector3(0.156863, 0.207843, 0.450980), // x=0.8
    new THREE.Vector3(0.121569, 0.145098, 0.400000), // x=0.9
    new THREE.Vector3(0.098039, 0.086275, 0.349020), // x=1.0
  ],
  underflowColor: new THREE.Vector3(0.0, 0.0, 0.0),
  overflowColor: new THREE.Vector3(0.0, 1.0, 1.0),
}

/**
 * Salinity colourmap - "c16" pastel blue ramp from ParaView (CIELAB)
 */
export const COLOURMAP_SALINITY: Colourmap = {
  name: 'salinity',
  colors: [
    new THREE.Vector3(0.949020, 1.000000, 0.980392),
    new THREE.Vector3(0.901961, 1.000000, 0.949020),
    new THREE.Vector3(0.831373, 0.980392, 0.917647),
    new THREE.Vector3(0.768627, 0.960784, 0.894118),
    new THREE.Vector3(0.698039, 0.929412, 0.862745),
    new THREE.Vector3(0.639216, 0.901961, 0.843137),
    new THREE.Vector3(0.588235, 0.870588, 0.827451),
    new THREE.Vector3(0.541176, 0.831373, 0.803922),
    new THREE.Vector3(0.501961, 0.8     , 0.796078),
    new THREE.Vector3(0.454902, 0.745098, 0.760784),
    new THREE.Vector3(0.419608, 0.694118, 0.729412),
    new THREE.Vector3(0.380392, 0.631373, 0.690196),
    new THREE.Vector3(0.345098, 0.580392, 0.658824),
    new THREE.Vector3(0.317647, 0.525490, 0.619608),
    new THREE.Vector3(0.305882, 0.470588, 0.580392),
    new THREE.Vector3(0.290196, 0.415686, 0.529412),
    new THREE.Vector3(0.278431, 0.352941, 0.470588),
    new THREE.Vector3(0.258824, 0.298039, 0.400000),
    new THREE.Vector3(0.235294, 0.247059, 0.329412),
    new THREE.Vector3(0.180392, 0.176471, 0.231373),
  ],
  underflowColor: new THREE.Vector3(0.0, 0.0, 0.0), // NaN/fallback colour (matches XML <NaN>)
  overflowColor: new THREE.Vector3(1.0, 0.0, 1.0),
}

/**
 * Albedo colourmap - maps albedo values (0 to 1) to greyscale
 * Good for: Surface reflectivity visualization
 * 0.0 = black (very dark), 1.0 = white (very bright)
 */
export const COLOURMAP_ALBEDO: Colourmap = {
  name: 'albedo',
  colors: [
    new THREE.Vector3(0.0, 0.0, 0.0),   // Black - low albedo
    new THREE.Vector3(1.0, 1.0, 1.0),   // White - high albedo
  ],
  underflowColor: new THREE.Vector3(0.0, 0.0, 0.0),
  overflowColor: new THREE.Vector3(1.0, 1.0, 1.0),
}

/**
 * Get a colourmap by name
 */
export function getColourmap(name: string): Colourmap | null {
  const map: Record<string, Colourmap> = {
    'fast': COLOURMAP_FAST,
    'greyscale': COLOURMAP_GREYSCALE,
    'salinity': COLOURMAP_SALINITY,
    'albedo': COLOURMAP_ALBEDO,
  }
  return map[name] || null
}

/**
 * Get the appropriate colourmap for a visualization mode
 */
export function getColourmapForMode(mode: 'temperature' | 'elevation' | 'waterDepth' | 'salinity' | 'albedo'): Colourmap {
  switch (mode) {
    case 'temperature':
      return COLOURMAP_FAST
    case 'elevation':
      return COLOURMAP_GREYSCALE
    case 'waterDepth':
      return COLOURMAP_WATERDEPTH
    case 'salinity':
      return COLOURMAP_SALINITY
    case 'albedo':
      return COLOURMAP_GREYSCALE
    default:
      return COLOURMAP_FAST
  }
}

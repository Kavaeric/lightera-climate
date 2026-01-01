/**
 * XRayMeshLineMaterial
 *
 * A custom MeshLineMaterial variant that supports reducing opacity for
 * fragments that are on the backfacing side of a sphere (facing away from camera),
 * producing a kind of x-ray effect.
 *
 * This is useful for rendering lines where the backfacing side is still visible,
 * but faded out to make it easier to tell what's behind a surface.
 */

import * as THREE from 'three';

const version = (() => parseInt(THREE.REVISION.replace(/\D+/g, '')))();
const colorspace_fragment = version >= 154 ? 'colorspace_fragment' : 'encodings_fragment';

const vertexShader = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  #include <fog_pars_vertex>
  #include <clipping_planes_pars_vertex>

  attribute vec3 previous;
  attribute vec3 next;
  attribute float side;
  attribute float width;
  attribute float counters;

  uniform vec2 resolution;
  uniform float lineWidth;
  uniform vec3 color;
  uniform float opacity;
  uniform float sizeAttenuation;

  varying vec2 vUV;
  varying vec4 vColor;
  varying float vCounters;
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;

  vec2 fix(vec4 i, float aspect) {
    vec2 res = i.xy / i.w;
    res.x *= aspect;
    return res;
  }

  void main() {
    float aspect = resolution.x / resolution.y;
    vColor = vec4(color, opacity);
    vUV = uv;
    vCounters = counters;

    // Calculate world position and view direction for backface detection
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);

    mat4 m = projectionMatrix * modelViewMatrix;
    vec4 finalPosition = m * vec4(position, 1.0) * aspect;
    vec4 prevPos = m * vec4(previous, 1.0);
    vec4 nextPos = m * vec4(next, 1.0);

    vec2 currentP = fix(finalPosition, aspect);
    vec2 prevP = fix(prevPos, aspect);
    vec2 nextP = fix(nextPos, aspect);

    float w = lineWidth * width;

    vec2 dir;
    if (nextP == currentP) dir = normalize(currentP - prevP);
    else if (prevP == currentP) dir = normalize(nextP - currentP);
    else {
      vec2 dir1 = normalize(currentP - prevP);
      vec2 dir2 = normalize(nextP - currentP);
      dir = normalize(dir1 + dir2);
    }

    vec4 normal = vec4(-dir.y, dir.x, 0., 1.);
    normal.xy *= .5 * w;
    if (sizeAttenuation == 0.) {
      normal.xy *= finalPosition.w;
      normal.xy /= (vec4(resolution, 0., 1.) * projectionMatrix).xy * aspect;
    }

    finalPosition.xy += normal.xy * side;
    gl_Position = finalPosition;
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    #include <clipping_planes_vertex>
    #include <fog_vertex>
  }
`;

const fragmentShader = `
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>
  #include <clipping_planes_pars_fragment>

  uniform sampler2D map;
  uniform sampler2D alphaMap;
  uniform float useGradient;
  uniform float useMap;
  uniform float useAlphaMap;
  uniform float useDash;
  uniform float dashArray;
  uniform float dashOffset;
  uniform float dashRatio;
  uniform float visibility;
  uniform float alphaTest;
  uniform vec2 repeat;
  uniform vec3 gradient[2];

  // X-ray uniforms
  uniform float backfacingOpacity;
  uniform vec3 sphereCenter;

  varying vec2 vUV;
  varying vec4 vColor;
  varying float vCounters;
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;

  void main() {
    #include <logdepthbuf_fragment>
    vec4 diffuseColor = vColor;
    if (useGradient == 1.) diffuseColor = vec4(mix(gradient[0], gradient[1], vCounters), 1.0);
    if (useMap == 1.) diffuseColor *= texture2D(map, vUV * repeat);
    if (useAlphaMap == 1.) diffuseColor.a *= texture2D(alphaMap, vUV * repeat).a;
    if (diffuseColor.a < alphaTest) discard;
    if (useDash == 1.) diffuseColor.a *= ceil(mod(vCounters + dashOffset, dashArray) - (dashArray * dashRatio));
    diffuseColor.a *= step(vCounters, visibility);

    // X-ray backface fade calculation
    // For a sphere centered at sphereCenter, the normal is the normalized direction from center to position
    vec3 sphereNormal = normalize(vWorldPosition - sphereCenter);

    // Calculate dot product of view direction and sphere normal
    // Negative means we're looking at the back side of the sphere
    float facing = dot(vViewDirection, sphereNormal);

    // Apply backfacing opacity when facing away from camera
    float backfaceFactor = facing > 0.0 ? 1.0 : backfacingOpacity;
    diffuseColor.a *= backfaceFactor;

    #include <clipping_planes_fragment>
    gl_FragColor = diffuseColor;
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <${colorspace_fragment}>
  }
`;

export interface XRayMeshLineMaterialParameters {
  lineWidth?: number;
  map?: THREE.Texture | null;
  useMap?: number;
  alphaMap?: THREE.Texture | null;
  useAlphaMap?: number;
  color?: THREE.ColorRepresentation;
  gradient?: [THREE.Color, THREE.Color];
  opacity?: number;
  resolution?: THREE.Vector2;
  sizeAttenuation?: number;
  dashArray?: number;
  dashOffset?: number;
  dashRatio?: number;
  useDash?: number;
  useGradient?: number;
  visibility?: number;
  alphaTest?: number;
  repeat?: THREE.Vector2;
  // X-ray properties
  backfacingOpacity?: number;
  sphereCenter?: THREE.Vector3;
  // Standard material properties
  transparent?: boolean;
  depthTest?: boolean;
  depthWrite?: boolean;
  side?: THREE.Side;
}

export class XRayMeshLineMaterial extends THREE.ShaderMaterial {
  declare lineWidth: number;
  declare map: THREE.Texture | null;
  declare useMap: number;
  declare alphaMap: THREE.Texture | null;
  declare useAlphaMap: number;
  declare color: THREE.Color;
  declare gradient: [THREE.Color, THREE.Color];
  declare resolution: THREE.Vector2;
  declare sizeAttenuation: number;
  declare dashArray: number;
  declare dashOffset: number;
  declare dashRatio: number;
  declare useDash: number;
  declare useGradient: number;
  declare visibility: number;
  declare repeat: THREE.Vector2;
  declare backfacingOpacity: number;
  declare sphereCenter: THREE.Vector3;

  constructor(parameters?: XRayMeshLineMaterialParameters) {
    super({
      uniforms: {
        ...THREE.UniformsLib.fog,
        lineWidth: { value: 1 },
        map: { value: null },
        useMap: { value: 0 },
        alphaMap: { value: null },
        useAlphaMap: { value: 0 },
        color: { value: new THREE.Color(0xffffff) },
        gradient: { value: [new THREE.Color(0xff0000), new THREE.Color(0x00ff00)] },
        opacity: { value: 1 },
        resolution: { value: new THREE.Vector2(1, 1) },
        sizeAttenuation: { value: 1 },
        dashArray: { value: 0 },
        dashOffset: { value: 0 },
        dashRatio: { value: 0.5 },
        useDash: { value: 0 },
        useGradient: { value: 0 },
        visibility: { value: 1 },
        alphaTest: { value: 0 },
        repeat: { value: new THREE.Vector2(1, 1) },
        // X-ray uniforms
        backfacingOpacity: { value: 0.2 },
        sphereCenter: { value: new THREE.Vector3(0, 0, 0) },
      },
      vertexShader,
      fragmentShader,
    });

    this.type = 'XRayMeshLineMaterial';

    Object.defineProperties(this, {
      lineWidth: {
        enumerable: true,
        get() {
          return this.uniforms.lineWidth.value;
        },
        set(value) {
          this.uniforms.lineWidth.value = value;
        },
      },
      map: {
        enumerable: true,
        get() {
          return this.uniforms.map.value;
        },
        set(value) {
          this.uniforms.map.value = value;
        },
      },
      useMap: {
        enumerable: true,
        get() {
          return this.uniforms.useMap.value;
        },
        set(value) {
          this.uniforms.useMap.value = value;
        },
      },
      alphaMap: {
        enumerable: true,
        get() {
          return this.uniforms.alphaMap.value;
        },
        set(value) {
          this.uniforms.alphaMap.value = value;
        },
      },
      useAlphaMap: {
        enumerable: true,
        get() {
          return this.uniforms.useAlphaMap.value;
        },
        set(value) {
          this.uniforms.useAlphaMap.value = value;
        },
      },
      color: {
        enumerable: true,
        get() {
          return this.uniforms.color.value;
        },
        set(value) {
          this.uniforms.color.value = value;
        },
      },
      gradient: {
        enumerable: true,
        get() {
          return this.uniforms.gradient.value;
        },
        set(value) {
          this.uniforms.gradient.value = value;
        },
      },
      opacity: {
        enumerable: true,
        get() {
          return this.uniforms.opacity.value;
        },
        set(value) {
          this.uniforms.opacity.value = value;
        },
      },
      resolution: {
        enumerable: true,
        get() {
          return this.uniforms.resolution.value;
        },
        set(value) {
          this.uniforms.resolution.value.copy(value);
        },
      },
      sizeAttenuation: {
        enumerable: true,
        get() {
          return this.uniforms.sizeAttenuation.value;
        },
        set(value) {
          this.uniforms.sizeAttenuation.value = value;
        },
      },
      dashArray: {
        enumerable: true,
        get() {
          return this.uniforms.dashArray.value;
        },
        set(value) {
          this.uniforms.dashArray.value = value;
          this.useDash = value !== 0 ? 1 : 0;
        },
      },
      dashOffset: {
        enumerable: true,
        get() {
          return this.uniforms.dashOffset.value;
        },
        set(value) {
          this.uniforms.dashOffset.value = value;
        },
      },
      dashRatio: {
        enumerable: true,
        get() {
          return this.uniforms.dashRatio.value;
        },
        set(value) {
          this.uniforms.dashRatio.value = value;
        },
      },
      useDash: {
        enumerable: true,
        get() {
          return this.uniforms.useDash.value;
        },
        set(value) {
          this.uniforms.useDash.value = value;
        },
      },
      useGradient: {
        enumerable: true,
        get() {
          return this.uniforms.useGradient.value;
        },
        set(value) {
          this.uniforms.useGradient.value = value;
        },
      },
      visibility: {
        enumerable: true,
        get() {
          return this.uniforms.visibility.value;
        },
        set(value) {
          this.uniforms.visibility.value = value;
        },
      },
      alphaTest: {
        enumerable: true,
        get() {
          return this.uniforms.alphaTest.value;
        },
        set(value) {
          this.uniforms.alphaTest.value = value;
        },
      },
      repeat: {
        enumerable: true,
        get() {
          return this.uniforms.repeat.value;
        },
        set(value) {
          this.uniforms.repeat.value.copy(value);
        },
      },
      backfacingOpacity: {
        enumerable: true,
        get() {
          return this.uniforms.backfacingOpacity.value;
        },
        set(value) {
          this.uniforms.backfacingOpacity.value = value;
        },
      },
      sphereCenter: {
        enumerable: true,
        get() {
          return this.uniforms.sphereCenter.value;
        },
        set(value) {
          this.uniforms.sphereCenter.value.copy(value);
        },
      },
    });

    this.setValues(parameters as THREE.ShaderMaterialParameters);
  }

  copy(source: XRayMeshLineMaterial): this {
    super.copy(source);
    this.lineWidth = source.lineWidth;
    this.map = source.map;
    this.useMap = source.useMap;
    this.alphaMap = source.alphaMap;
    this.useAlphaMap = source.useAlphaMap;
    this.color.copy(source.color);
    this.gradient = source.gradient;
    this.opacity = source.opacity;
    this.resolution.copy(source.resolution);
    this.sizeAttenuation = source.sizeAttenuation;
    this.dashArray = source.dashArray;
    this.dashOffset = source.dashOffset;
    this.dashRatio = source.dashRatio;
    this.useDash = source.useDash;
    this.useGradient = source.useGradient;
    this.visibility = source.visibility;
    this.alphaTest = source.alphaTest;
    this.repeat.copy(source.repeat);
    this.backfacingOpacity = source.backfacingOpacity;
    this.sphereCenter.copy(source.sphereCenter);
    return this;
  }
}

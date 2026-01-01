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
import vertexShader from '../shaders/utility/xrayMeshLine.vert?raw';
import fragmentShaderRaw from '../shaders/utility/xrayMeshLine.frag?raw';

const version = (() => parseInt(THREE.REVISION.replace(/\D+/g, '')))();
const colorspaceFragment = version >= 154 ? 'colorspace_fragment' : 'encodings_fragment';
const fragmentShader = fragmentShaderRaw.replace('COLORSPACE_FRAGMENT', colorspaceFragment);

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
    return this;
  }
}

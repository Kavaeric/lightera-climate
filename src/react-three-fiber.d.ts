import { Object3DNode, MaterialNode } from '@react-three/fiber';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { XRayMeshLineMaterial } from './materials/XRayMeshLineMaterial';

declare module '@react-three/fiber' {
  interface ThreeElements {
    testShaderMaterial: {
      uTime?: number;
      [key: string]: unknown;
    };
    meshLineGeometry: Object3DNode<MeshLineGeometry, typeof MeshLineGeometry>;
    meshLineMaterial: MaterialNode<MeshLineMaterial, typeof MeshLineMaterial>;
    xRayMeshLineMaterial: MaterialNode<XRayMeshLineMaterial, typeof XRayMeshLineMaterial>;
  }
}

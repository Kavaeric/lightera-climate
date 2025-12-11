import { ThreeElements } from '@react-three/fiber'

declare module '@react-three/fiber' {
  interface ThreeElements {
    testShaderMaterial: {
      uTime?: number;
      [key: string]: any;
    };
  }
}


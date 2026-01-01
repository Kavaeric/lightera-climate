import { Canvas } from '@react-three/fiber';

interface CanvasViewProps {
  children: React.ReactNode;
}

/**
 * 3D Canvas wrapper that provides Three.js context.
 */
export function CanvasView({ children }: CanvasViewProps) {
  return (
    <Canvas
      camera={{ position: [2, 1, 2], fov: 60 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      {children}
    </Canvas>
  );
}

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useSimulation } from '../context/useSimulation';

interface CanvasViewProps {
  children: React.ReactNode;
}

/**
 * 3D Canvas wrapper that provides Three.js context.
 */
export function CanvasView({ children }: CanvasViewProps) {
  const { activePlanetaryConfig } = useSimulation();

  // Calculate camera position and clipping planes based on planet radius (in km)
  const cameraConfig = useMemo(() => {
    const radius = activePlanetaryConfig.radius;
    const distance = radius * 2.5;

    return {
      position: [distance, distance * 0.5, -distance * 0.2] as [number, number, number],
      fov: 50,
      near: radius * 0.01, // 1% of radius
      far: radius * 100,   // 100x radius for far clipping
    };
  }, [activePlanetaryConfig.radius]);

  return (
    <Canvas
      camera={cameraConfig}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      {children}
    </Canvas>
  );
}

import { useMemo } from 'react';
import * as THREE from 'three';
import { extend, useThree } from '@react-three/fiber';
import { MeshLineGeometry, raycast } from 'meshline';
import { XRayMeshLineMaterial } from '../rendering/materials/XRayMeshLineMaterial';

extend({ MeshLineGeometry, XRayMeshLineMaterial });

/**
 * Generates the points for a parallel (latitude circle) at a given latitude.
 *
 * @param latitude In degrees, latitude of the parallel to generate points for.
 * @param radius Radius of the sphere.
 * @param segments Number of segments to generate.
 * @returns Array of points for the parallel.
 */
function generateParallelPoints(latitude: number, radius: number, segments: number): number[] {
  const positions: number[] = [];

  if (latitude === 90 || latitude === -90) {
    console.log(`generateParallelPoints: latitude ${latitude}° is a pole, returning empty array.`);
    return [];
  }

  const latitudeRd = Math.cos((latitude * Math.PI) / 180) * radius;
  const latitudeY = Math.sin((latitude * Math.PI) / 180) * radius;

  // MeshLine has a bug where the first and last segments flicker.
  // Workaround: add tiny extension points at the start and end.
  const WORKAROUND_EXTENSION = 0.001; // Fraction of a segment to extend
  const segmentAngle = (Math.PI * 2) / segments;

  // Start with a small extension before the first point
  const startAngle = -WORKAROUND_EXTENSION * segmentAngle;
  positions.push(Math.cos(startAngle) * latitudeRd, latitudeY, Math.sin(startAngle) * latitudeRd);

  // Main circle (segments + 1 to close the loop)
  for (let i = 0; i < segments + 1; i++) {
    const angle = i * segmentAngle;
    positions.push(Math.cos(angle) * latitudeRd, latitudeY, Math.sin(angle) * latitudeRd);
  }

  // End with a small extension past the last point
  const endAngle = (segments + WORKAROUND_EXTENSION) * segmentAngle;
  positions.push(Math.cos(endAngle) * latitudeRd, latitudeY, Math.sin(endAngle) * latitudeRd);

  return positions;
}

/**
 * Generates a list of latitude subdivisions for a given latitude count between
 * two latitudes, excluding the start and end latitudes.
 *
 * @example
 * generateLatitudeSubdivisions(0, 0, 90) // []
 * generateLatitudeSubdivisions(1, 0, 90) // [45]
 * generateLatitudeSubdivisions(5, 0, 90) // [15, 30, 45, 60, 75]
 * generateLatitudeSubdivisions(2, 0, -90) // [-30, -60]
 *
 * @param latitudeCount Number of latitude subdivisions to generate.
 * @param startLatitude The latitude to start from (excluded from results).
 * @param endLatitude The latitude to end at (excluded from results).
 * @param returnStart Whether to include the start latitude in the results.
 * @param returnEnd Whether to include the end latitude in the results.
 * @returns Array of latitude subdivisions in degrees.
 */
function generateLatitudeSubdivisions(
  latitudeCount: number,
  startLatitude: number,
  endLatitude: number,
  returnStart: boolean = false,
  returnEnd: boolean = false
): number[] {
  const latitudes = [];

  // Add the start latitude if requested
  if (returnStart) {
    latitudes.push(startLatitude);
  }

  // Generate all intermediate latitudes between the start and end latitudes
  const range = endLatitude - startLatitude;
  const step = range / (latitudeCount + 1);

  for (let i = 0; i < latitudeCount; i++) {
    latitudes.push(startLatitude + (i + 1) * step);
  }

  // Add the end latitude if requested
  if (returnEnd) {
    latitudes.push(endLatitude);
  }

  console.log(
    `generateLatitudeSubdivisions: [${latitudes.map((lat) => lat.toFixed(1)).join(', ')}]`
  );

  return latitudes;
}

/**
 * Generates the points for a meridian (longitude line) at a given longitude, running from the south pole to the north pole.
 *
 * @param longitude In degrees, longitude of the meridian to generate points for.
 * @param radius Radius of the sphere.
 * @param segments Number of segments to generate.
 * @returns Array of points for the meridian.
 */
function generateMeridianPoints(longitude: number, radius: number, segments: number): number[] {
  const positions: number[] = [];

  // Convert longitude to radians for rotation around Y-axis
  const longitudeRad = (longitude * Math.PI) / 180;

  // MeshLine has a bug where the first and last segments flicker.
  // Workaround: add tiny extension points just past each pole.
  const WORKAROUND_EXTENSION = 0.001; // Fraction of a segment to extend past the poles
  const segmentAngle = (Math.PI * 2) / segments;

  // Helper to add a point at a given latitude angle, rotated by longitude
  const addPoint = (latAngle: number) => {
    // Y is up, so latitude angle determines Y and the horizontal distance from Y-axis
    const y = Math.sin(latAngle) * radius;
    const horizontalRadius = Math.cos(latAngle) * radius;
    // Longitude rotates around Y-axis, determining X and Z
    const x = Math.sin(longitudeRad) * horizontalRadius;
    const z = Math.cos(longitudeRad) * horizontalRadius;
    positions.push(x, y, z);
  };

  // Start with a small extension before the south pole
  addPoint(-Math.PI / 2 - WORKAROUND_EXTENSION * segmentAngle);

  // Main semicircle from south pole to north pole
  for (let i = 0; i < segments / 2 + 1; i++) {
    const latAngle = i * segmentAngle - Math.PI / 2;
    addPoint(latAngle);
  }

  // End with a small extension past the north pole
  addPoint(Math.PI / 2 + WORKAROUND_EXTENSION * segmentAngle);

  return positions;
}

/**
 * Generates a list of longitude subdivisions for a given longitude count between
 * two longitudes, excluding the start and end longitudes.
 *
 * @example
 * generateLongitudeSubdivisions(0, 0, 180) // []
 * generateLongitudeSubdivisions(1, 0, 180) // [90]
 * generateLongitudeSubdivisions(5, 0, 180) // [30, 60, 90, 120, 150]
 * generateLongitudeSubdivisions(2, 0, -180) // [-60, -30]
 *
 * @param longitudeCount Number of longitude subdivisions to generate.
 * @param startLongitude The longitude to start from (excluded from results).
 * @param endLongitude The longitude to end at (excluded from results).
 * @param returnStart Whether to include the start longitude in the results.
 * @param returnEnd Whether to include the end longitude in the results.
 * @returns Array of longitude subdivisions in degrees.
 */
function generateLongitudeSubdivisions(
  longitudeCount: number,
  startLongitude: number,
  endLongitude: number,
  returnStart: boolean = false,
  returnEnd: boolean = false
): number[] {
  const longitudes = [];

  // Add the start longitude if requested
  if (returnStart) {
    longitudes.push(startLongitude);
  }

  // Generate all intermediate longitudes between the start and end longitudes
  const range = endLongitude - startLongitude;
  const step = range / (longitudeCount + 1);

  for (let i = 0; i < longitudeCount; i++) {
    longitudes.push(startLongitude + (i + 1) * step);
  }

  // Add the end longitude if requested
  if (returnEnd) {
    longitudes.push(endLongitude);
  }

  console.log(
    `generateLongitudeSubdivisions: [${longitudes.map((lon) => lon.toFixed(1)).join(', ')}]`
  );

  return longitudes;
}

export interface LatLonGridProps {
  visible?: boolean;
  sphereRadius?: number;

  // Grid settings
  latitudeCount?: number;
  longitudeCount?: number;
  axialTilt?: number;

  // Display settings
  latitudeSegments?: number;
  longitudeSegments?: number;
  lineWidth?: number;
  opacity?: number;
  backOpacity?: number;
}

export function LatLonGrid({
  visible = true,
  sphereRadius = 1.0,

  // Grid settings
  latitudeCount = 5,
  longitudeCount = 8,
  axialTilt = 0,

  // Display settings
  latitudeSegments = 64,
  longitudeSegments = 64,
  lineWidth = 4,
  opacity = 0.4,
  backOpacity = 0.1,
}: LatLonGridProps): React.JSX.Element {
  const { size } = useThree();

  const LANDMARK_LINE_WIDTH_MULTIPLIER = 2;
  const LANDMARK_LINE_OPACITY_MULTIPLIER = 2;

  // Get the canvas resolution
  const resolution = useMemo(() => {
    return new THREE.Vector2(size.width, size.height);
  }, [size.width, size.height]);

  // Generate the latitude subdivisions for each hemisphere
  const latitudeSubdivisions = useMemo(() => {
    const north = generateLatitudeSubdivisions(latitudeCount, 90, 0);
    const south = generateLatitudeSubdivisions(latitudeCount, 0, -90);
    return north.concat(south);
  }, [latitudeCount]);

  // Generate the parallels for each latitude subdivision
  const parallels = useMemo(() => {
    return latitudeSubdivisions.map((latitude) => ({
      latitude,
      points: generateParallelPoints(latitude, sphereRadius, latitudeSegments),
    }));
  }, [latitudeSubdivisions, sphereRadius, latitudeSegments]);

  // Generate the longitude subdivisions
  const longitudeSubdivisions = useMemo(() => {
    const east = generateLongitudeSubdivisions(longitudeCount, 0, 180);
    const west = generateLongitudeSubdivisions(longitudeCount, 0, -180);
    return east.concat(west);
  }, [longitudeCount]);

  // Generate the meridians for each longitude subdivision
  const meridians = useMemo(() => {
    return longitudeSubdivisions.map((longitude) => ({
      longitude,
      points: generateMeridianPoints(longitude, sphereRadius, longitudeSegments),
    }));
  }, [longitudeSubdivisions, sphereRadius, longitudeSegments]);

  // Generate the equator line
  const equatorPoints = useMemo(() => {
    return generateParallelPoints(0, sphereRadius, latitudeSegments);
  }, [sphereRadius, latitudeSegments]);

  // Generate the prime meridian points
  const primeMeridianPoints = useMemo(() => {
    return generateMeridianPoints(0, sphereRadius, longitudeSegments);
  }, [sphereRadius, longitudeSegments]);

  // Generate the antimeridian points
  const antimeridianPoints = useMemo(() => {
    return generateMeridianPoints(180, sphereRadius, longitudeSegments);
  }, [sphereRadius, longitudeSegments]);

  // Generate the northern and southern tropics lines
  // AKA the tropics of Cancer and Capricorn on Earth
  const tropicNorthPoints = useMemo(() => {
    return generateParallelPoints(axialTilt, sphereRadius, latitudeSegments);
  }, [sphereRadius, latitudeSegments, axialTilt]);

  const tropicSouthPoints = useMemo(() => {
    return generateParallelPoints(-axialTilt, sphereRadius, latitudeSegments);
  }, [sphereRadius, latitudeSegments, axialTilt]);

  // Generate the northern and southern polar circles
  // AKA the Arctic and Antarctic circles on Earth
  const polarNorthPoints = useMemo(() => {
    return generateParallelPoints(90 - axialTilt, sphereRadius, latitudeSegments);
  }, [sphereRadius, latitudeSegments, axialTilt]);

  const polarSouthPoints = useMemo(() => {
    return generateParallelPoints(-90 + axialTilt, sphereRadius, latitudeSegments);
  }, [sphereRadius, latitudeSegments, axialTilt]);

  // If the grid is not visible, don't render anything
  if (!visible) return <></>;

  return (
    <>
      {parallels.map(({ latitude, points }) => {
        // Skip rendering if no points (e.g., at poles)
        if (points.length === 0) {
          return null;
        }
        return (
          <mesh key={latitude} raycast={raycast}>
            <meshLineGeometry attach="geometry" points={points} />
            <xRayMeshLineMaterial
              lineWidth={lineWidth}
              color={'white'}
              opacity={opacity}
              backfacingOpacity={backOpacity}
              resolution={resolution}
              sizeAttenuation={0} // Use screenspace size
              depthTest={false}
              transparent
            />
          </mesh>
        );
      })}
      {meridians.map(({ longitude, points }) => {
        // Skip rendering if no points (e.g., at poles)
        if (points.length === 0) {
          return null;
        }
        return (
          <mesh key={longitude} raycast={raycast}>
            <meshLineGeometry attach="geometry" points={points} />
            <xRayMeshLineMaterial
              lineWidth={lineWidth}
              color={'white'}
              opacity={opacity}
              backfacingOpacity={backOpacity}
              resolution={resolution}
              sizeAttenuation={0} // Use screenspace size
              depthTest={false}
              transparent
            />
          </mesh>
        );
      })}

      {/* Equator */}
      <mesh raycast={raycast}>
        <meshLineGeometry attach="geometry" points={equatorPoints} />
        <xRayMeshLineMaterial
          lineWidth={lineWidth * LANDMARK_LINE_WIDTH_MULTIPLIER}
          color={'coral'}
          opacity={opacity * LANDMARK_LINE_OPACITY_MULTIPLIER}
          backfacingOpacity={backOpacity}
          resolution={resolution}
          sizeAttenuation={0} // Use screenspace size
          depthTest={false}
          transparent
        />
      </mesh>

      {/* Northern tropic line */}
      <mesh raycast={raycast}>
        <meshLineGeometry attach="geometry" points={tropicSouthPoints} />
        <xRayMeshLineMaterial
          lineWidth={lineWidth * LANDMARK_LINE_WIDTH_MULTIPLIER}
          color={'white'}
          opacity={opacity * LANDMARK_LINE_OPACITY_MULTIPLIER}
          backfacingOpacity={backOpacity}
          resolution={resolution}
          sizeAttenuation={0} // Use screenspace size
          depthTest={false}
          transparent
        />
      </mesh>

      {/* Southern tropic line */}
      <mesh raycast={raycast}>
        <meshLineGeometry attach="geometry" points={tropicNorthPoints} />
        <xRayMeshLineMaterial
          lineWidth={lineWidth * LANDMARK_LINE_WIDTH_MULTIPLIER}
          color={'white'}
          opacity={opacity * LANDMARK_LINE_OPACITY_MULTIPLIER}
          backfacingOpacity={backOpacity}
          resolution={resolution}
          sizeAttenuation={0} // Use screenspace size
          depthTest={false}
          transparent
        />
      </mesh>

      {/* Northern polar circle */}
      <mesh raycast={raycast}>
        <meshLineGeometry attach="geometry" points={polarNorthPoints} />
        <xRayMeshLineMaterial
          lineWidth={lineWidth * LANDMARK_LINE_WIDTH_MULTIPLIER}
          color={'white'}
          opacity={opacity * LANDMARK_LINE_OPACITY_MULTIPLIER}
          backfacingOpacity={backOpacity}
          resolution={resolution}
          sizeAttenuation={0} // Use screenspace size
          depthTest={false}
          transparent
        />
      </mesh>

      {/* Southern polar circle */}
      <mesh raycast={raycast}>
        <meshLineGeometry attach="geometry" points={polarSouthPoints} />
        <xRayMeshLineMaterial
          lineWidth={lineWidth * LANDMARK_LINE_WIDTH_MULTIPLIER}
          color={'white'}
          opacity={opacity * LANDMARK_LINE_OPACITY_MULTIPLIER}
          backfacingOpacity={backOpacity}
          resolution={resolution}
          sizeAttenuation={0} // Use screenspace size
          depthTest={false}
          transparent
        />
      </mesh>

      {/* Prime meridian */}
      <mesh raycast={raycast}>
        <meshLineGeometry attach="geometry" points={primeMeridianPoints} />
        <xRayMeshLineMaterial
          lineWidth={lineWidth}
          color={'white'}
          opacity={opacity}
          backfacingOpacity={backOpacity}
          resolution={resolution}
          sizeAttenuation={0} // Use screenspace size
          depthTest={false}
          transparent
        />
      </mesh>

      {/* Antimeridian */}
      <mesh raycast={raycast}>
        <meshLineGeometry attach="geometry" points={antimeridianPoints} />
        <xRayMeshLineMaterial
          lineWidth={lineWidth * LANDMARK_LINE_WIDTH_MULTIPLIER}
          color={'coral'}
          opacity={opacity * LANDMARK_LINE_OPACITY_MULTIPLIER}
          backfacingOpacity={backOpacity}
          resolution={resolution}
          sizeAttenuation={0} // Use screenspace size
          depthTest={false}
          transparent
        />
      </mesh>
    </>
  );
}

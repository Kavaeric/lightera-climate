import * as THREE from 'three';

// Snyder equal-area constants for the icosahedron (radians)
const DEG = Math.PI / 180;
const RAD = 1 / DEG;
const g = 37.37736814 * DEG;
const G = 36.0 * DEG;
const th = 30.0 * DEG;

const cos_g = Math.cos(g);
const tan_g = Math.tan(g);
const tan2_g = tan_g ** 2;

const sin_G = Math.sin(G);
const cos_G = Math.cos(G);

const sin_th = Math.sin(th);
const cos_th = Math.cos(th);
const tan_th = Math.tan(th);
const cot_th = 1 / tan_th;

const SECTOR = (Math.PI * 2) / 3; // 120°
const EPS = 1e-9;
const NEWTON_MAX = 8;

const RpOverR = Math.sqrt((2 * (G - th)) / (tan2_g * sin_th * cos_th));
const RpOverR_squared = RpOverR ** 2;

const NORTH_POLE_QUAD_ID = 'NP';
const SOUTH_POLE_QUAD_ID = 'SP';

/**
 * Build a per-face frame for ISEA projection
 */
function triangleFrame({ a, b, c }: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3 }) {
  // Face-centre direction (spherical centroid)
  const n = a.clone().add(b).add(c).normalize();
  // Base direction: b -> c, then Gram–Schmidt into tangent plane
  const ref = c.clone().sub(b);
  const u = ref
    .clone()
    .sub(n.clone().multiplyScalar(ref.dot(n)))
    .normalize();
  // Complete right-handed basis
  const v = new THREE.Vector3().crossVectors(n, u).normalize();

  return { n, u, v };
}

/**
 * Computes the circumcenter of a triangle on the unit sphere.
 */
function circumcenter(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
  const tmp1 = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();

  const ba = tmp1.copy(b).sub(a);
  const ca = tmp2.copy(c).sub(a);
  const n = tmp3.copy(ba).cross(ca);
  const denom = 2 * n.lengthSq();

  if (denom === 0) {
    // Degenerate: fall back to centroid
    return a
      .clone()
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
  }

  const ba2 = ba.lengthSq();
  const ca2 = ca.lengthSq();

  const u = new THREE.Vector3()
    .copy(ca)
    .cross(n)
    .multiplyScalar(ba2)
    .add(new THREE.Vector3().copy(n).cross(ba).multiplyScalar(ca2))
    .multiplyScalar(1 / denom);

  return new THREE.Vector3().copy(a).add(u);
}

function foldAzimuth(Az_: number): [number, number] {
  let k = 0;
  let Az = Az_;
  while (Az > SECTOR) {
    Az -= SECTOR;
    k++;
  }
  return [k, Az];
}

function azimuthFromApex(x: number, y: number): number {
  return Math.PI - Math.atan2(x, -y);
}

function q_of_Az(Az: number, cos_Az?: number, sin_Az?: number): number {
  cos_Az = cos_Az === undefined ? Math.cos(Az) : cos_Az;
  sin_Az = sin_Az === undefined ? Math.sin(Az) : sin_Az;
  return Math.atan2(tan_g, cos_Az + sin_Az * cot_th);
}

function H_of_Az(Az: number, cos_Az?: number, sin_Az?: number): number {
  cos_Az = cos_Az === undefined ? Math.cos(Az) : cos_Az;
  sin_Az = sin_Az === undefined ? Math.sin(Az) : sin_Az;
  const val = sin_Az * sin_G * cos_g - cos_Az * cos_G;
  return Math.acos(THREE.MathUtils.clamp(val, -1, 1));
}

function F_of_Az_AG_H(Az: number, AG: number, H: number): number {
  return Math.PI + AG - G - H - Az;
}

function Fprime_of_AZ_H(Az: number, H: number, cos_Az?: number, sin_Az?: number): number {
  cos_Az = cos_Az === undefined ? Math.cos(Az) : cos_Az;
  sin_Az = sin_Az === undefined ? Math.sin(Az) : sin_Az;
  return (cos_Az * sin_G * cos_g + sin_Az * cos_G) / Math.sin(H) - 1;
}

function delta_Az(Az: number, AG: number, cos_Az?: number, sin_Az?: number): number {
  cos_Az = cos_Az === undefined ? Math.cos(Az) : cos_Az;
  sin_Az = sin_Az === undefined ? Math.sin(Az) : sin_Az;
  const H = H_of_Az(Az, cos_Az, sin_Az);
  return -F_of_Az_AG_H(Az, AG, H) / Fprime_of_AZ_H(Az, H, cos_Az, sin_Az);
}

function dp_of_Azp(Azp: number): number {
  return (RpOverR * tan_g) / (Math.cos(Azp) + Math.sin(Azp) * cot_th);
}

function f_of_dp_q(dp: number, q: number): number {
  return dp / (2 * RpOverR * Math.sin(q / 2));
}

function rho_of_f_z(f: number, z: number): number {
  return 2 * RpOverR * f * Math.sin(z / 2);
}

function z_of_rho_f(rho: number, f: number): number {
  const arg = rho / (2 * RpOverR * f);
  return 2 * Math.asin(THREE.MathUtils.clamp(arg, -1, 1));
}

/**
 * Forward: unit Vector3 P → { x, y }
 */
function projectVectorToFace(
  P: THREE.Vector3,
  frame: { n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 }
): { x: number; y: number } {
  const { n, u, v } = frame;

  const dot = THREE.MathUtils.clamp(n.dot(P), -1, 1);
  const z = Math.acos(dot);

  if (z > g + EPS) {
    console.warn(
      `Warning - z (${z * RAD} degrees) exceeds g (${g * RAD} degrees) by ${(z - g) * RAD} degrees.`
    );
  }

  const t = P.clone().sub(n.clone().multiplyScalar(dot)).normalize();
  const Az_ = azimuthFromApex(t.dot(u), t.dot(v));

  const [k, Az] = foldAzimuth(Az_);
  const cos_Az = Math.cos(Az);
  const sin_Az = Math.sin(Az);

  const q = q_of_Az(Az, cos_Az, sin_Az);

  if (z > q + EPS) {
    console.warn(
      `Warning - z (${z * RAD} degrees) exceeds q (${q * RAD} degrees) by ${(z - q) * RAD} degrees.`
    );
  }

  const H = H_of_Az(Az, cos_Az, sin_Az);
  const AG = Az + G + H - Math.PI;
  const Azp = Math.atan2(2 * AG, RpOverR_squared * tan2_g - 2 * AG * cot_th);
  const dp = dp_of_Azp(Azp);
  const f = f_of_dp_q(dp, q);
  const rho = rho_of_f_z(f, z);

  const Azp_ = Azp + k * SECTOR;

  const x = rho * Math.sin(Azp_);
  const y = rho * Math.cos(Azp_);

  return { x, y };
}

/**
 * Inverse: (x, y) → P (Vector3)
 */
function unprojectFromFace(
  { x, y }: { x: number; y: number },
  frame: { n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 }
): THREE.Vector3 {
  const { n, u, v } = frame;

  const Azp_ = azimuthFromApex(x, y);
  const rho = Math.hypot(x, y);

  const [k, Azp] = foldAzimuth(Azp_);

  const cos_AZp = Math.cos(Azp);
  const sin_Azp = Math.sin(Azp);
  const AG_denom = 2 * (cos_AZp + cot_th * sin_Azp);
  const AG = (RpOverR_squared * tan2_g * sin_Azp) / AG_denom;

  let Az = Azp;
  let cos_Az = cos_AZp;
  let sin_Az = sin_Azp;

  let iter = 0;
  while (iter++ < NEWTON_MAX) {
    const dAz = delta_Az(Az, AG, cos_Az, sin_Az);
    Az += dAz;
    cos_Az = Math.cos(Az);
    sin_Az = Math.sin(Az);
    if (Math.abs(dAz) < EPS) break;
  }

  const q = q_of_Az(Az, cos_Az, sin_Az);
  const dp = dp_of_Azp(Azp);
  const f = f_of_dp_q(dp, q);
  const z = z_of_rho_f(rho, f);

  const Az_ = Az + k * SECTOR;

  const t = u
    .clone()
    .multiplyScalar(Math.sin(Az_))
    .add(v.clone().multiplyScalar(Math.cos(Az_)))
    .normalize();
  const P = n
    .clone()
    .multiplyScalar(Math.cos(z))
    .add(t.multiplyScalar(Math.sin(z)))
    .normalize();

  return P;
}

export class GridCell {
  coords: [string | number, number, number, number];
  isNorthPole: boolean;
  isSouthPole: boolean;
  isPole: boolean;
  id: string;
  centerVertex: THREE.Vector3;
  latLon: { lat: number; lon: number };
  isPentagon: boolean;
  isAlongIcosahedronEdge: boolean;
  vertices: THREE.Vector3[] | null = null;
  faceTriangles: THREE.Triangle[] | null = null;
  area = 0;

  constructor(N: number, quadId: string | number, x: number, y: number, center: THREE.Vector3) {
    this.coords = [quadId, N, x, y];
    this.isNorthPole = quadId === NORTH_POLE_QUAD_ID;
    this.isSouthPole = quadId === SOUTH_POLE_QUAD_ID;
    this.isPole = this.isNorthPole || this.isSouthPole;
    this.id = `${quadId}-${N}-${x}-${y}`;
    this.centerVertex = center;

    // Pre-calculate latitude and longitude from 3D position
    // Latitude: angle from equatorial plane (-90° to +90°)
    // Longitude: angle in equatorial plane from prime meridian (-180° to +180°)
    this.latLon = {
      lat: (Math.asin(center.y) * 180) / Math.PI,
      lon: (Math.atan2(center.x, center.z) * 180) / Math.PI,
    };

    this.isPentagon = this.isPole || (x === N - 1 && y === 0);
    this.isAlongIcosahedronEdge = this.isPentagon || x === N - 1 || y === 0 || x + y === N - 1;
  }

  calculateVertices(grid: Grid) {
    const neighbourCells = this.neighbours(grid);
    this.vertices = new Array(neighbourCells.length);
    for (let i = 0; i < neighbourCells.length; i++) {
      const neighbourA = neighbourCells[i];
      const neighbourB = neighbourCells[(i + 1) % neighbourCells.length];
      const vertex = circumcenter(
        this.centerVertex,
        neighbourA.centerVertex,
        neighbourB.centerVertex
      );
      this.vertices[i] = vertex;
    }
    this.calculateFaceTriangles();
  }

  calculateFaceTriangles() {
    if (!this.vertices || this.vertices.length < 3) {
      this.faceTriangles = [];
      return;
    }

    this.faceTriangles = new Array(this.vertices.length - 2);
    let tri = 0;
    this.faceTriangles[tri++] = new THREE.Triangle(
      this.vertices[0],
      this.vertices[1],
      this.vertices[2]
    );
    for (let i = 2; i + 1 < this.vertices.length; i++) {
      this.faceTriangles[tri++] = new THREE.Triangle(
        this.vertices[0],
        this.vertices[i],
        this.vertices[i + 1]
      );
    }
    for (const triangle of this.faceTriangles) {
      this.area += triangle.getArea();
    }
  }

  neighbours(grid: Grid): GridCell[] {
    const { quadCells, northPole, southPole } = grid;
    const [quadId, N, x, y] = this.coords;

    if (typeof quadId === 'number' && quadId >= 0 && 0 < x && x < N - 1 && 0 < y && y < N - 1) {
      // Common case: all neighbours are on the same quad
      const quad = quadCells[quadId];
      return [
        quad[N * (x - 1) + y],
        quad[N * (x - 1) + y + 1],
        quad[N * x + y + 1],
        quad[N * (x + 1) + y],
        quad[N * (x + 1) + y - 1],
        quad[N * x + y - 1],
      ];
    }

    if (typeof quadId === 'number' && 0 <= quadId && quadId < 5) {
      // In an edge along one of the upper quads
      if (x === 0) {
        // Along top-left edge
        if (y === 0) {
          // top corner
          return [
            northPole,
            quadCells[(quadId + 4) % 5][0],
            quadCells[quadId][1],
            quadCells[quadId][N],
            quadCells[(quadId + 1) % 5][1],
            quadCells[(quadId + 1) % 5][0],
          ];
        }

        if (y < N - 1) {
          // Inner edge
          return [
            quadCells[(quadId + 4) % 5][N * (y - 1)],
            quadCells[(quadId + 4) % 5][N * y],
            quadCells[quadId][y + 1],
            quadCells[quadId][N + y],
            quadCells[quadId][N + y - 1],
            quadCells[quadId][y - 1],
          ];
        }

        // Must be left corner. y === N-1
        return [
          quadCells[(quadId + 4) % 5][N * (N - 2)],
          quadCells[(quadId + 4) % 5][N * (N - 1)],
          quadCells[5 + ((quadId + 4) % 5)][0],
          quadCells[quadId][2 * N - 1],
          quadCells[quadId][2 * N - 2],
          quadCells[quadId][N - 2],
        ];
      }

      if (x < N - 1) {
        if (y === 0) {
          // Along top-right edge
          return [
            quadCells[quadId][N * (x - 1)],
            quadCells[quadId][N * (x - 1) + 1],
            quadCells[quadId][N * x + 1],
            quadCells[quadId][N * (x + 1)],
            quadCells[(quadId + 1) % 5][x + 1],
            quadCells[(quadId + 1) % 5][x],
          ];
        }

        // Must be bottom-left edge. y === N-1
        return [
          quadCells[quadId][N * x - 1],
          quadCells[5 + ((quadId + 4) % 5)][N * (x - 1)],
          quadCells[5 + ((quadId + 4) % 5)][N * x],
          quadCells[quadId][N * (x + 2) - 1],
          quadCells[quadId][N * (x + 2) - 2],
          quadCells[quadId][N * (x + 1) - 2],
        ];
      }

      // Bottom right edge. x === N-1
      if (y === 0) {
        // right-corner
        return [
          quadCells[quadId][N * (N - 2)],
          quadCells[quadId][N * (N - 2) + 1],
          quadCells[quadId][N * (N - 1) + 1],
          quadCells[quadId + 5][0],
          quadCells[(quadId + 1) % 5][N - 1],
        ];
      }

      if (y < N - 1) {
        // inner right edge
        return [
          quadCells[quadId][N * (N - 2) + y],
          quadCells[quadId][N * (N - 2) + y + 1],
          quadCells[quadId][N * (N - 1) + y + 1],
          quadCells[quadId + 5][y],
          quadCells[quadId + 5][y - 1],
          quadCells[quadId][N * (N - 1) + y - 1],
        ];
      }

      // bottom corner. y === N-1
      return [
        quadCells[quadId][N * (N - 1) - 1],
        quadCells[5 + ((quadId + 4) % 5)][N * (N - 2)],
        quadCells[5 + ((quadId + 4) % 5)][N * (N - 1)],
        quadCells[quadId + 5][N - 1],
        quadCells[quadId + 5][N - 2],
        quadCells[quadId][N * N - 2],
      ];
    }

    if (typeof quadId === 'number' && 5 <= quadId && quadId < 10) {
      // In an edge along one of the lower quads
      if (x === 0) {
        // Along top-left edge
        if (y === 0) {
          // top corner
          return [
            quadCells[quadId - 5][N * (N - 1)],
            quadCells[quadId - 5][N * (N - 1) + 1],
            quadCells[quadId][1],
            quadCells[quadId][N],
            quadCells[(quadId - 4) % 5][2 * N - 1],
            quadCells[(quadId - 4) % 5][N - 1],
          ];
        }

        if (y < N - 1) {
          // Inner edge
          return [
            quadCells[quadId - 5][N * (N - 1) + y],
            quadCells[quadId - 5][N * (N - 1) + y + 1],
            quadCells[quadId][y + 1],
            quadCells[quadId][N + y],
            quadCells[quadId][N + y - 1],
            quadCells[quadId][y - 1],
          ];
        }

        // Must be left corner. y === N-1
        return [
          quadCells[quadId - 5][N * N - 1],
          quadCells[5 + ((quadId - 1) % 5)][N * (N - 1)],
          quadCells[5 + ((quadId - 1) % 5)][N * (N - 1) + 1],
          quadCells[quadId][2 * N - 1],
          quadCells[quadId][2 * N - 2],
          quadCells[quadId][N - 2],
        ];
      }

      if (x < N - 1) {
        if (y === 0) {
          // Along top-right edge
          return [
            quadCells[quadId][N * (x - 1)],
            quadCells[quadId][N * (x - 1) + 1],
            quadCells[quadId][N * x + 1],
            quadCells[quadId][N * (x + 1)],
            quadCells[(quadId - 4) % 5][N * (x + 2) - 1],
            quadCells[(quadId - 4) % 5][N * (x + 1) - 1],
          ];
        }

        // Must be bottom-left edge. y === N-1
        return [
          quadCells[quadId][N * x - 1],
          quadCells[5 + ((quadId - 1) % 5)][N * (N - 1) + x],
          quadCells[5 + ((quadId - 1) % 5)][N * (N - 1) + x + 1],
          quadCells[quadId][N * (x + 2) - 1],
          quadCells[quadId][N * (x + 2) - 2],
          quadCells[quadId][N * (x + 1) - 2],
        ];
      }

      // Bottom right edge. x === N-1
      if (y === 0) {
        // right-corner
        return [
          quadCells[quadId][N * (N - 2)],
          quadCells[quadId][N * (N - 2) + 1],
          quadCells[quadId][N * (N - 1) + 1],
          quadCells[5 + ((quadId + 1) % 5)][N - 1],
          quadCells[(quadId - 4) % 5][N * N - 1],
        ];
      }

      if (y < N - 1) {
        // inner right edge
        return [
          quadCells[quadId][N * (N - 2) + y],
          quadCells[quadId][N * (N - 2) + y + 1],
          quadCells[quadId][N * (N - 1) + y + 1],
          quadCells[5 + ((quadId + 1) % 5)][N * (y + 1) - 1],
          quadCells[5 + ((quadId + 1) % 5)][N * y - 1],
          quadCells[quadId][N * (N - 1) + y - 1],
        ];
      }

      // bottom corner. y === N-1
      return [
        quadCells[quadId][N * (N - 1) - 1],
        quadCells[5 + ((quadId - 1) % 5)][N * N - 1],
        southPole,
        quadCells[5 + ((quadId + 1) % 5)][N * N - 1],
        quadCells[5 + ((quadId + 1) % 5)][N * (N - 1) - 1],
        quadCells[quadId][N * N - 2],
      ];
    }

    // Handle poles
    if (this.isNorthPole) {
      return [quadCells[0][0], quadCells[1][0], quadCells[2][0], quadCells[3][0], quadCells[4][0]];
    }

    // Must be south pole
    return [
      quadCells[9][N * N - 1],
      quadCells[8][N * N - 1],
      quadCells[7][N * N - 1],
      quadCells[6][N * N - 1],
      quadCells[5][N * N - 1],
    ];
  }
}

class Icosahedron {
  vertices: THREE.Vector3[];
  faces: THREE.Triangle[];
  quads: Array<{
    up: { tri: THREE.Triangle; frame: { n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 } };
    down: { tri: THREE.Triangle; frame: { n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 } };
  }>;

  constructor() {
    // Construct icosahedron with normalized vertices
    const a = 1 / Math.sqrt((5 + Math.sqrt(5)) / 2);
    const b = (a * (1 + Math.sqrt(5))) / 2;

    const A = new THREE.Vector3(-a, 0, b);
    const B = new THREE.Vector3(a, 0, b);
    const C = new THREE.Vector3(0, b, a);
    const D = new THREE.Vector3(-b, a, 0);
    const E = new THREE.Vector3(-b, -a, 0);
    const F = new THREE.Vector3(0, -b, a);
    const G = new THREE.Vector3(b, a, 0);
    const H = new THREE.Vector3(0, b, -a);
    const I = new THREE.Vector3(-a, 0, -b);
    const J = new THREE.Vector3(0, -b, -a);
    const K = new THREE.Vector3(b, -a, 0);
    const L = new THREE.Vector3(a, 0, -b);

    this.vertices = [A, B, C, D, E, F, G, H, I, J, K, L];

    // Rotate so A is north pole and L is south pole
    const m = new THREE.Matrix3(b, 0, a, 0, 1, 0, -a, 0, b);
    this.vertices.forEach((vec) => vec.applyMatrix3(m));

    this.faces = [
      new THREE.Triangle(A, B, C),
      new THREE.Triangle(A, C, D),
      new THREE.Triangle(A, D, E),
      new THREE.Triangle(A, E, F),
      new THREE.Triangle(A, F, B),

      new THREE.Triangle(G, C, B),
      new THREE.Triangle(H, D, C),
      new THREE.Triangle(I, E, D),
      new THREE.Triangle(J, F, E),
      new THREE.Triangle(K, B, F),

      new THREE.Triangle(C, G, H),
      new THREE.Triangle(D, H, I),
      new THREE.Triangle(E, I, J),
      new THREE.Triangle(F, J, K),
      new THREE.Triangle(B, K, G),

      new THREE.Triangle(L, H, G),
      new THREE.Triangle(L, I, H),
      new THREE.Triangle(L, J, I),
      new THREE.Triangle(L, K, J),
      new THREE.Triangle(L, G, K),
    ];

    this.quads = [
      Icosahedron.makeQuad(this.faces[0], this.faces[5]),
      Icosahedron.makeQuad(this.faces[1], this.faces[6]),
      Icosahedron.makeQuad(this.faces[2], this.faces[7]),
      Icosahedron.makeQuad(this.faces[3], this.faces[8]),
      Icosahedron.makeQuad(this.faces[4], this.faces[9]),
      Icosahedron.makeQuad(this.faces[10], this.faces[15]),
      Icosahedron.makeQuad(this.faces[11], this.faces[16]),
      Icosahedron.makeQuad(this.faces[12], this.faces[17]),
      Icosahedron.makeQuad(this.faces[13], this.faces[18]),
      Icosahedron.makeQuad(this.faces[14], this.faces[19]),
    ];
  }

  static makeQuad(upTri: THREE.Triangle, downTri: THREE.Triangle) {
    const upFrame = triangleFrame(upTri);
    const downFrame = triangleFrame(downTri);

    return {
      up: { tri: upTri, frame: upFrame },
      down: { tri: downTri, frame: downFrame },
    };
  }
}

export class Grid {
  quadCells: GridCell[][];
  northPole: GridCell;
  southPole: GridCell;
  size: number;

  constructor(N: number) {
    const { quadCells, northPole, southPole } = Grid.make(N);

    this.quadCells = quadCells;
    this.northPole = northPole;
    this.southPole = southPole;
    this.size = 10 * N * N + 2;

    for (const cell of this) {
      cell.calculateVertices(this);
    }
  }

  *[Symbol.iterator]() {
    yield this.northPole;
    for (const quad of this.quadCells) {
      for (const cell of quad) {
        yield cell;
      }
    }
    yield this.southPole;
  }

  static make(N: number) {
    const ico = new Icosahedron();
    const refGrid = Grid.makeRefQuad(ico.quads[0], N);

    const quadCells = new Array(10);
    for (let i = 0; i < 10; i++) {
      const upFrame = ico.quads[i].up.frame;
      const downFrame = ico.quads[i].down.frame;

      const cells = new Array(N * N);
      for (let x = 1; x <= N; x++) {
        for (let y = 0; y < N; y++) {
          let refPoint, refFrame;
          if (x + y <= N) {
            refPoint = refGrid[x][y].up;
            refFrame = upFrame;
          } else {
            refPoint = refGrid[x][y].down;
            if (refPoint === undefined) {
              console.error(`ERROR!! refPoint (${x}, ${y}) is undefined.`);
            }
            refFrame = downFrame;
          }
          const center = unprojectFromFace(refPoint, refFrame);
          cells[N * (x - 1) + y] = new GridCell(N, i, x - 1, y, center);
        }
      }
      quadCells[i] = cells;
    }

    const northPoleCenter = unprojectFromFace(refGrid[0][0].up, ico.quads[0].up.frame);
    const southPoleCenter = unprojectFromFace(refGrid[N][N].down, ico.quads[5].down.frame);

    const northPole = new GridCell(N, NORTH_POLE_QUAD_ID, 0, 0, northPoleCenter);
    const southPole = new GridCell(N, SOUTH_POLE_QUAD_ID, 0, 0, southPoleCenter);

    return { northPole, southPole, quadCells };
  }

  static makeRefQuad(
    {
      up: { tri, frame },
    }: {
      up: { tri: THREE.Triangle; frame: { n: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 } };
    },
    N: number
  ) {
    const { a: A, b: B, c: C } = tri;
    const { x: Ax, y: Ay } = projectVectorToFace(A, frame);
    const { x: Bx, y: By } = projectVectorToFace(B, frame);
    const { x: Cx, y: Cy } = projectVectorToFace(C, frame);

    const A0 = new THREE.Vector2(Ax, Ay);
    const x0 = new THREE.Vector2(Cx, Cy).sub(A0).divideScalar(N);
    const y0 = new THREE.Vector2(Bx, By).sub(A0).divideScalar(N);

    const grid = new Array(N + 1);
    for (let col = 0; col <= N; col++) {
      grid[col] = new Array(N + 1);
      for (let row = 0; row <= N; row++) {
        grid[col][row] = {};
      }
    }

    for (let x = 0; x <= N; x++) {
      for (let y = 0; x + y <= N; y++) {
        const p = A0.clone();
        if (x > 0) p.add(x0.clone().multiplyScalar(x));
        if (y > 0) p.add(y0.clone().multiplyScalar(y));
        grid[x][y].up = p;
        grid[N - x][N - y].down = p;
      }
    }

    return grid;
  }
}

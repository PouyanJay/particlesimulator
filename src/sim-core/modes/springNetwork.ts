/**
 * Spring-network topology builder for the spring-mass mode. Pure and deterministic: given a
 * grid description it returns the node positions, the spring edge list, each spring's rest
 * length (= its initial separation), and which nodes are pinned. No physics, no RNG — so the
 * mode's stepping logic and this connectivity can be tested independently.
 *
 * The grid is `cols × rows × layers` nodes (X × Y × Z), centred on the origin with uniform
 * `spacing`. The single parameterisation spans the roadmap's topologies:
 *   - **rope / chain:** cols > 1, rows = 1, layers = 1
 *   - **cloth:**        cols > 1, rows > 1, layers = 1   (a sheet in the XY plane)
 *   - **lattice / deformable block:** all three > 1
 *
 * Spring families (each added once, lower node index → higher, so there are no duplicates):
 *   - **structural** — always: nearest neighbours along ±X, ±Y, ±Z. Give the network its shape.
 *   - **shear** — optional: face diagonals of every unit cell. Resist in-plane shearing
 *     (a structural-only cloth collapses diagonally without these).
 *   - **bend** — optional: skip-one neighbours (2·spacing apart) along each axis. Resist folding.
 *
 * Node index is `x + y·cols + z·cols·rows`. `pinTop` pins the whole top row (maximum Y) so a
 * cloth or rope hangs from its top edge under gravity.
 */

export interface SpringNetworkOptions {
  /** Node count along X (≥ 1). */
  cols: number
  /** Node count along Y (≥ 1). The top row (max Y) is what `pinTop` fixes. */
  rows: number
  /** Node count along Z (≥ 1). 1 = a flat sheet / chain; > 1 = a 3-D lattice. */
  layers: number
  /** Rest spacing between adjacent nodes. */
  spacing: number
  /** Add face-diagonal springs (in-plane shear resistance). */
  shear: boolean
  /** Add skip-one springs (bending resistance). */
  bend: boolean
  /** Pin the top row (max Y) so the network hangs from it. */
  pinTop: boolean
}

export interface SpringNetwork {
  /** Number of nodes (= cols·rows·layers). */
  nodeCount: number
  /** xyz-interleaved initial positions, length 3·nodeCount. */
  positions: Float64Array
  /** Spring endpoints as node-index pairs (i, j), length 2·edgeCount. */
  edges: Uint32Array
  /** Per-edge rest length (initial separation), length edgeCount. */
  restLengths: Float64Array
  /** 1 = node held fixed (pinned), 0 = free; length nodeCount. */
  pinned: Uint8Array
}

export function buildSpringNetwork(options: SpringNetworkOptions): SpringNetwork {
  const cols = Math.max(1, Math.floor(options.cols))
  const rows = Math.max(1, Math.floor(options.rows))
  const layers = Math.max(1, Math.floor(options.layers))
  const { spacing, shear, bend, pinTop } = options

  const nodeCount = cols * rows * layers
  const positions = new Float64Array(nodeCount * 3)
  const pinned = new Uint8Array(nodeCount)

  // Index of grid cell (x, y, z) into the flat node arrays.
  const idx = (x: number, y: number, z: number): number => x + y * cols + z * cols * rows

  // Centre the grid on the origin: offsets put the mean position at 0 along each axis.
  const ox = ((cols - 1) * spacing) / 2
  const oy = ((rows - 1) * spacing) / 2
  const oz = ((layers - 1) * spacing) / 2

  for (let z = 0; z < layers; z++) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const o = idx(x, y, z) * 3
        positions[o] = x * spacing - ox
        positions[o + 1] = y * spacing - oy
        positions[o + 2] = z * spacing - oz
        if (pinTop && y === rows - 1) pinned[idx(x, y, z)] = 1
      }
    }
  }

  // Collect edges as flat pairs, computing each rest length from the actual geometry.
  const edgeList: number[] = []
  const restList: number[] = []
  const addEdge = (a: number, b: number): void => {
    const oa = a * 3
    const ob = b * 3
    const r = Math.hypot(positions[oa] - positions[ob], positions[oa + 1] - positions[ob + 1], positions[oa + 2] - positions[ob + 2])
    edgeList.push(a, b)
    restList.push(r)
  }

  for (let z = 0; z < layers; z++) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y, z)

        // Structural: +X, +Y, +Z nearest neighbours (each edge added from the lower index).
        if (x + 1 < cols) addEdge(i, idx(x + 1, y, z))
        if (y + 1 < rows) addEdge(i, idx(x, y + 1, z))
        if (z + 1 < layers) addEdge(i, idx(x, y, z + 1))

        if (shear) {
          // Face diagonals of the unit cell in each of the three plane orientations.
          if (x + 1 < cols && y + 1 < rows) {
            addEdge(i, idx(x + 1, y + 1, z))
            addEdge(idx(x + 1, y, z), idx(x, y + 1, z))
          }
          if (x + 1 < cols && z + 1 < layers) {
            addEdge(i, idx(x + 1, y, z + 1))
            addEdge(idx(x + 1, y, z), idx(x, y, z + 1))
          }
          if (y + 1 < rows && z + 1 < layers) {
            addEdge(i, idx(x, y + 1, z + 1))
            addEdge(idx(x, y + 1, z), idx(x, y, z + 1))
          }
        }

        if (bend) {
          // Skip-one neighbours along each axis (2·spacing apart).
          if (x + 2 < cols) addEdge(i, idx(x + 2, y, z))
          if (y + 2 < rows) addEdge(i, idx(x, y + 2, z))
          if (z + 2 < layers) addEdge(i, idx(x, y, z + 2))
        }
      }
    }
  }

  return {
    nodeCount,
    positions,
    edges: Uint32Array.from(edgeList),
    restLengths: Float64Array.from(restList),
    pinned,
  }
}

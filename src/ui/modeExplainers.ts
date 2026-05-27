/**
 * Short, plain-language explainer for each simulation mode — what it shows and what to look
 * for. Display copy lives here in the UI layer (not in sim-core, which stays logic-only),
 * keyed by the mode id. Every registered mode must have an entry (enforced by test).
 */
export const MODE_EXPLAINERS: Record<string, string> = {
  'elastic-gas':
    'Equal-mass spheres bouncing elastically in a box. Watch the speed distribution relax to the Maxwell–Boltzmann curve, and check that P·V = N·k·T.',
  'particle-life':
    'A few particle types attract and repel by an asymmetric rule matrix. Simple local forces, lifelike emergent structure — cells, chasers, membranes.',
  nbody:
    'Gravitational N-body: every body pulls on every other. Spin a disc into spiral arms, or let a cloud collapse and slingshot. CPU path, up to a few thousand bodies.',
  'nbody-gpu':
    'The same gravitational N-body model on the GPU — tens of thousands of bodies in real time via a compute kernel. Requires WebGPU.',
  boids:
    'Flocking from three local rules — separation, alignment, cohesion. Emergent murmurations with no leader and no global plan.',
  'molecular-dynamics':
    'A Lennard-Jones gas with realistic intermolecular forces (velocity Verlet). Shows ideal-gas behaviour, Maxwell–Boltzmann, and phase changes; optional real-substance units.',
  electrostatics:
    "Charged particles under Coulomb's law, signed by charge. Like charges repel, opposites attract — plasma-like oscillation and recombination.",
}

export function explainerFor(modeId: string): string | undefined {
  return MODE_EXPLAINERS[modeId]
}

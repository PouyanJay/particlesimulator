# Simulation Mode Catalogue

> Reference for every simulation mode the Particle Lab should support: algorithm, what it teaches, scale
> ceiling, key parameters, backend, difficulty/impact, and reusable open-source references.
> See [roadmap.md](./roadmap.md) for *when* each ships and [tech-decisions.md](./tech-decisions.md) for the
> backend rationale. Compiled 2026-05-24.

## Ratings & ranking

Difficulty (**D**) and Impact/"wow + pedagogy" (**I**) on a 1–5 scale. "Order" is the recommended build
sequence by impact-per-effort (independent of phase).

| # | Mode | Backend | D | I | Build order | Ships in |
|---|---|---|---|---|---|---|
| 1 | **Particle-Life** (interaction matrix) | WebGPU + hash grid + sort | 3 | 5 | 1 | Phase 2 |
| 2 | **N-body gravity** (all-pairs) | WebGPU | 2 | 5 | 2 | Phase 2 |
| 3 | **Boids / flocking** | WebGPU + grid | 2 | 4 | 3 | Phase 3 |
| 4 | **Electrostatics** (Coulomb) | WebGPU (reuse n-body kernel) | 2 | 3 | 4 | Phase 3 |
| 5 | **MD / Lennard-Jones gas** | WebGPU + grid + Verlet | 3 | 5 | 5 | Phase 3 |
| 6 | **Elastic-collision gas at scale** | WebGPU (MD-style) | 3 | 3 | 6 | Phase 1→2 |
| 7 | **Spring-mass / cloth** | WebGPU PBD | 3 | 3 | 7 | Phase 4 |
| 8 | **Rigid-body sandbox** (joints/stacks/CCD) | **Rapier** (CPU) | 2 | 3 | 8 | Phase 4 |
| 9 | **SPH / MLS-MPM fluids** | WebGPU | 5 | 5 | 9 | Phase 4 |
| 10 | **Soft bodies / granular sand** (XPBD) | WebGPU PBD | 4 | 4 | 10 | Phase 4 |
| 11 | **Barnes-Hut N-body** (>50k gravity) | WebGPU octree | 5 | 3 | 11 (stretch) | Phase 4+ |
| — | **Brownian tracer** | reuse MD/elastic gas | 1 | 3 | with MD | Phase 3 |

Other candidate modes to consider later (lower priority): grid-based Navier–Stokes dye/velocity fluid
(Pavel Dobryakov style), falling-sand/materials cellular automata (Powder Toy / Sandspiel), continuous
cellular automata (Lenia), wave/ripple tank (interference, diffraction, Doppler).

---

## 1. Particle-Life (interaction matrix) — D3 / I5

- **Algorithm:** each particle has a color *type*; an N×N **asymmetric** attraction/repulsion matrix sets
  the force between every type pair (intentionally violating Newton's 3rd law → emergent "life"). Force is
  piecewise-linear in distance with a short-range repulsion core. Spatial-hash binning (cell size = max
  force radius) + GPU sort reduces O(N²) to neighbor-only.
- **Teaches:** emergence — complex lifelike structure from simple local rules. Fewer types → large coherent
  structures; more types → busy local ecosystems. The canonical "wow."
- **Scale:** ~65,536 particles in-browser on WebGPU (vs ~4k on CPU).
- **Key params:** #types, interaction matrix (editable + randomize + symmetry toggle), force radius,
  repulsion radius, friction/damping, particle count.
- **Reuse:** [lisyarus WebGPU writeup + code](https://lisyarus.github.io/blog/posts/particle-life-simulation-in-browser-using-webgpu.html),
  [Tom Mohr particle-life-app](https://github.com/tom-mohr/particle-life-app), [Ventrella Clusters](https://www.ventrella.com/Clusters/).

## 2. N-body gravity (all-pairs) — D2 / I5

- **Algorithm:** every particle attracts every other via F = G·m₁m₂/r²; sum forces (O(N²), trivially
  parallel), integrate with **velocity Verlet** (symplectic, energy-stable). Softening term to avoid
  singularities at r→0.
- **Teaches:** gravitation, orbital mechanics, galaxy formation, three-body chaos, conservation of energy/momentum.
- **Scale:** ~10k–50k all-pairs on GPU; >50k needs Barnes-Hut (#11).
- **Key params:** G, softening, #bodies, mass distribution, time-scale; **preset initial conditions**
  (galaxy disk, big bang, swirl, two-galaxy collision, three-body).
- **Reuse:** [GPU Gems Ch.31 N-body](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-31-fast-n-body-simulation-cuda),
  [JS_ParticleSystem (1M, Barnes-Hut + GPGPU)](https://github.com/DrA1ex/JS_ParticleSystem),
  [galaxy WebGPU compute](https://threejsroadmap.com/blog/galaxy-simulation-webgpu-compute-shaders).

## 3. Boids / flocking — D2 / I4

- **Algorithm:** per-bird steering = separation + alignment + cohesion over neighbors within a radius.
  Uniform spatial-hash grid mandatory above ~50k.
- **Teaches:** emergent collective behavior, self-organization, local-rules→global-pattern.
- **Scale:** 10k @ 60fps trivially; millions with grid + sort.
- **Key params:** separation/alignment/cohesion weights, perception radius, max speed/force, pointer-disturb.
- **Reuse:** [WebGPU Samples computeBoids](https://webgpu.github.io/webgpu-samples/samples/computeBoids/),
  [BoidsWebGPU](https://github.com/jtsorlinis/BoidsWebGPU),
  [three.js webgpu_compute_birds](https://threejs.org/examples/webgpu_compute_birds.html).

## 4. Electrostatics / charged particles — D2 / I3

- **Algorithm:** same kernel as N-body but Coulomb force (1/r², signed by charge) — like charges repel,
  opposite attract. Reuse the gravity backend with a charge term.
- **Teaches:** Coulomb's law, field lines, Debye shielding, plasma behavior, equilibrium configurations.
- **Scale:** all-pairs to ~50k; particle-mesh (PIC) or Barnes-Hut for more.
- **Key params:** Coulomb constant, charge distribution (+/−), #particles, field-line visualization toggle.

## 5. Molecular dynamics / Lennard-Jones gas — D3 / I5 (educational gold)

- **Algorithm:** pairwise Lennard-Jones potential with a **cutoff radius** → uniform grid / cell list for
  O(N) neighbor cost. **Velocity Verlet** + periodic or walled boundaries (standard MD recipe).
- **Teaches:** ideal gas law, **Maxwell–Boltzmann speed distribution**, temperature = mean KE, pressure =
  wall impulse/area, phase transitions (gas↔liquid↔solid), Brownian motion, equipartition. *Best vehicle
  for the flagship Maxwell–Boltzmann histogram.*
- **Scale:** ~5k atoms unoptimized @ 60fps; gridded GPU version scales much higher.
- **Key params:** temperature/heat, density, box volume (movable wall), particle mass(es), LJ ε/σ, cutoff.
- **Reuse:** [Schroeder Interactive MD (arXiv)](https://arxiv.org/pdf/1502.06169),
  [Ideal-Gas / Maxwell-Boltzmann demo](https://github.com/rafael-fuente/Ideal-Gas-Simulation-To-Verify-Maxwell-Boltzmann-distribution),
  [webgpu-compute-exploration (MIT)](https://github.com/scttfrdmn/webgpu-compute-exploration).

## 6. Elastic-collision gas at scale — D3 / I3

- **Algorithm:** the *current* mode, scaled up. On GPU, model as MD with a hard-sphere / short-range
  repulsion + spatial grid. Natural "500 → 100k" upgrade of today's simulation.
- **Teaches:** elastic collisions, momentum/energy conservation, kinetic theory (overlaps with #5).
- **Key params:** restitution, particle size/mass variation, initial velocity, count, container size, friction.

## 7. Spring-mass / cloth — D2–3 / I3

- **Algorithm:** Hooke's law + damping between connected masses; **semi-implicit (symplectic) Euler** or
  Verlet (RK4 is *worse* for stiff springs). Cloth = a grid of springs (structural + shear + bend).
- **Teaches:** Hooke's law, oscillation, resonance, wave propagation in lattices, deformation.
- **Key params:** stiffness, damping, rest length, mass, grid resolution, pin points, gravity, wind.

## 8. Rigid-body sandbox — D2 / I3 (**Rapier**, CPU)

- **Algorithm:** Rapier's constraint solver — proper contact resolution, friction, restitution, joints,
  stacking, CCD. The one mode that stays on CPU because correctness matters and counts stay modest.
- **Teaches:** rigid-body dynamics, friction, restitution, constraints, stable stacking.
- **Scale:** ~1k–5k active bodies @ 60fps (upgrade to the SIMD build for 2–5× more).
- **Key params:** restitution, friction, joints, gravity; grab-and-throw, barriers, drop-in shapes.
- **Reuse:** [Rapier](https://rapier.rs/), [@react-three/rapier](https://github.com/pmndrs/react-three-rapier), `@dimforge/rapier3d-simd`.

## 9. SPH / MLS-MPM fluids — D5 / I5

- **Algorithm:**
  - **SPH:** density → pressure/viscosity forces → integrate, with fixed-radius neighbor search (the bottleneck). ~30k on iGPU.
  - **MLS-MPM** (preferred): particle→grid (P2G) and grid→particle (G2P) eliminates neighbor search →
    ~100k on iGPU, ~300k on mid GPUs (even runs on old iPads). Needs fixed-point `atomicAdd` for P2G scatter.
  - **Rendering:** Screen-Space Fluid Rendering (depth + thickness + bilateral blur + normal reconstruction + refraction).
- **Teaches:** fluid dynamics, pressure, viscosity, surface tension, incompressibility.
- **Key params:** viscosity, stiffness/pressure, rest density, gravity, particle count; pointer "splat" forces.
- **Reuse:** [webgpu-ocean (MLS-MPM + SPH + SSFR)](https://github.com/matsuoka-601/webgpu-ocean),
  [jeantimex/fluid (SPH + PIC/FLIP)](https://github.com/jeantimex/fluid),
  [Codrops WebGPU fluids](https://tympanus.net/codrops/2025/02/26/webgpu-fluid-simulations-high-performance-real-time-rendering/),
  and the 2D grid Navier–Stokes alternative [WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation).

## 10. Soft bodies / granular sand (XPBD) — D4 / I4

- **Algorithm:** **Position-Based Dynamics** — predict positions → iteratively project constraints
  (distance, volume, collision) → derive velocity. **XPBD** adds compliance (stiffness independent of
  iteration count). Granular sand via XPBI return-mapping. **Graph-coloring** to parallelize constraint
  batches on GPU without races.
- **Teaches:** elasticity, plasticity, deformation, granular flow, angle of repose.
- **Key params:** compliance/stiffness, iterations, friction, particle count, material type.
- **Reuse:** [webgpu-crowd-simulation (PBD)](https://github.com/wayne-wu/webgpu-crowd-simulation),
  [GPU_Soft_Body_Physics (XPBD tets)](https://github.com/WilKam01/GPU_Soft_Body_Physics),
  [XPBD overview](https://www.emergentmind.com/topics/extended-position-based-dynamics-xpbd).

## 11. Barnes-Hut N-body (stretch) — D5 / I3

- **Algorithm:** build an octree, approximate distant clusters by center-of-mass → O(N log N), enabling
  100k–1M+ gravitating bodies. GPU octree build + stack-based traversal is the hardest acceleration
  structure to implement well in WebGPU.
- **When:** only if all-pairs (#2) proves insufficient for desired galaxy scale.
- **Reuse:** [bneukom/gpu-nbody (OpenCL ref to port)](https://github.com/bneukom/gpu-nbody),
  [Barnes–Hut (Wikipedia)](https://en.wikipedia.org/wiki/Barnes%E2%80%93Hut_simulation).

---

## Brownian tracer (add-on to MD / elastic gas) — D1 / I3

- Tag one large particle among many small ones; trace its random-walk path and **plot mean-squared
  displacement vs. time** (linear → diffusion coefficient). A cheap, high-clarity diffusion demo.
  Reference: [Brownian motion](https://en.wikipedia.org/wiki/Brownian_motion).

---

## Shared infrastructure these modes depend on (build once)

- **Uniform spatial-hash grid** + **GPU sort** (bitonic or counting-sort + prefix-sum) — powers
  particle-life, boids, MD, SPH, electrostatics, scaled elastic gas.
- **Fixed-timestep accumulator** + substepping; **selectable integrators** (semi-implicit Euler default;
  velocity Verlet for MD/N-body/energy conservation).
- **Double-buffered (ping-pong) particle state** in storage buffers; WebGL2 texture-ping-pong fallback.
- See [tech-decisions.md](./tech-decisions.md) for the compute-backend rationale and references.

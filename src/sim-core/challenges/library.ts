/**
 * The guided lab challenge library.
 *
 * Each `Challenge` references a registered `SimMode` by id and walks the learner through a
 * predict-then-observe arc. Param-based checks use the *real* param keys from each mode's
 * `*Schema` export (verified in library.test.ts), and telemetry checks use the fields those
 * modes actually emit, so the runner can auto-grade against live simulation state.
 *
 * Pure data only — no React, no simulation. Adding a challenge is a data edit here.
 */
import { paramEquals, telemetryAtLeast, telemetryIncreasedFrom } from './checks'
import type { Challenge } from './types'

/**
 * Maxwell–Boltzmann convergence on the elastic gas. The learner runs the gas, watches the
 * speed histogram settle toward the analytic curve, then locks the temperature to hold the
 * distribution steady. Auto-graded on the gas being live (speeds present) and the lock set.
 */
const maxwellBoltzmann: Challenge = {
  id: 'mb-convergence',
  modeId: 'elastic-gas',
  title: 'Maxwell–Boltzmann convergence',
  summary:
    'Watch a gas of elastically colliding particles relax to the Maxwell–Boltzmann speed distribution, ' +
    'then hold it steady with the thermostat.',
  steps: [
    {
      id: 'run',
      prompt:
        'Press Play and let the gas run. Open the speed histogram. The particles start with similar speeds — ' +
        'predict what shape the distribution will take after many collisions.',
      hint: 'Elastic collisions redistribute kinetic energy; some particles end up fast, most stay near the middle.',
      // Once the gas is moving, the average speed is positive — confirms the sim is live before observing.
      check: telemetryAtLeast('averageSpeed', 0.01),
    },
    {
      id: 'observe',
      prompt:
        'Let it run until the histogram stops changing shape. It should match the smooth Maxwell–Boltzmann ' +
        'curve: a peak at the most-probable speed with a long high-speed tail.',
      hint: 'Convergence is statistical — more particles and more time give a cleaner match to the analytic curve.',
    },
    {
      id: 'hold',
      prompt:
        'Turn on "Hold Temperature" to pin the gas to its current temperature. The distribution should now ' +
        'hold its shape indefinitely instead of slowly drifting.',
      hint: 'The thermostat rescales velocities each step to keep the kinetic temperature constant.',
      check: paramEquals('holdTemperature', true),
    },
  ],
}

/**
 * Boyle's law on the Lennard-Jones gas: at fixed temperature, halving the volume roughly
 * doubles the pressure (P·V = const). The learner predicts, then shrinks the box and observes
 * pressure rise — auto-graded with a baseline-relative pressure-increase check.
 */
const boylesLaw: Challenge = {
  id: 'boyles-law',
  modeId: 'molecular-dynamics',
  title: "Boyle's law — halve the volume",
  summary:
    'At constant temperature, compressing a gas raises its pressure. Reduce the box size and confirm the ' +
    'pressure climbs as P·V stays roughly constant.',
  steps: [
    {
      id: 'baseline',
      prompt:
        'Turn on "Hold Temperature" so temperature stays fixed while you change the volume. Let the pressure ' +
        'reading settle — this is your baseline.',
      hint: 'Boyle\'s law (P·V = const) only holds at constant temperature, so lock it first.',
      check: paramEquals('holdTemperature', true),
    },
    {
      id: 'predict',
      prompt:
        'You are about to shrink the box (reduce "Box Size"), roughly halving the volume at fixed temperature. ' +
        'Predict: by how much should the pressure change?',
      hint: 'If P·V is constant, halving V should roughly double P.',
    },
    {
      id: 'compress',
      prompt:
        'Lower "Box Size" to shrink the container and watch the pressure readout. It should rise noticeably ' +
        'above your baseline as the atoms hit the walls more often.',
      hint: 'Smaller box ⇒ more frequent wall collisions ⇒ higher time-averaged wall pressure.',
      // Pressure should climb clearly above where it started; 1.3× is a robust "noticeably higher" threshold.
      check: telemetryIncreasedFrom('pressure', 1.3),
    },
  ],
}

/**
 * Equipartition / heating on the elastic gas: raising temperature raises kinetic energy.
 * The learner relates the temperature knob to the measured kinetic energy, graded on the
 * kinetic energy rising above its baseline after the gas warms.
 */
const heatTheGas: Challenge = {
  id: 'heat-the-gas',
  modeId: 'molecular-dynamics',
  title: 'Heat the gas — equipartition',
  summary:
    'Temperature is just average kinetic energy per particle. Raise the temperature and watch the total ' +
    'kinetic energy and average speed climb with it.',
  steps: [
    {
      id: 'observe-baseline',
      prompt:
        'Run the gas and note the kinetic-energy readout. This is your reference at the starting temperature.',
      hint: 'In reduced units, temperature T = m·⟨v²⟩ / 3 — directly tied to kinetic energy.',
    },
    {
      id: 'warm-up',
      prompt:
        'Raise the "Temperature" control. The average speed and total kinetic energy should both increase as ' +
        'the gas warms.',
      hint: 'Higher temperature ⇒ wider velocity distribution ⇒ more kinetic energy.',
      check: telemetryIncreasedFrom('kineticEnergy', 1.2),
    },
  ],
}

/**
 * Qualitative N-body challenge: gravity collapses a spinning disk into clustered, spiral-like
 * structure. Observation-only (no auto-grading) — the payoff is visual, not a single number.
 */
const formAGalaxy: Challenge = {
  id: 'form-a-galaxy',
  modeId: 'nbody',
  title: 'Form a galaxy',
  summary:
    'A spinning disk of self-gravitating bodies collapses and clumps into spiral-like structure. Explore how ' +
    'spin and gravity strength shape the outcome.',
  steps: [
    {
      id: 'collapse',
      prompt:
        'Run the simulation and watch the disk evolve. Gravity pulls bodies together while their spin resists ' +
        'collapse — note where clumps and arms form.',
      hint: 'It is a balance: too little spin and it collapses to a blob; too much and it flies apart.',
    },
    {
      id: 'tune-spin',
      prompt:
        'Restart with a higher "Initial Spin". Compare how the structure differs from your first run.',
      hint: 'More rotational support flattens the disk and can delay or prevent central collapse.',
    },
    {
      id: 'tune-gravity',
      prompt:
        'Now vary "Gravity Strength". Stronger gravity speeds up clustering; weaker gravity lets the disk ' +
        'spread out. Find a combination that gives the most galaxy-like structure.',
      hint: 'There is no single right answer — this is about building intuition for the spin/gravity balance.',
    },
  ],
}

/** Every challenge in the library, in suggested presentation order. */
export const allChallenges: Challenge[] = [maxwellBoltzmann, boylesLaw, heatTheGas, formAGalaxy]

/** The challenges that target a given `SimMode.id`, preserving library order. */
export function challengesFor(modeId: string): Challenge[] {
  return allChallenges.filter((challenge) => challenge.modeId === modeId)
}

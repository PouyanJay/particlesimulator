import { setup } from 'xstate'
import type { SnapshotFrom } from 'xstate'

/**
 * Session lifecycle as a small state machine. Two orthogonal concerns run in parallel:
 *   • playback — running ⇄ paused (mirrors the sim loop's play state)
 *   • task     — none → recording → none, or none → exporting → none
 * so a run can be recorded or exported while playing or paused without tangling the two.
 *
 * The machine is the coordination layer for the record/export UI (it forbids starting a
 * second export mid-export, and surfaces a single `phase` label). The sim loop itself reads
 * `paramStore.isPlaying`; that flag stays the playback authority and is synced into here.
 */
export type LifecycleEvent =
  | { type: 'LOADED' }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'START_EXPORT' }
  | { type: 'EXPORT_DONE' }

export const lifecycleMachine = setup({
  types: { events: {} as LifecycleEvent },
}).createMachine({
  id: 'lifecycle',
  initial: 'idle',
  states: {
    idle: { on: { LOADED: 'active' } },
    active: {
      type: 'parallel',
      states: {
        playback: {
          initial: 'running',
          states: {
            running: { on: { PAUSE: 'paused' } },
            paused: { on: { PLAY: 'running' } },
          },
        },
        task: {
          initial: 'none',
          states: {
            none: { on: { START_RECORDING: 'recording', START_EXPORT: 'exporting' } },
            recording: { on: { STOP_RECORDING: 'none' } },
            exporting: { on: { EXPORT_DONE: 'none' } },
          },
        },
      },
    },
  },
})

/** A single user-facing label collapsing the parallel regions, task taking precedence. */
export type LifecyclePhase = 'idle' | 'running' | 'paused' | 'recording' | 'exporting'

export function derivePhase(snapshot: SnapshotFrom<typeof lifecycleMachine>): LifecyclePhase {
  if (snapshot.matches('idle')) return 'idle'
  if (snapshot.matches({ active: { task: 'exporting' } })) return 'exporting'
  if (snapshot.matches({ active: { task: 'recording' } })) return 'recording'
  if (snapshot.matches({ active: { playback: 'paused' } })) return 'paused'
  return 'running'
}

import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { lifecycleMachine, derivePhase } from './lifecycleMachine'

function start() {
  const actor = createActor(lifecycleMachine).start()
  return actor
}

describe('lifecycle machine', () => {
  it('starts idle and becomes running once a scenario is loaded', () => {
    const actor = start()
    expect(derivePhase(actor.getSnapshot())).toBe('idle')
    actor.send({ type: 'LOADED' })
    expect(derivePhase(actor.getSnapshot())).toBe('running')
  })

  it('toggles between running and paused', () => {
    const actor = start()
    actor.send({ type: 'LOADED' })
    actor.send({ type: 'PAUSE' })
    expect(derivePhase(actor.getSnapshot())).toBe('paused')
    actor.send({ type: 'PLAY' })
    expect(derivePhase(actor.getSnapshot())).toBe('running')
  })

  it('records orthogonally to playback (task wins the phase label)', () => {
    const actor = start()
    actor.send({ type: 'LOADED' })
    actor.send({ type: 'PAUSE' }) // playback paused
    actor.send({ type: 'START_RECORDING' })
    expect(derivePhase(actor.getSnapshot())).toBe('recording')
    // playback state is preserved underneath
    expect(actor.getSnapshot().matches({ active: { playback: 'paused' } })).toBe(true)
    actor.send({ type: 'STOP_RECORDING' })
    expect(derivePhase(actor.getSnapshot())).toBe('paused')
  })

  it('enters and leaves the exporting phase', () => {
    const actor = start()
    actor.send({ type: 'LOADED' })
    actor.send({ type: 'START_EXPORT' })
    expect(derivePhase(actor.getSnapshot())).toBe('exporting')
    actor.send({ type: 'EXPORT_DONE' })
    expect(derivePhase(actor.getSnapshot())).toBe('running')
  })

  it('ignores a second export while one is in progress', () => {
    const actor = start()
    actor.send({ type: 'LOADED' })
    actor.send({ type: 'START_EXPORT' })
    actor.send({ type: 'START_EXPORT' }) // no-op: exporting has no START_EXPORT handler
    expect(derivePhase(actor.getSnapshot())).toBe('exporting')
    actor.send({ type: 'EXPORT_DONE' })
    expect(derivePhase(actor.getSnapshot())).toBe('running')
  })

  it('does nothing on playback/task events while still idle', () => {
    const actor = start()
    actor.send({ type: 'PAUSE' })
    actor.send({ type: 'START_RECORDING' })
    expect(derivePhase(actor.getSnapshot())).toBe('idle')
  })
})

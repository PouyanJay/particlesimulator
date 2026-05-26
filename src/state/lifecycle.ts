import { createActor } from 'xstate'
import { useSelector } from '@xstate/react'
import { lifecycleMachine, derivePhase, type LifecyclePhase } from './lifecycleMachine'
import { useParamStore } from './paramStore'

/**
 * The app's single lifecycle actor. Started at import (no external side effects); the bridge
 * to the param store's play flag is wired explicitly by `initLifecycleSync` so importing this
 * module in a test doesn't subscribe to the store behind the test's back.
 */
export const lifecycleActor = createActor(lifecycleMachine).start()

let syncWired = false

/**
 * Wire playback to the param store's `isPlaying` (the sim-loop authority) and mark the
 * session loaded. One-way: the store drives the machine, so play/pause has a single source
 * of truth. Idempotent — safe to call from a mount effect.
 */
export function initLifecycleSync(): () => void {
  lifecycleActor.send({ type: 'LOADED' })
  if (!useParamStore.getState().isPlaying) lifecycleActor.send({ type: 'PAUSE' })
  if (syncWired) return () => {}
  syncWired = true
  return useParamStore.subscribe((state, prev) => {
    if (state.isPlaying === prev.isPlaying) return
    lifecycleActor.send({ type: state.isPlaying ? 'PLAY' : 'PAUSE' })
  })
}

export const startRecording = (): void => lifecycleActor.send({ type: 'START_RECORDING' })
export const stopRecording = (): void => lifecycleActor.send({ type: 'STOP_RECORDING' })
export const beginExport = (): void => lifecycleActor.send({ type: 'START_EXPORT' })
export const endExport = (): void => lifecycleActor.send({ type: 'EXPORT_DONE' })

/** Subscribe a component to the single collapsed lifecycle phase label. */
export function useLifecyclePhase(): LifecyclePhase {
  return useSelector(lifecycleActor, derivePhase)
}

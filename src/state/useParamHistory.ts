import { useStore } from 'zustand'
import { useParamStore } from './paramStore'

export interface ParamHistory {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clear: () => void
}

/**
 * React access to the param store's undo/redo (zundo `temporal`). Selects primitives and the
 * stable action refs individually so the hook never returns a fresh object (no re-render loop).
 */
export function useParamHistory(): ParamHistory {
  const undo = useStore(useParamStore.temporal, (s) => s.undo)
  const redo = useStore(useParamStore.temporal, (s) => s.redo)
  const clear = useStore(useParamStore.temporal, (s) => s.clear)
  const canUndo = useStore(useParamStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useParamStore.temporal, (s) => s.futureStates.length > 0)
  return { undo, redo, clear, canUndo, canRedo }
}

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecordToggle } from './useRecordToggle'
import { useExportSettingsStore } from '../../state/exportSettingsStore'

// Controllable lifecycle phase + recording-controller spies, hoisted for the mock factories.
const h = vi.hoisted(() => ({
  phase: 'running' as string,
  begin: vi.fn(async () => {}),
  end: vi.fn(async () => {}),
}))
vi.mock('../../state/lifecycle', () => ({ useLifecyclePhase: () => h.phase }))
vi.mock('../../export/recordingController', () => ({ beginRecording: h.begin, endRecording: h.end }))

beforeEach(() => {
  h.phase = 'running'
  h.begin.mockClear().mockResolvedValue(undefined)
  h.end.mockClear().mockResolvedValue(undefined)
  useExportSettingsStore.setState({ recordFormat: 'webm' })
})

describe('useRecordToggle', () => {
  it('starts recording with the persisted format when idle', async () => {
    useExportSettingsStore.setState({ recordFormat: 'mp4' })
    const { result } = renderHook(() => useRecordToggle())
    expect(result.current.recording).toBe(false)
    await act(async () => result.current.toggle())
    expect(h.begin).toHaveBeenCalledWith('mp4')
    expect(h.end).not.toHaveBeenCalled()
  })

  it('stops recording when already recording', async () => {
    h.phase = 'recording'
    const { result } = renderHook(() => useRecordToggle())
    expect(result.current.recording).toBe(true)
    await act(async () => result.current.toggle())
    expect(h.end).toHaveBeenCalledTimes(1)
    expect(h.begin).not.toHaveBeenCalled()
  })

  it('surfaces a recording failure as an error message', async () => {
    h.begin.mockRejectedValueOnce(new Error('No canvas'))
    const { result } = renderHook(() => useRecordToggle())
    await act(async () => result.current.toggle())
    expect(result.current.error).toBe('No canvas')
  })
})

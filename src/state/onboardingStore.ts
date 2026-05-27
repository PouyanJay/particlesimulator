import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { clientStorage } from './clientStorage'

interface OnboardingState {
  /** Whether the first-visit welcome has been shown and dismissed. */
  seen: boolean
  markSeen: () => void
  /** Reset (so the welcome shows again) — used by tests and a "show again" affordance. */
  reset: () => void
}

/** Tracks whether the one-time onboarding welcome has been dismissed. Persisted to localStorage. */
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      seen: false,
      markSeen: () => set({ seen: true }),
      reset: () => set({ seen: false }),
    }),
    {
      name: 'particle-lab:onboarding',
      version: 1,
      storage: createJSONStorage(() => clientStorage),
    },
  ),
)

// Registers jest-dom matchers (toBeInTheDocument, toHaveFocus, ...) on Vitest's expect,
// and unmounts React trees between component tests. Unit tests run in the node
// environment (no document), so the RTL cleanup is guarded.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})

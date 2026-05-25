---
name: tdd
description: >
  Set up and drive test-driven development for the Particle Lab. Use when adding tests, starting a new
  feature/SimMode/component test-first, scaffolding the test toolchain (Vitest + React Testing Library +
  Playwright), or when the user asks to "write tests", "do TDD", or "set up testing". Ensures the
  red-green-refactor loop and the test pyramid from CLAUDE.md are followed.
when_to_use: >
  Adding or scaffolding tests, beginning any production change test-first, or configuring the test stack.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# TDD workflow for the Particle Lab

Operationalizes the **TDD methodology** section of `CLAUDE.md`. Read that section first — this skill is the
hands-on procedure for it. The rule is absolute: **a failing test comes before the implementation.**

## Step 0 — Check / scaffold the toolchain

Inspect the repo before assuming. Current state of tooling:

!`ls package.json vitest.config.* playwright.config.* 2>/dev/null; echo '---deps---'; node -e "const p=require('./package.json');const d={...p.dependencies,...p.devDependencies};console.log(['vitest','@testing-library/react','@testing-library/jest-dom','@testing-library/user-event','jsdom','@playwright/test','@vitest/coverage-v8'].map(k=>k+': '+(d[k]||'MISSING')).join('\n'))" 2>/dev/null || echo "could not read package.json"`

If the test stack is missing, scaffold it (confirm with the user before installing):

- **Unit + component:** `npm i -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`
- **E2E / visual:** `npm i -D @playwright/test` then `npx playwright install`
- Add `vitest.config.ts` (jsdom environment for component tests, `globals: true`, coverage via v8, setup file
  importing `@testing-library/jest-dom`), a `src/test/setup.ts`, and `playwright.config.ts` (baseURL to the
  Vite dev server, screenshot/visual settings).
- Add scripts: `"test": "vitest"`, `"test:run": "vitest run"`, `"test:coverage": "vitest run --coverage"`,
  `"test:e2e": "playwright test"`.

Keep config minimal and token/convention-aligned with the rest of the repo. Don't add tooling beyond this
without justification.

## Step 1 — Pick the right layer (test pyramid)

| What you're building | Test type | Tool | Where |
|---|---|---|---|
| `sim-core` math, integrators, kernels, stores, utils | **Unit** (most tests) | Vitest | `*.test.ts` beside source |
| UI component behavior, controls↔store, a11y | **Component** | Vitest + RTL | `*.test.tsx` beside source |
| Critical user flow / visual regression | **E2E / visual** | Playwright | `e2e/*.spec.ts` |

Most logic belongs in `sim-core` and is unit-tested there. GPU kernels: test the **CPU reference**
exhaustively, then assert the GPU path matches it on small N (float tolerance).

## Step 2 — Red. Write the failing test first

- Encode the **behavior or invariant**, not the implementation. For physics, assert laws with explicit
  tolerances (conservation, analytic convergence, integrator order, determinism) — see the `physics-verifier`
  agent. For UI, assert what the user observes (roles, labels, store effects), not internal state.
- Run it and confirm it **fails for the right reason** (`npm test`). A test that passes before you write code
  is testing nothing.

## Step 3 — Green. Minimal code to pass

Write the least code that makes the test pass. Resist gold-plating; more behavior ⇒ more tests first.

## Step 4 — Refactor under green

Clean up with the test as a safety net. Re-run `npm test` after each refactor. Use the built-in `simplify`
skill here if helpful.

## Step 5 — Verify the gate

Before considering the change done:

```! 
npm test -- --run && npm run lint && npm run build
```

Then route to the relevant reviewer agent (`physics-verifier`, `ui-reviewer`, `webgpu-shader-specialist`,
or `code-reviewer`) per the table in `CLAUDE.md`.

## Templates

**Physics invariant (Vitest):**
```ts
import { describe, it, expect } from 'vitest'
// import { stepElasticGas, totalMomentum, totalKE } from './elasticGas'

describe('elastic gas — conservation', () => {
  it('conserves total momentum and kinetic energy over 1000 steps', () => {
    // const s = init({ seed: 42, n: 200 })
    // const p0 = totalMomentum(s), e0 = totalKE(s)
    // for (let i = 0; i < 1000; i++) stepElasticGas(s, 1 / 90)
    // expect(totalMomentum(s)).toBeCloseTo(p0, 6)
    // expect(totalKE(s)).toBeCloseTo(e0, 4)
  })
})
```

**Determinism (Vitest):** same `(seed, params)` ⇒ identical trajectory.

**Component (RTL):**
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('temperature slider updates the param store and is keyboard-accessible', async () => {
  // render(<TemperatureControl />)
  // const slider = screen.getByRole('slider', { name: /temperature/i })
  // await userEvent.type(slider, '{ArrowRight}')
  // expect(useParamStore.getState().temperature).toBeGreaterThan(/* prev */ 0)
})
```

**E2E (Playwright):** pick mode → tune a param → run → copy share URL → reload restores identical scenario;
capture a visual snapshot of the main screen to guard the design system.

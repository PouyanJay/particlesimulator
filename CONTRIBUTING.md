# Contributing

Thanks for working on Particle Lab. The full engineering guide is [CLAUDE.md](./CLAUDE.md); this is the
short version.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

## The non-negotiables

1. **TDD.** Write a failing test first, make it pass, refactor under green. No production logic without a
   test that would fail without it. Tests live next to source as `*.test.ts(x)`.
2. **Keep the layers separate.** `sim-core` (pure TS) ⟂ `render` (R3F) ⟂ `state` (Zustand) ⟂ `ui`.
   `sim-core` imports neither React nor three.js. Business logic never lives in components.
3. **Physics is verified against ground truth** — conservation laws and analytic results, not snapshots.
4. **The UI uses design tokens only** — no magic numbers, no one-off colors; reuse the shared primitives
   in `src/ui/controls/`. Tokens live in `src/styles/tokens.css`.
5. **TypeScript strict** — no `any` (use `unknown` + narrowing), explicit return types on exported
   functions, no committed `console.log`.

## Before every commit

```bash
npm run lint        # eslint
npm run typecheck   # tsc -b
npm test            # vitest (unit + component)
npm run build       # tsc -b && vite build
```

All four must pass. The CI/Pages deploy builds on push to `main`.

## Workflow

- Branch off `main` (`feat/…`, `fix/…`), open a PR, and merge with a merge commit.
- Browser-verify anything touching UI, the WebGPU/render path, recording, the worker, or the PWA —
  these can't be tested headlessly. The unit suite covers `sim-core` and store logic.
- Adding a simulation mode? See [docs/adding-a-sim-mode.md](./docs/adding-a-sim-mode.md).
- Architecture overview: [docs/architecture.md](./docs/architecture.md).

## Handy URL flags (dev)

`?stats` (profiling overlay), `?forceWebGL` (force WebGL2), `?worker` (physics in a worker), `?embed`
(chrome-less view). Share links carry the scenario in the `#s=…` hash.

## Project layout

```
src/sim-core/   physics, modes, scenario model, challenges (pure, deterministic, well-tested)
src/render/     R3F canvas, sim driver, CPU/GPU particle renderers, post-FX, worker
src/state/      Zustand stores (+ zundo), XState lifecycle
src/ui/         panels, dialogs, command palette, charts, shared control primitives
src/export/     recording (MP4/WebM/GIF), screenshot, CSV/JSON serializers
```

# QA checklist (launch)

## Automated / code-verified ✅

- `npm run lint`, `npm run typecheck`, `npm test` (406 tests), `npm run build` all green.
- Determinism, conservation, and analytic convergence covered by `sim-core` invariant tests.
- Reduced motion: all transition durations zero out under `prefers-reduced-motion` (tokens), and the
  recording-dot pulse is disabled.
- Keyboard: command palette (⌘K, ↑/↓/Enter/Esc, focus contained), dialogs (focus trap, Esc, focus
  restore), Tabs and the 2D/3D radiogroup (arrow keys), undo/redo (⌘Z/⇧⌘Z), Space play/pause (deferring
  to focused text controls).
- Live regions: recording status, export errors, and import errors use `role="status"`/`role="alert"`.
- Production bundle: the dev profiling overlay (`r3f-perf`/`stats-gl`) is dead-code-eliminated — not
  emitted, not service-worker-precached.

## Manual matrix (needs real browsers/devices)

| Area | Chrome/Edge | Firefox | Safari (macOS/iOS) | Mobile |
|---|---|---|---|---|
| WebGPU render + all modes | | | | |
| WebGL2 fallback (`?forceWebGL`) | | | | |
| Recording MP4 / WebM / GIF | | | | |
| PNG screenshot | | | | |
| PWA install + offline | | | | |
| Touch orbit/pan/zoom | n/a | n/a | n/a | |
| Share link + `?embed` | | | | |

Notes:
- Recording/PNG use `captureStream` + `MediaRecorder` / `ImageCapture`; `ImageCapture` is Chromium-only,
  so PNG falls back (and may be blank) on Firefox/Safari — verify and, if needed, add an in-render-loop
  capture fallback.
- MP4 via `MediaRecorder` depends on browser codec support and falls back to WebM.
- Verify WebGPU and the PWA service worker both work under the GitHub Pages sub-path.
- Screen-reader smoke test (VoiceOver/NVDA) on the command palette, dialogs, and the mode selector.

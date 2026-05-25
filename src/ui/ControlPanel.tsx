import { useMemo } from 'react'
import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { RangeField } from './controls/RangeField'
import { ToggleField } from './controls/ToggleField'

/**
 * Schema-driven parameter panel. It renders a control per parameter declared by the
 * active mode's `paramSchema` — so a new mode gets a full control panel for free, with
 * no edits here (the plugin seam). Bound directly to the param store (no prop-drilling).
 */
export function ControlPanel() {
  const modeId = useParamStore((s) => s.modeId)
  const params = useParamStore((s) => s.params)
  const setParam = useParamStore((s) => s.setParam)

  // The schema is static per mode; only recompute when the mode changes.
  const schema = useMemo(() => simRegistry.create(modeId).paramSchema, [modeId])

  return (
    <section className="panel" aria-label="Parameters">
      <h2 className="panel__title">Parameters</h2>
      <div className="panel__group">
        {Object.entries(schema).map(([key, def]) =>
          def.type === 'number' ? (
            <RangeField
              key={key}
              label={def.label}
              value={Number(params[key])}
              min={def.min}
              max={def.max}
              step={def.step}
              unit={def.unit}
              onChange={(value) => setParam(key, value)}
            />
          ) : (
            <ToggleField
              key={key}
              label={def.label}
              checked={Boolean(params[key])}
              onChange={(checked) => setParam(key, checked)}
            />
          ),
        )}
      </div>
    </section>
  )
}

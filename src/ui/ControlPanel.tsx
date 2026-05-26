import { useMemo, type ReactNode } from 'react'
import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { beginParamHistoryGroup, endParamHistoryGroup } from '../state/paramHistoryGroup'
import type { ParamDef } from '../sim-core/types'
import { RangeField } from './controls/RangeField'
import { ToggleField } from './controls/ToggleField'

/**
 * Schema-driven parameter panel. Renders a control per parameter declared by the active
 * mode's `paramSchema`, split into two sections by each parameter's `group`: **Scene** (the
 * universal setup shared across modes — count, container size, display size) and **Dynamics**
 * (the mode's own physics). A new mode gets a full, grouped panel for free, with no edits here
 * (the plugin seam). Bound directly to the param store (no prop-drilling).
 */
export function ControlPanel() {
  const modeId = useParamStore((s) => s.modeId)
  const params = useParamStore((s) => s.params)
  const setParam = useParamStore((s) => s.setParam)

  // The schema is static per mode; only recompute when the mode changes.
  const schema = useMemo(() => simRegistry.create(modeId).paramSchema, [modeId])
  const entries = Object.entries(schema)
  const scene = entries.filter(([, def]) => def.group === 'scene')
  const dynamics = entries.filter(([, def]) => def.group !== 'scene')

  const renderField = ([key, def]: [string, ParamDef]) =>
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
        onCommitStart={beginParamHistoryGroup}
        onCommitEnd={endParamHistoryGroup}
      />
    ) : (
      <ToggleField
        key={key}
        label={def.label}
        checked={Boolean(params[key])}
        onChange={(checked) => setParam(key, checked)}
      />
    )

  return (
    <section className="panel" aria-label="Parameters">
      <h2 className="panel__title">Parameters</h2>
      {scene.length > 0 && <ControlGroup title="Scene">{scene.map(renderField)}</ControlGroup>}
      {dynamics.length > 0 && <ControlGroup title="Dynamics">{dynamics.map(renderField)}</ControlGroup>}
    </section>
  )
}

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="control-group">
      <h3 className="control-group__title">{title}</h3>
      <div className="panel__group">{children}</div>
    </div>
  )
}

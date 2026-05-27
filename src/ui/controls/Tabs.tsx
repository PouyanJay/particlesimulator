import { useId, type ReactNode } from 'react'
import { nextRovingIndex } from './roving'

export interface TabItem {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: TabItem[]
  /** Controlled active tab id. */
  value: string
  onChange: (id: string) => void
  /** Accessible name for the tablist. */
  ariaLabel: string
}

/**
 * ARIA tabs primitive: a `tablist` of `tab` buttons over `tabpanel`s, with Left/Right
 * (and Home/End) roving keyboard navigation. Controlled. Token-styled.
 */
export function Tabs({ tabs, value, onChange, ariaLabel }: TabsProps) {
  const baseId = useId()
  const tabId = (id: string) => `${baseId}-tab-${id}`
  const panelId = (id: string) => `${baseId}-panel-${id}`
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === value))

  function onKeyDown(e: React.KeyboardEvent): void {
    const next = nextRovingIndex(e.key, activeIndex, tabs.length, 'horizontal')
    if (next === null) return
    e.preventDefault()
    onChange(tabs[next].id)
  }

  const active = tabs[activeIndex]

  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.id === active.id
          return (
            <button
              key={tab.id}
              id={tabId(tab.id)}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              tabIndex={selected ? 0 : -1}
              className={`tabs__tab${selected ? ' is-active' : ''}`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div
        id={panelId(active.id)}
        role="tabpanel"
        aria-labelledby={tabId(active.id)}
        className="tabs__panel"
        tabIndex={0}
      >
        {active.content}
      </div>
    </div>
  )
}

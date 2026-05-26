import { describe, it, expect } from 'vitest'
import { filterCommands, type Command } from './commandModel'

const cmd = (id: string, title: string, extra: Partial<Command> = {}): Command => ({
  id,
  title,
  run: () => {},
  ...extra,
})

const commands: Command[] = [
  cmd('play', 'Play / Pause', { group: 'Playback', keywords: 'space resume stop' }),
  cmd('share', 'Copy share link', { group: 'Scenario' }),
  cmd('export-csv', 'Export telemetry as CSV', { group: 'Export' }),
]

describe('filterCommands', () => {
  it('returns everything for an empty query, in order', () => {
    expect(filterCommands(commands, '')).toEqual(commands)
    expect(filterCommands(commands, '   ')).toEqual(commands)
  })

  it('matches case-insensitively on the title', () => {
    expect(filterCommands(commands, 'csv').map((c) => c.id)).toEqual(['export-csv'])
  })

  it('matches on keywords and group, not just the title', () => {
    expect(filterCommands(commands, 'resume').map((c) => c.id)).toEqual(['play'])
    expect(filterCommands(commands, 'scenario').map((c) => c.id)).toEqual(['share'])
  })

  it('requires all whitespace-separated terms to match (AND)', () => {
    expect(filterCommands(commands, 'export csv').map((c) => c.id)).toEqual(['export-csv'])
    expect(filterCommands(commands, 'export missing')).toEqual([])
  })
})

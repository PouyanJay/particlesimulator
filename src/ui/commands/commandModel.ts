/** A single action invokable from the command palette. */
export interface Command {
  id: string
  title: string
  /** Optional grouping label shown as a section ("Playback", "Scenario", …). */
  group?: string
  /** Extra search terms not in the title (synonyms, shortcuts). */
  keywords?: string
  /** Greyed out and not runnable when true. */
  disabled?: boolean
  run: () => void
}

/**
 * Filter commands by a free-text query, case-insensitively, matching against title, group,
 * and keywords. An empty query returns everything (preserving order). Pure — unit tested.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase()
  if (q === '') return commands
  const terms = q.split(/\s+/)
  return commands.filter((c) => {
    const haystack = `${c.title} ${c.group ?? ''} ${c.keywords ?? ''}`.toLowerCase()
    return terms.every((t) => haystack.includes(t))
  })
}

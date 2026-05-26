import { useUiStore } from '../../state/uiStore'
import { CommandPalette } from './CommandPalette'
import { useCommands } from './useCommands'

/** Connects the command palette to the UI store's overlay state and the live command list. */
export function CommandPaletteHost() {
  const open = useUiStore((s) => s.overlay === 'palette')
  const close = useUiStore((s) => s.closeOverlay)
  const commands = useCommands()
  return <CommandPalette open={open} onClose={close} commands={commands} />
}

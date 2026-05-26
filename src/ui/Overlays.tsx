import { CommandPaletteHost } from './commands/CommandPaletteHost'
import { PresetManager } from './PresetManager'
import { ShareDialog } from './ShareDialog'
import { ExportDialog } from './ExportDialog'
import { ScenariosDialog } from './ScenariosDialog'
import { ChallengesDialog } from './ChallengesDialog'

/**
 * All app overlays (command palette + dialogs), mounted once at the root. Each reads the UI
 * store to decide whether it's open, so triggers anywhere (toolbar, shortcuts, commands) just
 * flip the active overlay.
 */
export function Overlays() {
  return (
    <>
      <CommandPaletteHost />
      <PresetManager />
      <ShareDialog />
      <ExportDialog />
      <ScenariosDialog />
      <ChallengesDialog />
    </>
  )
}

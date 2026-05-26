import { useEffect, useState } from 'react'
import { useUiStore } from '../state/uiStore'
import { currentScenario } from '../render/currentScenario'
import { buildShareUrl } from '../state/shareLink'
import { Dialog } from './controls/Dialog'
import { Button } from './controls/Button'

/** The current page URL with its hash stripped — the base for share/embed links. */
function pageBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  return window.location.href.split('#')[0]
}

/** Append the embed flag to a base URL (so the iframe target hides the app chrome). */
function withEmbedFlag(baseUrl: string): string {
  const [path, hash] = baseUrl.split('#')
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}embed${hash ? `#${hash}` : ''}`
}

/**
 * Share the current scenario as a URL (the whole setup lives in the hash — no server) and as
 * an `?embed` link for iframes. The link is rebuilt from the live scenario each time the
 * dialog opens, capturing the current camera.
 */
export function ShareDialog() {
  const open = useUiStore((s) => s.overlay === 'share')
  const close = useUiStore((s) => s.closeOverlay)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState<'share' | 'embed' | null>(null)

  useEffect(() => {
    if (!open) return
    setShareUrl(buildShareUrl(currentScenario(), pageBaseUrl()))
    setCopied(null)
  }, [open])

  const embedUrl = shareUrl ? withEmbedFlag(shareUrl) : ''

  async function copy(text: string, which: 'share' | 'embed'): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
    } catch {
      setCopied(null) // clipboard blocked (e.g. insecure context) — the field is still selectable
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Share scenario"
      description="The entire setup is encoded in the link — anyone who opens it sees exactly this."
    >
      <ShareField label="Share link" value={shareUrl} copied={copied === 'share'} onCopy={() => copy(shareUrl, 'share')} />
      <ShareField
        label="Embed link (hides the controls — for iframes)"
        value={embedUrl}
        copied={copied === 'embed'}
        onCopy={() => copy(embedUrl, 'embed')}
      />
    </Dialog>
  )
}

function ShareField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="share-field">
      <label className="share-field__label">{label}</label>
      <div className="share-field__row">
        <input
          className="share-field__input"
          type="text"
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button variant="primary" onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}

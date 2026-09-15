export function buildShareUrl(origin: string, slug: string): string {
  const trimmedOrigin = origin.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(trimmedOrigin)) throw new Error('A valid web origin is required.')
  return `${trimmedOrigin}/t/${encodeURIComponent(slug)}`
}

export function buildNimiqPayDeepLink(tabUrl: string): string {
  return `https://nimpay.app/miniapps/open/${encodeURIComponent(tabUrl)}`
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Copy is unavailable in this browser.')
}

export async function shareOrCopyTab(tabUrl: string, title = 'Tab'): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text: 'Shared costs, settled.', url: tabUrl })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  await copyTextToClipboard(tabUrl)
  return 'copied'
}

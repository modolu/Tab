import { describe, expect, it, vi } from 'vitest'
import { buildNimiqPayDeepLink, buildShareUrl, shareOrCopyTab } from '../../src/lib/share'

describe('sharing helpers', () => {
  it('builds a deterministic tab URL and normalizes the origin', () => {
    expect(buildShareUrl('https://tab.example///', 'abc-123')).toBe('https://tab.example/t/abc-123')
    expect(buildShareUrl('http://localhost:5173', 'slug with spaces')).toBe('http://localhost:5173/t/slug%20with%20spaces')
  })

  it('encodes the full web URL in the Nimiq Pay deeplink', () => {
    const url = 'https://tab.example/t/abc-123'
    expect(buildNimiqPayDeepLink(url)).toBe(`https://nimpay.app/miniapps/open/${encodeURIComponent(url)}`)
  })

  it('uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const previousShare = navigator.share
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    try {
      await expect(shareOrCopyTab('https://tab.example/t/dinner', 'Studio Dinner')).resolves.toBe('shared')
      expect(share).toHaveBeenCalledWith({ title: 'Studio Dinner', text: 'Shared costs, settled.', url: 'https://tab.example/t/dinner' })
    } finally {
      if (previousShare) Object.defineProperty(navigator, 'share', { configurable: true, value: previousShare })
      else delete (navigator as Navigator & { share?: Navigator['share'] }).share
    }
  })

  it('falls back to clipboard when the native share sheet is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const previousClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      await expect(shareOrCopyTab('https://tab.example/t/dinner')).resolves.toBe('copied')
      expect(writeText).toHaveBeenCalledWith('https://tab.example/t/dinner')
    } finally {
      if (previousClipboard) Object.defineProperty(navigator, 'clipboard', { configurable: true, value: previousClipboard })
      else delete (navigator as Navigator & { clipboard?: Navigator['clipboard'] }).clipboard
    }
  })
})

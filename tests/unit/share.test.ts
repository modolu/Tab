import { describe, expect, it, vi } from 'vitest'
import { buildNimiqPayCustomSchemeDeepLink, buildNimiqPayDeepLink, buildShareUrl, shareOrCopyTab } from '../../src/lib/share'

describe('sharing helpers', () => {
  it('builds a deterministic tab URL and normalizes the origin', () => {
    expect(buildShareUrl('https://tab.example///', 'abc-123')).toBe('https://tab.example/t/abc-123')
    expect(buildShareUrl('http://localhost:5173', 'slug with spaces')).toBe('http://localhost:5173/t/slug%20with%20spaces')
  })

  it('builds the documented HTTPS deeplink for a production root', () => {
    expect(buildNimiqPayDeepLink('https://tab-two-lime.vercel.app')).toBe('https://nimpay.app/miniapps/open/tab-two-lime.vercel.app')
  })

  it('preserves the production participant route without encoding it as one path segment', () => {
    const url = 'https://tab-two-lime.vercel.app/t/tab-2724f82f47f14f0b'
    const deeplink = buildNimiqPayDeepLink(url)
    expect(deeplink).toBe('https://nimpay.app/miniapps/open/tab-two-lime.vercel.app/t/tab-2724f82f47f14f0b')
    expect(deeplink).not.toContain('/open/%3A%2F%2F')
  })

  it('preserves query parameters and hashes', () => {
    expect(buildNimiqPayDeepLink('https://tab.example/t/dinner?invite=1&source=chat#share')).toBe('https://nimpay.app/miniapps/open/tab.example/t/dinner?invite=1&source=chat#share')
  })

  it('preserves a local development host and port', () => {
    expect(buildNimiqPayDeepLink('http://172.20.10.2:5174/t/local-tab')).toBe('https://nimpay.app/miniapps/open/172.20.10.2:5174/t/local-tab')
  })

  it('provides a safely encoded custom-scheme deeplink', () => {
    const url = 'https://tab.example/t/abc-123?source=share'
    expect(buildNimiqPayCustomSchemeDeepLink(url)).toBe(`nimiqpay://miniapp?url=${encodeURIComponent(url)}`)
  })

  it('rejects non-http(s) deeplink inputs', () => {
    expect(() => buildNimiqPayDeepLink('ftp://tab.example/t/abc-123')).toThrow(/http\(s\)/i)
    expect(() => buildNimiqPayCustomSchemeDeepLink('nimiqpay://miniapp?url=tab.example')).toThrow(/http\(s\)/i)
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

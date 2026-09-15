import { describe, expect, it } from 'vitest'
import { buildNimiqPayDeepLink, buildShareUrl } from '../../src/lib/share'

describe('sharing helpers', () => {
  it('builds a deterministic tab URL and normalizes the origin', () => {
    expect(buildShareUrl('https://tab.example///', 'abc-123')).toBe('https://tab.example/t/abc-123')
    expect(buildShareUrl('http://localhost:5173', 'slug with spaces')).toBe('http://localhost:5173/t/slug%20with%20spaces')
  })

  it('encodes the full web URL in the Nimiq Pay deeplink', () => {
    const url = 'https://tab.example/t/abc-123'
    expect(buildNimiqPayDeepLink(url)).toBe(`https://nimpay.app/miniapps/open/${encodeURIComponent(url)}`)
  })
})

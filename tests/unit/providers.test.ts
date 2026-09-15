import { describe, expect, it } from 'vitest'
import { missingConvexUrlMessage, requireConvexUrl } from '../../src/app/providers'

describe('Convex runtime configuration', () => {
  it('fails clearly when VITE_CONVEX_URL is missing instead of creating local persistence', () => {
    expect(() => requireConvexUrl(undefined)).toThrow(missingConvexUrlMessage)
    expect(() => requireConvexUrl('   ')).toThrow(/VITE_CONVEX_URL is missing/i)
  })

  it('accepts a configured Convex deployment URL', () => {
    expect(requireConvexUrl(' https://example.convex.cloud/ ')).toBe('https://example.convex.cloud/')
  })
})

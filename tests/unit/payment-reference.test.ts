import { describe, expect, it } from 'vitest'
import { createPaymentReference, deriveCompactReferenceId, getTabShortId } from '../../src/lib/ids'

describe('payment references', () => {
  it('is deterministic, compact, and ASCII-safe', () => {
    const reference = createPaymentReference(getTabShortId('tab-0123456789abcdef'), 's0')
    expect(reference).toBe('TAB:0123456789abcdef:s0')
    expect(createPaymentReference('0123456789abcdef', 's0')).toBe(reference)
    expect(new TextEncoder().encode(reference).byteLength).toBeLessThanOrEqual(64)
    expect(reference).toMatch(/^[\x00-\x7F]+$/)
    expect(reference).not.toContain('Dolu')
    expect(reference).not.toContain('secret')
  })

  it('creates unique references for different slots without exposing a long database id', () => {
    const first = createPaymentReference('0123456789abcdef', 's0')
    const second = createPaymentReference('0123456789abcdef', 's1')
    expect(first).not.toBe(second)
    expect(deriveCompactReferenceId('convex-slot-a')).not.toBe(deriveCompactReferenceId('convex-slot-b'))
    expect(deriveCompactReferenceId('convex-slot-a')).toHaveLength(14)
  })
})

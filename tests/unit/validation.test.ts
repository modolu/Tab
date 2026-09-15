import { describe, expect, it } from 'vitest'
import { validateTabDraft } from '../../src/lib/validation'
import { VALID_RECIPIENT } from '../fixtures/tab'
import type { TabDraft } from '../../src/lib/types'

const validDraft: TabDraft = {
  title: 'Studio dinner',
  token: 'NIM',
  amountMinor: '1000000',
  recipientAddress: VALID_RECIPIENT,
  allocationMode: 'equal',
  participants: [{ label: 'Dolu' }, { label: 'Tobi' }],
}

describe('Tab validation', () => {
  it('accepts a valid Tab draft', () => {
    expect(() => validateTabDraft(validDraft)).not.toThrow()
  })

  it.each([
    { title: 'blank title', change: { title: '' } },
    { title: 'whitespace title', change: { title: '   ' } },
    { title: 'zero total', change: { amountMinor: '0' } },
    { title: 'malformed total', change: { amountMinor: 'nope' } },
    { title: 'invalid recipient', change: { recipientAddress: 'NQ-not-an-address' } },
    { title: 'no participants', change: { participants: [] } },
    { title: 'blank participant label', change: { participants: [{ label: ' ' }] } },
  ])('rejects $title', ({ change }) => {
    expect(() => validateTabDraft({ ...validDraft, ...change })).toThrow()
  })

  it('rejects a custom allocation mismatch', () => {
    expect(() => validateTabDraft({
      ...validDraft,
      allocationMode: 'custom',
      participants: [{ label: 'Dolu', amountMinor: '400000' }, { label: 'Tobi', amountMinor: '500000' }],
    })).toThrow()
  })
})

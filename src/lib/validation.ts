import { ValidationUtils } from '@nimiq/utils/validation-utils'
import { allocateEqual, validateCustomAllocation } from './allocation'
import { parseLunaString } from './money'
import type { TabDraft } from './types'

export function validateRecipientAddress(value: string): string {
  const normalized = value.trim()
  if (!ValidationUtils.isValidAddress(normalized)) throw new Error('Enter a valid Nimiq recipient address.')
  return ValidationUtils.normalizeAddress(normalized)
}

export function validateTabDraft(draft: TabDraft): void {
  if (!draft.title.trim()) throw new Error('Add a purpose for this Tab.')
  const totalMinor = parseLunaString(draft.amountMinor)
  if (totalMinor <= 0n) throw new Error('The total must be greater than zero.')
  validateRecipientAddress(draft.recipientAddress)

  if (draft.token !== 'NIM') throw new Error('Only NIM Tabs are available in Phase 1.')
  if (!draft.participants.length) throw new Error('Add at least one participant.')
  if (draft.participants.some(({ label }) => !label.trim())) {
    throw new Error('Every participant needs a label.')
  }

  if (draft.allocationMode === 'equal') {
    const allocations = allocateEqual(totalMinor, draft.participants.length)
    if (allocations.reduce((sum, amount) => sum + amount, 0n) !== totalMinor) {
      throw new Error('Equal shares must equal the Tab total.')
    }
    return
  }

  const allocations = draft.participants.map(({ amountMinor }) => {
    if (amountMinor === undefined) throw new Error('Enter a share for every participant.')
    return parseLunaString(amountMinor)
  })
  validateCustomAllocation(totalMinor, allocations)
}

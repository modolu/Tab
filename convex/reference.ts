import { deriveCompactReferenceId, createPaymentReference } from '../src/lib/ids'

export function getPaymentReference(slug: string, slotId: string, shortId?: string): string {
  const tabShortId = slug.replace(/^tab-/, '')
  const slotShortId = shortId ?? deriveCompactReferenceId(slotId)
  return createPaymentReference(tabShortId, slotShortId)
}

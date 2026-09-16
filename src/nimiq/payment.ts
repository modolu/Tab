import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import { toSdkLuna } from '../lib/money'
import { createPaymentReference } from '../lib/ids'
import { NimiqAppError, mapNimiqError } from './errors'

export function normalizeNimiqAddress(address: string): string {
  return address.replace(/\s+/g, '').toUpperCase()
}

export function areNimiqAddressesEqual(left: string, right: string): boolean {
  return normalizeNimiqAddress(left) === normalizeNimiqAddress(right)
}

export async function sendNimPayment(
  provider: NimiqProvider,
  request: { recipient: string; amountMinor: string; paymentReference: string },
): Promise<string> {
  let value: number
  try { value = toSdkLuna(request.amountMinor) } catch (error) {
    throw new NimiqAppError('invalid-transaction', error instanceof Error ? error.message : 'The payment amount is invalid.', { cause: error })
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new NimiqAppError('invalid-transaction', 'The payment amount cannot be represented safely by Nimiq Pay.')
  }
  if (new TextEncoder().encode(request.paymentReference).byteLength > 64) {
    throw new NimiqAppError('invalid-transaction', 'The payment reference is too long for Nimiq.')
  }
  try {
    const txHash = await provider.sendBasicTransactionWithData({
      recipient: request.recipient,
      value,
      data: request.paymentReference,
    })
    if (typeof txHash !== 'string') throw mapNimiqError(txHash, 'Nimiq Pay could not submit this payment.')
    if (!txHash.trim()) throw new Error('The provider returned no transaction hash.')
    return txHash
  } catch (error) {
    throw mapNimiqError(error, 'Nimiq Pay could not submit this payment.')
  }
}

export function buildNimPaymentReference(tabShortId: string, slotShortId: string): string {
  return createPaymentReference(tabShortId, slotShortId)
}

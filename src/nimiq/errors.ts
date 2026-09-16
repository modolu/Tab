export type NimiqErrorCode =
  | 'provider-unavailable'
  | 'init-timeout'
  | 'permission-denied'
  | 'no-account'
  | 'consensus-unavailable'
  | 'insufficient-balance'
  | 'invalid-transaction'
  | 'network-unavailable'
  | 'unexpected'

export class NimiqAppError extends Error {
  readonly code: NimiqErrorCode

  constructor(code: NimiqErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'NimiqAppError'
    this.code = code
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const providerError = (error as { error?: unknown }).error
    if (typeof providerError === 'object' && providerError !== null) {
      const message = 'message' in providerError ? (providerError as { message?: unknown }).message : undefined
      const type = 'type' in providerError ? (providerError as { type?: unknown }).type : undefined
      return [type, message].filter((value): value is string => typeof value === 'string').join(' ')
    }
  }
  return String(error)
}

export function mapNimiqError(error: unknown, fallback = 'The Nimiq wallet is temporarily unavailable. Please try again.'): NimiqAppError {
  if (error instanceof NimiqAppError) return error
  const text = errorText(error).toLowerCase()
  if (text.includes('provider was not injected') || text.includes('not running inside') || text.includes('provider unavailable')) {
    return new NimiqAppError('provider-unavailable', 'Open this Tab inside Nimiq Pay to connect a Nimiq wallet.', { cause: error })
  }
  if (text.includes('timeout') || text.includes('timed out')) {
    return new NimiqAppError('init-timeout', 'Nimiq Pay did not respond in time. Reopen the Tab and try again.', { cause: error })
  }
  if (text.includes('permission') || text.includes('denied') || text.includes('reject') || text.includes('cancel')) {
    return new NimiqAppError('permission-denied', 'Wallet access was cancelled. You can try again when you are ready.', { cause: error })
  }
  if (text.includes('insufficient') || text.includes('not enough') || text.includes('underfunded') || (text.includes('balance') && text.includes('low'))) {
    return new NimiqAppError('insufficient-balance', 'Your Nimiq balance is too low for this payment.', { cause: error })
  }
  if (text.includes('invalidtransaction') || text.includes('invalid transaction') || text.includes('malformed')) {
    return new NimiqAppError('invalid-transaction', 'Nimiq Pay could not create this transaction. Check the amount and try again.', { cause: error })
  }
  if (text.includes('network') || text.includes('consensus') || text.includes('fetch') || text.includes('offline')) {
    return new NimiqAppError('network-unavailable', 'The Nimiq network is unavailable right now. Check your connection and retry.', { cause: error })
  }
  return new NimiqAppError('unexpected', fallback, { cause: error })
}

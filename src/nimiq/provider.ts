import { init, type NimiqProvider } from '@nimiq/mini-app-sdk'
import { NimiqAppError, mapNimiqError } from './errors'

const DEFAULT_INIT_TIMEOUT = 10_000
let providerPromise: Promise<NimiqProvider> | null = null

export async function getNimiqProvider(timeout = DEFAULT_INIT_TIMEOUT): Promise<NimiqProvider> {
  if (typeof window === 'undefined') {
    throw new NimiqAppError('provider-unavailable', 'Open this Tab inside Nimiq Pay to connect a Nimiq wallet.')
  }
  if (!providerPromise) {
    providerPromise = init({ timeout }).catch((error) => {
      providerPromise = null
      throw mapNimiqError(error)
    })
  }
  return providerPromise
}

export async function checkNimiqConsensus(provider: NimiqProvider): Promise<boolean> {
  try {
    if (!await provider.isConsensusEstablished()) return false
    const blockNumber = await provider.getBlockNumber()
    return Number.isSafeInteger(blockNumber) && blockNumber >= 0
  } catch (error) {
    throw mapNimiqError(error, 'Tab could not check Nimiq network readiness.')
  }
}

export function resetNimiqProviderForTests(): void {
  providerPromise = null
}

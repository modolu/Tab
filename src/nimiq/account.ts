import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import { NimiqAppError, mapNimiqError } from './errors'
import { checkNimiqConsensus, getNimiqProvider } from './provider'
import type { NimiqAccount } from './types'

export async function connectNimiqAccount(timeout = 10_000): Promise<NimiqAccount> {
  const provider = await getNimiqProvider(timeout)
  let accounts: string[]
  try {
    const result = await provider.listAccounts()
    if (!Array.isArray(result)) throw new Error('The Nimiq provider returned an invalid account response.')
    accounts = result
  } catch (error) {
    throw mapNimiqError(error, 'Nimiq Pay could not provide an account.')
  }
  const address = accounts[0]?.trim()
  if (!address) throw new NimiqAppError('no-account', 'No Nimiq account is available. Add an account in Nimiq Pay and try again.')
  if (!await checkNimiqConsensus(provider)) {
    throw new NimiqAppError('consensus-unavailable', 'Nimiq Pay is still syncing. Wait for network readiness and retry.')
  }
  return { address, provider }
}

export async function assertNimiqConsensus(provider: NimiqProvider): Promise<void> {
  if (!await checkNimiqConsensus(provider)) {
    throw new NimiqAppError('consensus-unavailable', 'Nimiq Pay is still syncing. Wait for network readiness and retry.')
  }
}

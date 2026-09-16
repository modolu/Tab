import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectNimiqAccount } from '../../src/nimiq/account'
import { NimiqAppError, mapNimiqError } from '../../src/nimiq/errors'
import { sendNimPayment } from '../../src/nimiq/payment'
import { getNimiqProvider, isNimiqPayAvailable, resetNimiqProviderForTests } from '../../src/nimiq/provider'
import { areNimiqAddressesEqual } from '../../src/nimiq/payment'

const address = 'NQ2111111111111111111111111111111111'

function fakeProvider(overrides: Partial<NimiqProvider> = {}): NimiqProvider {
  return {
    listAccounts: vi.fn().mockResolvedValue([address]),
    isConsensusEstablished: vi.fn().mockResolvedValue(true),
    getBlockNumber: vi.fn().mockResolvedValue(123),
    sendBasicTransactionWithData: vi.fn().mockResolvedValue('a'.repeat(64)),
    ...overrides,
  } as unknown as NimiqProvider
}

afterEach(() => {
  resetNimiqProviderForTests()
  vi.restoreAllMocks()
})

describe('Nimiq provider adapter', () => {
  it('initializes the injected provider only when requested', async () => {
    const provider = fakeProvider()
    window.nimiq = provider
    await expect(getNimiqProvider()).resolves.toBe(provider)
    expect(provider.listAccounts).not.toHaveBeenCalled()
  })

  it('requests accounts only through explicit connect and checks consensus', async () => {
    const provider = fakeProvider()
    window.nimiq = provider
    const account = await connectNimiqAccount()
    expect(account.address).toBe(address)
    expect(provider.listAccounts).toHaveBeenCalledTimes(1)
    expect(provider.isConsensusEstablished).toHaveBeenCalledTimes(1)
  })

  it('maps account rejection, no account, and consensus failure', async () => {
    window.nimiq = fakeProvider({ listAccounts: vi.fn().mockRejectedValue(new Error('PermissionDeniedError')) })
    await expect(connectNimiqAccount()).rejects.toMatchObject({ code: 'permission-denied' })
    resetNimiqProviderForTests()
    window.nimiq = fakeProvider({ listAccounts: vi.fn().mockResolvedValue([]) })
    await expect(connectNimiqAccount()).rejects.toMatchObject({ code: 'no-account' })
    resetNimiqProviderForTests()
    window.nimiq = fakeProvider({ isConsensusEstablished: vi.fn().mockResolvedValue(false) })
    await expect(connectNimiqAccount()).rejects.toMatchObject({ code: 'consensus-unavailable' })
  })

  it('maps missing provider injection to the outside-Nimiq-Pay state', async () => {
    delete window.nimiq
    await expect(getNimiqProvider(1)).rejects.toMatchObject({ code: 'provider-unavailable' })
  })

  it('keeps an actual provider timeout distinct', () => {
    expect(mapNimiqError(new Error('Request timed out')).code).toBe('init-timeout')
  })

  it('maps common provider failures without exposing raw error details', () => {
    expect(mapNimiqError(new Error('Network unavailable')).message).toBe('The Nimiq network is unavailable right now. Check your connection and retry.')
    expect(mapNimiqError(new Error('InvalidTransaction')).message).toBe('Nimiq Pay could not create this transaction. Check the amount and try again.')
    expect(mapNimiqError(new Error('PermissionDeniedError')).message).toBe('Wallet access was cancelled. You can try again when you are ready.')
    expect(mapNimiqError(new Error('Provider unavailable')).message).toBe('Open this Tab inside Nimiq Pay to connect a Nimiq wallet.')
  })

  it('detects the official Nimiq Pay host without initializing the wallet', () => {
    delete window.nimiqPay
    expect(isNimiqPayAvailable()).toBe(false)
    ;(window as Window & { nimiqPay?: unknown }).nimiqPay = {}
    expect(isNimiqPayAvailable()).toBe(true)
  })
})

describe('Nimiq payment adapter', () => {
  it('uses the exact safe Luna number and returns the transaction hash', async () => {
    const provider = fakeProvider()
    await expect(sendNimPayment(provider, { recipient: address, amountMinor: '1000000', paymentReference: 'TAB:abc:s0' })).resolves.toBe('a'.repeat(64))
    expect(provider.sendBasicTransactionWithData).toHaveBeenCalledWith({ recipient: address, value: 1_000_000, data: 'TAB:abc:s0' })
  })

  it('maps transaction rejection and refuses unsafe values', async () => {
    const rejected = fakeProvider({ sendBasicTransactionWithData: vi.fn().mockRejectedValue(new Error('PermissionDeniedError')) })
    await expect(sendNimPayment(rejected, { recipient: address, amountMinor: '1000000', paymentReference: 'TAB:abc:s0' })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(sendNimPayment(fakeProvider(), { recipient: address, amountMinor: '9007199254740992', paymentReference: 'TAB:abc:s0' })).rejects.toMatchObject({ code: 'invalid-transaction' })
    expect(new NimiqAppError('unexpected', 'x')).toBeInstanceOf(Error)
  })

  it('maps insufficient balance to safe payment copy and compares normalized addresses', async () => {
    const provider = fakeProvider({ sendBasicTransactionWithData: vi.fn().mockResolvedValue({ error: { type: 'InsufficientFunds', message: 'Insufficient balance' } }) })
    await expect(sendNimPayment(provider, { recipient: address, amountMinor: '1000000', paymentReference: 'TAB:abc:s0' })).rejects.toMatchObject({
      code: 'insufficient-balance',
      message: 'Your Nimiq balance is too low for this payment.',
    })
    expect(areNimiqAddressesEqual('NQ21 1111 1111', 'nq2111111111')).toBe(true)
    expect(areNimiqAddressesEqual('NQ21 1111 1111', 'NQ22 1111 1111')).toBe(false)
  })
})

import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectNimiqAccount } from '../../src/nimiq/account'
import { NimiqAppError } from '../../src/nimiq/errors'
import { sendNimPayment } from '../../src/nimiq/payment'
import { getNimiqProvider, resetNimiqProviderForTests } from '../../src/nimiq/provider'

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

  it('maps provider initialization timeout', async () => {
    delete window.nimiq
    await expect(getNimiqProvider(1)).rejects.toMatchObject({ code: 'init-timeout' })
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
})

import { describe, expect, it } from 'vitest'
import { evaluateNimiqTransaction } from '../../convex/verification'

const expected = {
  expectedNetwork: 'testnet' as const,
  expectedSender: 'NQ2111111111111111111111111111111111',
  expectedRecipient: 'NQ2111111111111111111111111111111111',
  expectedAmountMinor: '1000000',
  expectedReference: 'TAB:0123456789abcdef:s0',
  rpcNetworkId: 7,
  latestBlock: { number: 200, batch: 11, type: 'micro', network: 'TestAlbatross' },
  transactionBlock: { number: 100, batch: 10, type: 'micro', network: 'TestAlbatross' },
  transaction: { from: 'NQ2111111111111111111111111111111111', to: 'NQ2111111111111111111111111111111111', value: 1000000, recipientData: 'TAB:0123456789abcdef:s0', networkId: 7, executionResult: true, blockNumber: 100 },
}

describe('independent Nimiq transaction verification', () => {
  it('confirms a valid finalized transaction', () => expect(evaluateNimiqTransaction(expected)).toEqual({ kind: 'confirmed' }))
  it.each([
    ['recipient', { to: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000' }],
    ['amount', { value: 2_000_000 }],
    ['sender', { from: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000' }],
    ['reference', { recipientData: 'TAB:wrong:s0' }],
    ['network', { networkId: 8 }],
  ])('rejects a transaction with the wrong %s', (_name, change) => {
    const result = evaluateNimiqTransaction({ ...expected, transaction: { ...expected.transaction, ...change } })
    expect(result.kind).toBe('invalid')
  })
  it('keeps missing, mempool-like, and non-finalized transactions retryable', () => {
    expect(evaluateNimiqTransaction({ ...expected, transactionBlock: null }).kind).toBe('confirming')
    expect(evaluateNimiqTransaction({ ...expected, latestBlock: { ...expected.latestBlock, batch: 10 } }).kind).toBe('confirming')
  })
  it('does not confirm a failed execution', () => {
    expect(evaluateNimiqTransaction({ ...expected, transaction: { ...expected.transaction, executionResult: false } })).toMatchObject({ kind: 'invalid' })
  })
})

import { describe, expect, it } from 'vitest'
import { canShowPaymentAction } from '../../src/features/settlement/paymentState'
import {
  decodeRecipientDataHex,
  evaluateNimiqTransaction,
  evaluateMacroBlockFinality,
  evaluateRpcNetwork,
  evaluateTransactionLookup,
  isRetryableRpcStatus,
  normalizeRpcTransaction,
  normalizeRpcLatestBlock,
  normalizeMacroBlockAfter,
  parseRpcSuccess,
  RpcResponseInvalidError,
  type VerifiedRpcTransaction,
} from '../../convex/verification'
import { physicalNimiqTransactionResponse, physicalNimiqTransactionHash } from '../fixtures/nimiq-physical-transaction'

const expectedTransaction: VerifiedRpcTransaction = {
  hash: 'a'.repeat(64),
  senderAddress: 'NQ2111111111111111111111111111111111',
  senderType: 0,
  recipientAddress: 'NQ2111111111111111111111111111111111',
  recipientType: 0,
  valueMinor: '1000000',
  recipientDataHex: '5441423a303132333435363738396162636465663a7330',
  recipientData: 'TAB:0123456789abcdef:s0',
  blockNumber: 100,
  confirmations: 10,
  executionResult: true,
  networkId: 7,
}

const expected = {
  expectedNetwork: 'testnet' as const,
  expectedSender: 'NQ2111111111111111111111111111111111',
  expectedRecipient: 'NQ2111111111111111111111111111111111',
  expectedAmountMinor: '1000000',
  expectedReference: 'TAB:0123456789abcdef:s0',
  rpcNetworkId: 7,
  latestBlock: { number: 200, network: 'TestAlbatross' },
  macroBlockAfterTransaction: 150,
  transaction: expectedTransaction,
}

function captureError(action: () => unknown): unknown {
  try {
    action()
    return null
  } catch (error) {
    return error
  }
}

describe('raw Nimiq JSON-RPC compatibility', () => {
  it('unwraps the result.data JSON-RPC envelope and rejects a bare result object', () => {
    expect(parseRpcSuccess<typeof physicalNimiqTransactionResponse.result.data>(physicalNimiqTransactionResponse)).toEqual(physicalNimiqTransactionResponse.result.data)
    expect(() => parseRpcSuccess({ jsonrpc: '2.0', result: { network: 'TestAlbatross' }, id: 1 })).toThrow(RpcResponseInvalidError)
  })

  it('normalizes the physical transaction and decodes recipientData hex', () => {
    const raw = parseRpcSuccess<typeof physicalNimiqTransactionResponse.result.data>(physicalNimiqTransactionResponse)
    const normalized = normalizeRpcTransaction(raw)

    expect(normalized).toMatchObject({
      hash: physicalNimiqTransactionHash,
      senderAddress: 'NQ38 E8U7 XHBR 22E4 2NTT MABV GPX2 YDYS H41A',
      senderType: 2,
      recipientAddress: 'NQ76 BYR0 G05A A71R U337 EQ3X 4EVE 97J8 3Q11',
      recipientType: 0,
      valueMinor: '100000',
      recipientDataHex: '5441423a333330656336303366623531346535313a7330',
      recipientData: 'TAB:330ec603fb514e51:s0',
      blockNumber: 11512531,
      confirmations: 10865,
      networkId: 5,
      executionResult: true,
    })
  })

  it('rejects malformed hex and invalid UTF-8 recipient data', () => {
    expect(() => decodeRecipientDataHex('abc')).toThrow(RpcResponseInvalidError)
    expect(() => decodeRecipientDataHex('zz')).toThrow(RpcResponseInvalidError)
    expect(() => decodeRecipientDataHex('c328')).toThrow(RpcResponseInvalidError)
  })

  it('keeps macro-block and latest-block response shapes separate', () => {
    const macroResponse = { jsonrpc: '2.0', result: { data: 11512590, metadata: null }, id: 3 }
    const latestResponse = { jsonrpc: '2.0', result: { data: { number: 11528619, network: 'TestAlbatross' }, metadata: null }, id: 4 }
    expect(normalizeMacroBlockAfter(parseRpcSuccess(macroResponse))).toBe(11512590)
    expect(normalizeRpcLatestBlock(parseRpcSuccess(latestResponse))).toEqual({ number: 11528619, network: 'TestAlbatross' })
    const malformedMacroError = captureError(() => normalizeMacroBlockAfter(parseRpcSuccess({ ...macroResponse, result: { data: { number: 11512590 }, metadata: null } })))
    const malformedLatestError = captureError(() => normalizeRpcLatestBlock(parseRpcSuccess({ ...latestResponse, result: { data: { network: 'TestAlbatross' }, metadata: null } })))
    expect(malformedMacroError).toMatchObject({ code: 'rpc_response_invalid' })
    expect(malformedLatestError).toMatchObject({ code: 'rpc_response_invalid' })
  })
})

describe('independent Nimiq transaction verification', () => {
  it('accepts the real physical TestAlbatross transaction', () => {
    const transaction = normalizeRpcTransaction(parseRpcSuccess(physicalNimiqTransactionResponse))
    expect(evaluateNimiqTransaction({
      transaction,
      macroBlockAfterTransaction: 11512590,
      latestBlock: { number: 11528619, network: 'TestAlbatross' },
      rpcNetworkId: 5,
      expectedNetwork: 'testnet',
      expectedSender: 'NQ2111111111111111111111111111111111',
      expectedRecipient: 'NQ76 BYR0 G05A A71R U337 EQ3X 4EVE 97J8 3Q11',
      expectedAmountMinor: '100000',
      expectedReference: 'TAB:330ec603fb514e51:s0',
    })).toEqual({ kind: 'confirmed' })
  })

  it.each([
    ['testnet', 'TestAlbatross'],
    ['mainnet', 'MainAlbatross'],
  ] as const)('%s accepts its matching RPC network', (expectedNetwork, actualNetwork) => {
    expect(evaluateRpcNetwork({ expectedNetwork, actualNetwork })).toEqual({ kind: 'confirmed' })
  })

  it('fails fast on a testnet/mainnet RPC mismatch without calling it an invalid payment', () => {
    expect(evaluateRpcNetwork({ expectedNetwork: 'testnet', actualNetwork: 'MainAlbatross' })).toMatchObject({ kind: 'failed', code: 'rpc_network_mismatch' })
  })

  it.each([
    ['recipient', { recipientAddress: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000' }, 'transaction_invalid_recipient'],
    ['amount', { valueMinor: '2000000' }, 'transaction_invalid_amount'],
    ['reference', { recipientData: 'TAB:wrong:s0' }, 'transaction_invalid_reference'],
    ['execution', { executionResult: false }, 'transaction_execution_failed'],
  ] as const)('rejects a transaction with the wrong %s', (_name, change, code) => {
    const result = evaluateNimiqTransaction({ ...expected, transaction: { ...expectedTransaction, ...change } })
    expect(result).toMatchObject({ kind: 'invalid', code })
  })

  it('enforces the selected sender for basic transactions but accepts non-basic sender types', () => {
    expect(evaluateNimiqTransaction({
      ...expected,
      transaction: { ...expectedTransaction, senderAddress: 'NQ38 E8U7 XHBR 22E4 2NTT MABV GPX2 YDYS H41A', senderType: 0 },
    })).toMatchObject({ kind: 'invalid', code: 'transaction_invalid_sender' })

    expect(evaluateNimiqTransaction({
      ...expected,
      transaction: { ...expectedTransaction, senderAddress: 'NQ38 E8U7 XHBR 22E4 2NTT MABV GPX2 YDYS H41A', senderType: 2 },
    })).toEqual({ kind: 'confirmed' })
  })

  it('keeps transaction lookup and finality behavior retryable when not ready', () => {
    expect(evaluateTransactionLookup({ transactionFound: false, inMempool: false })).toMatchObject({ kind: 'confirming', code: 'rpc_transaction_not_found' })
    expect(evaluateTransactionLookup({ transactionFound: true, inMempool: true })).toMatchObject({ kind: 'confirming', code: 'transaction_in_mempool' })
    expect(evaluateNimiqTransaction({ ...expected, macroBlockAfterTransaction: null })).toMatchObject({ kind: 'confirming', code: 'transaction_not_finalized' })
    expect(evaluateNimiqTransaction({ ...expected, latestBlock: { ...expected.latestBlock, number: 149 } })).toMatchObject({ kind: 'confirming', code: 'transaction_not_finalized' })
  })

  it('uses the official macro-after height for finality', () => {
    expect(evaluateMacroBlockFinality({ latestBlockNumber: 11512589, macroBlockAfterTransaction: 11512590 })).toBe(false)
    expect(evaluateMacroBlockFinality({ latestBlockNumber: 11512590, macroBlockAfterTransaction: 11512590 })).toBe(true)
    expect(evaluateMacroBlockFinality({ latestBlockNumber: 11528619, macroBlockAfterTransaction: 11512590 })).toBe(true)
  })

  it('treats rate limits and temporary server failures as retryable RPC errors', () => {
    expect(isRetryableRpcStatus(429)).toBe(true)
    expect(isRetryableRpcStatus(503)).toBe(true)
    expect(isRetryableRpcStatus(400)).toBe(false)
  })

  it('does not show a normal Pay CTA for a failed verification with a submitted slot', () => {
    expect(canShowPaymentAction('pending', { status: 'failed' })).toBe(false)
    expect(canShowPaymentAction('unpaid', { status: 'failed' })).toBe(false)
    expect(canShowPaymentAction('unpaid', { status: 'invalid' })).toBe(true)
    expect(canShowPaymentAction('unpaid', undefined)).toBe(false)
    expect(canShowPaymentAction('unpaid', null)).toBe(true)
  })
})

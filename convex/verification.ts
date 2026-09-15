import { ValidationUtils } from '@nimiq/utils/validation-utils'
import { internal } from './_generated/api'
import { internalAction, internalMutation, query, type MutationCtx } from './_generated/server'
import { env } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { getPaymentReference } from './reference'
import { v } from 'convex/values'

const MAX_VERIFICATION_ATTEMPTS = 6
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 60_000]

type RpcRecord = Record<string, unknown>

export type RpcSuccess<T> = {
  jsonrpc: '2.0'
  result: { data: T; metadata: unknown }
  id: number | string
}

type RawRpcTransaction = {
  hash: unknown
  from: unknown
  fromType: unknown
  to: unknown
  toType: unknown
  value: unknown
  senderData: unknown
  recipientData: unknown
  networkId: unknown
  executionResult: unknown
  blockNumber: unknown
  confirmations: unknown
  relatedAddresses: unknown
}

export type VerifiedRpcTransaction = {
  hash: string
  senderAddress: string
  senderType: number
  recipientAddress: string
  recipientType: number
  valueMinor: string
  recipientDataHex: string
  recipientData: string
  blockNumber: number | null
  confirmations: number
  executionResult: boolean
  networkId: number
}

export type RpcLatestBlock = { number: number; network: string }

export type VerificationOutcome =
  | { kind: 'confirmed'; reason?: string; code?: string }
  | { kind: 'invalid'; reason: string; code?: string }
  | { kind: 'confirming'; reason: string; code?: string }
  | { kind: 'failed'; reason: string; code: string }

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string' || !ValidationUtils.isValidAddress(value)) return null
  return ValidationUtils.normalizeAddress(value)
}

function integerValue(value: unknown): bigint | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value)
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value)
  return null
}

function isRecord(value: unknown): value is RpcRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class RpcResponseInvalidError extends Error {
  readonly code = 'rpc_response_invalid' as const

  constructor(message: string) {
    super(message)
    this.name = 'RpcResponseInvalidError'
  }
}

class RpcServerError extends Error {}

type RpcTemporaryCode = 'rpc_unavailable' | 'rpc_rate_limited'

class RpcTemporaryError extends Error {
  readonly code: RpcTemporaryCode

  constructor(message: string, code: RpcTemporaryCode) {
    super(message)
    this.name = 'RpcTemporaryError'
    this.code = code
  }
}

class RpcNotFoundError extends Error {}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new RpcResponseInvalidError(`Nimiq RPC field ${field} is missing or invalid.`)
  return value
}

function requiredInteger(value: unknown, field: string): number {
  const integer = integerValue(value)
  if (integer === null || integer > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RpcResponseInvalidError(`Nimiq RPC field ${field} is missing or invalid.`)
  }
  return Number(integer)
}

function requiredBigInt(value: unknown, field: string): bigint {
  const integer = integerValue(value)
  if (integer === null) throw new RpcResponseInvalidError(`Nimiq RPC field ${field} is missing or invalid.`)
  return integer
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new RpcResponseInvalidError(`Nimiq RPC field ${field} is missing or invalid.`)
  return value
}

export function parseRpcSuccess<T>(body: unknown): T {
  if (!isRecord(body) || body.jsonrpc !== '2.0' || (typeof body.id !== 'number' && typeof body.id !== 'string')) {
    throw new RpcResponseInvalidError('Nimiq RPC returned an invalid JSON-RPC envelope.')
  }
  if (body.error !== undefined) {
    const error = isRecord(body.error) ? body.error.message : undefined
    throw new RpcServerError(typeof error === 'string' ? error : 'Nimiq RPC returned an error.')
  }
  if (!isRecord(body.result) || !('data' in body.result) || !('metadata' in body.result)) {
    throw new RpcResponseInvalidError('Nimiq RPC success responses must contain result.data and result.metadata.')
  }
  return body.result.data as T
}

export function decodeRecipientDataHex(value: unknown): string {
  const hex = requiredString(value, 'recipientData')
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new RpcResponseInvalidError('Nimiq transaction recipientData is not valid hex.')
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new RpcResponseInvalidError('Nimiq transaction recipientData is not valid UTF-8.')
  }
}

export function normalizeRpcTransaction(input: unknown, options: { allowPending?: boolean } = {}): VerifiedRpcTransaction {
  if (!isRecord(input)) throw new RpcResponseInvalidError('Nimiq RPC returned an invalid transaction object.')
  const allowPending = options.allowPending === true
  const rawBlockNumber = input.blockNumber
  const blockNumber = rawBlockNumber === null || rawBlockNumber === undefined
    ? null
    : requiredInteger(rawBlockNumber, 'blockNumber')
  if (blockNumber === null && !allowPending) throw new RpcResponseInvalidError('Nimiq RPC transaction is missing blockNumber.')
  const rawHash = input.hash
  const hash = rawHash === undefined || rawHash === null ? '' : requiredString(rawHash, 'hash')
  const rawConfirmations = input.confirmations
  const confirmations = rawConfirmations === undefined || rawConfirmations === null
    ? 0
    : requiredInteger(rawConfirmations, 'confirmations')
  return {
    hash,
    senderAddress: requiredString(input.from, 'from'),
    senderType: requiredInteger(input.fromType, 'fromType'),
    recipientAddress: requiredString(input.to, 'to'),
    recipientType: requiredInteger(input.toType, 'toType'),
    valueMinor: requiredBigInt(input.value, 'value').toString(),
    recipientDataHex: requiredString(input.recipientData, 'recipientData'),
    recipientData: decodeRecipientDataHex(input.recipientData),
    blockNumber,
    confirmations,
    executionResult: requiredBoolean(input.executionResult, 'executionResult'),
    networkId: requiredInteger(input.networkId, 'networkId'),
  }
}

export function normalizeRpcLatestBlock(input: unknown): RpcLatestBlock {
  if (!isRecord(input)) throw new RpcResponseInvalidError('Nimiq RPC returned an invalid latest block object.')
  return {
    number: requiredInteger(input.number, 'number'),
    network: requiredString(input.network, 'network'),
  }
}

export function normalizeMacroBlockAfter(input: unknown): number {
  return requiredInteger(input, 'macroBlockAfter')
}

export function expectedRpcNetwork(network: 'testnet' | 'mainnet'): 'TestAlbatross' | 'MainAlbatross' {
  return network === 'testnet' ? 'TestAlbatross' : 'MainAlbatross'
}

export function networkMatches(value: unknown, expected: 'testnet' | 'mainnet'): boolean {
  if (typeof value !== 'string') return false
  const normalized = value.toLowerCase().replace(/[^a-z]/g, '')
  return normalized === expectedRpcNetwork(expected).toLowerCase()
}

export function evaluateRpcNetwork(input: { actualNetwork: unknown; expectedNetwork: 'testnet' | 'mainnet' }): VerificationOutcome {
  if (networkMatches(input.actualNetwork, input.expectedNetwork)) return { kind: 'confirmed' }
  if (typeof input.actualNetwork === 'string' && input.actualNetwork.trim()) {
    return {
      kind: 'failed',
      code: 'rpc_network_mismatch',
      reason: `Nimiq RPC network mismatch: expected ${expectedRpcNetwork(input.expectedNetwork)}, received ${input.actualNetwork}.`,
    }
  }
  return {
    kind: 'failed',
    code: 'rpc_network_unidentified',
    reason: `Nimiq RPC did not identify the expected ${expectedRpcNetwork(input.expectedNetwork)} network.`,
  }
}

export function evaluateTransactionLookup(input: { transactionFound: boolean; inMempool: boolean }): VerificationOutcome | null {
  if (!input.transactionFound) return { kind: 'confirming', code: 'rpc_transaction_not_found', reason: 'Transaction submitted; waiting for it to appear onchain.' }
  if (input.inMempool) return { kind: 'confirming', code: 'transaction_in_mempool', reason: 'Transaction is in the Nimiq mempool; waiting for inclusion.' }
  return null
}

export function evaluateMacroBlockFinality(input: { latestBlockNumber: number; macroBlockAfterTransaction: number }): boolean {
  return input.latestBlockNumber >= input.macroBlockAfterTransaction
}

export function evaluateNimiqTransaction(input: {
  transaction: VerifiedRpcTransaction
  macroBlockAfterTransaction: number | null
  latestBlock: RpcLatestBlock | null
  rpcNetworkId: unknown
  expectedNetwork: 'testnet' | 'mainnet'
  expectedSender: string
  expectedRecipient: string
  expectedAmountMinor: string
  expectedReference: string
}): VerificationOutcome {
  const { transaction } = input
  if (!input.latestBlock || !networkMatches(input.latestBlock.network, input.expectedNetwork)) {
    return evaluateRpcNetwork({ actualNetwork: input.latestBlock?.network, expectedNetwork: input.expectedNetwork })
  }
  if (transaction.networkId !== input.rpcNetworkId) {
    return { kind: 'invalid', code: 'transaction_invalid_network', reason: 'The transaction belongs to a different Nimiq network.' }
  }
  if (normalizeAddress(transaction.recipientAddress) !== normalizeAddress(input.expectedRecipient)) {
    return { kind: 'invalid', code: 'transaction_invalid_recipient', reason: 'The recipient does not match this Tab.' }
  }
  if (transaction.senderType === 0 && normalizeAddress(transaction.senderAddress) !== normalizeAddress(input.expectedSender)) {
    return { kind: 'invalid', code: 'transaction_invalid_sender', reason: 'The basic transaction sender does not match the claimed wallet.' }
  }
  if (transaction.valueMinor !== BigInt(input.expectedAmountMinor).toString()) {
    return { kind: 'invalid', code: 'transaction_invalid_amount', reason: 'The transaction amount does not match this participant share.' }
  }
  if (transaction.recipientData !== input.expectedReference) {
    return { kind: 'invalid', code: 'transaction_invalid_reference', reason: 'The payment reference does not match this Tab slot.' }
  }
  if (transaction.executionResult !== true) {
    return { kind: 'invalid', code: 'transaction_execution_failed', reason: 'The transaction was not successfully executed onchain.' }
  }
  if (input.macroBlockAfterTransaction === null || !evaluateMacroBlockFinality({
    latestBlockNumber: input.latestBlock.number,
    macroBlockAfterTransaction: input.macroBlockAfterTransaction,
  })) {
    // Nimiq finality is reached once the latest block reaches the macro block after the transaction.
    return { kind: 'confirming', code: 'transaction_not_finalized', reason: 'Payment found onchain; waiting for Nimiq finality.' }
  }
  return { kind: 'confirmed' }
}

export function isRetryableRpcStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function configuredNetwork(): 'testnet' | 'mainnet' {
  const value = env.NIMIQ_NETWORK?.trim().toLowerCase()
  if (value === 'testnet' || value === 'mainnet') return value
  throw new Error('NIMIQ_NETWORK must be explicitly configured as testnet or mainnet.')
}

function rpcUrl(): string {
  const value = env.NIMIQ_RPC_URL?.trim()
  if (!value) throw new Error('NIMIQ_RPC_URL is not configured.')
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
  } catch {
    throw new Error('NIMIQ_RPC_URL must be an http(s) URL.')
  }
  return value
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (env.NIMIQ_RPC_USERNAME && env.NIMIQ_RPC_PASSWORD) {
    headers.Authorization = `Basic ${btoa(`${env.NIMIQ_RPC_USERNAME}:${env.NIMIQ_RPC_PASSWORD}`)}`
  }
  let response: Response
  try {
    response = await fetch(rpcUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() }),
    })
  } catch {
    throw new RpcTemporaryError('The Nimiq RPC endpoint could not be reached.', 'rpc_unavailable')
  }
  if (!response.ok) {
    if (response.status === 429) throw new RpcTemporaryError('Nimiq RPC rate limit reached.', 'rpc_rate_limited')
    throw new RpcTemporaryError(`Nimiq RPC returned HTTP ${response.status}.`, 'rpc_unavailable')
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new RpcResponseInvalidError('Nimiq RPC returned invalid JSON.')
  }
  try {
    return parseRpcSuccess<T>(body)
  } catch (error) {
    if (error instanceof RpcServerError) {
      if (/not found|unknown transaction|no such transaction/i.test(error.message)) throw new RpcNotFoundError(error.message)
      throw new RpcTemporaryError(error.message, 'rpc_unavailable')
    }
    throw error
  }
}

async function getMacroBlockAfter(blockNumber: number): Promise<number> {
  return normalizeMacroBlockAfter(await rpcCall<unknown>('getMacroBlockAfter', [blockNumber]))
}

async function getLatestBlock(): Promise<RpcLatestBlock> {
  return normalizeRpcLatestBlock(await rpcCall<unknown>('getLatestBlock', [false]))
}

async function findTransaction(hash: string): Promise<{ transaction: VerifiedRpcTransaction | null; inMempool: boolean }> {
  try {
    const raw = await rpcCall<RawRpcTransaction | null>('getTransactionByHash', [hash])
    return { transaction: raw ? normalizeRpcTransaction(raw) : null, inMempool: false }
  } catch (error) {
    if (!(error instanceof RpcNotFoundError)) throw error
    try {
      const raw = await rpcCall<RawRpcTransaction | null>('getTransactionFromMempool', [hash])
      return { transaction: raw ? normalizeRpcTransaction(raw, { allowPending: true }) : null, inMempool: true }
    } catch (mempoolError) {
      if (mempoolError instanceof RpcNotFoundError) return { transaction: null, inMempool: false }
      throw mempoolError
    }
  }
}

export const verifyNimiqTransaction = internalAction({
  args: { paymentId: v.id('payments'), scheduledAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claimed = await ctx.runMutation(internal.verification.claimVerificationAttempt, args)
    if (!claimed) return null
    const context = await ctx.runQuery(internal.payments.getVerificationContext, { paymentId: args.paymentId })
    if (!context || context.payment.status === 'confirmed' || context.payment.status === 'invalid') return null

    let outcome: VerificationOutcome
    try {
      const expectedNetwork = configuredNetwork()
      const latestBlock = await getLatestBlock()
      const networkOutcome = evaluateRpcNetwork({ actualNetwork: latestBlock.network, expectedNetwork })
      if (networkOutcome.kind === 'failed') {
        console.warn('Nimiq RPC network mismatch or unidentified network', {
          expected: expectedRpcNetwork(expectedNetwork),
          actual: typeof latestBlock.network === 'string' ? latestBlock.network : 'unknown',
        })
        outcome = networkOutcome
      } else {
        const found = await findTransaction(context.payment.txHash)
        const lookupOutcome = evaluateTransactionLookup({ transactionFound: Boolean(found.transaction), inMempool: found.inMempool })
        if (lookupOutcome) {
          outcome = lookupOutcome
        } else {
          const transaction = found.transaction
          if (!transaction) throw new RpcTemporaryError('Nimiq RPC returned no transaction.', 'rpc_unavailable')
          const [macroBlockAfterTransaction, rpcNetworkId] = await Promise.all([
            transaction.blockNumber === null ? Promise.resolve(null) : getMacroBlockAfter(transaction.blockNumber),
            rpcCall<unknown>('getNetworkId', []).then((value) => requiredInteger(value, 'networkId')),
          ])
          outcome = evaluateNimiqTransaction({
            transaction,
            macroBlockAfterTransaction,
            latestBlock,
            rpcNetworkId,
            expectedNetwork,
            expectedSender: context.payment.senderAddress,
            expectedRecipient: context.tab.recipientAddress,
            expectedAmountMinor: context.slot.amountMinor,
            expectedReference: getPaymentReference(context.tab.slug, context.slot._id, context.slot.shortId),
          })
        }
      }
    } catch (error) {
      if (error instanceof RpcResponseInvalidError) {
        outcome = { kind: 'failed', code: 'rpc_response_invalid', reason: error.message }
      } else if (error instanceof RpcTemporaryError) {
        outcome = { kind: 'confirming', code: error.code, reason: 'Nimiq verification is temporarily unavailable; retrying.' }
      } else if (error instanceof RpcNotFoundError) {
        outcome = { kind: 'confirming', code: 'rpc_transaction_not_found', reason: 'Transaction submitted; waiting for it to appear onchain.' }
      } else {
        const reason = error instanceof Error ? error.message : 'Verification configuration is invalid.'
        outcome = /NIMIQ_RPC_URL|NIMIQ_NETWORK|endpoint is not configured/i.test(reason)
          ? { kind: 'failed', code: 'verification_not_configured', reason: 'Onchain verification is not configured for this deployment.' }
          : { kind: 'invalid', code: 'verification_error', reason }
      }
    }

    const resultArgs = {
      paymentId: args.paymentId,
      kind: outcome.kind,
      reason: 'reason' in outcome && outcome.reason ? outcome.reason : 'Nimiq transaction verified and finalized.',
    } as const
    if (outcome.code) {
      await ctx.runMutation(internal.verification.applyVerificationResult, { ...resultArgs, code: outcome.code })
    } else {
      await ctx.runMutation(internal.verification.applyVerificationResult, resultArgs)
    }
    return null
  },
})

export const claimVerificationAttempt = internalMutation({
  args: { paymentId: v.id('payments'), scheduledAt: v.optional(v.number()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment || payment.status === 'confirmed' || payment.status === 'invalid') return false
    if (args.scheduledAt !== undefined && payment.verificationScheduledAt !== args.scheduledAt) return false
    if (args.scheduledAt === undefined && (payment.verificationScheduledAt ?? 0) > 0) return false
    await ctx.db.patch('payments', payment._id, { verificationScheduledAt: 0 })
    return true
  },
})

export const applyVerificationResult = internalMutation({
  args: {
    paymentId: v.id('payments'),
    kind: v.union(v.literal('confirmed'), v.literal('invalid'), v.literal('confirming'), v.literal('failed')),
    code: v.optional(v.string()),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment || payment.status === 'confirmed' || payment.status === 'invalid') return null
    const slot = await ctx.db.get(payment.participantSlotId)
    const tab = await ctx.db.get(payment.tabId)
    if (!slot || !tab) return null
    const attempts = (payment.verificationAttempts ?? 0) + 1
    await ctx.db.insert('paymentVerificationAttempts', { paymentId: payment._id, attemptedAt: Date.now(), result: args.kind, reason: args.reason })

    if (args.kind === 'confirmed') {
      const now = Date.now()
      await ctx.db.patch('payments', payment._id, { status: 'confirmed', verificationReason: args.reason, confirmedAt: now, verificationAttempts: attempts, verificationScheduledAt: 0 })
      await ctx.db.patch('participantSlots', slot._id, { status: 'paid', paymentId: payment._id, updatedAt: now })
      await recomputeTabStatusForTab(ctx, tab._id)
      return null
    }
    if (args.kind === 'invalid') {
      const codePatch = args.code ? { verificationCode: args.code } : {}
      await ctx.db.patch('payments', payment._id, { status: 'invalid', ...codePatch, verificationReason: args.reason, verificationAttempts: attempts, verificationScheduledAt: 0 })
      await ctx.db.patch('participantSlots', slot._id, { status: 'unpaid', updatedAt: Date.now() })
      return null
    }
    if (args.kind === 'failed') {
      await ctx.db.patch('payments', payment._id, { status: 'failed', verificationCode: args.code ?? 'verification_retry_required', verificationReason: args.reason, verificationAttempts: attempts, verificationScheduledAt: 0 })
      await ctx.db.patch('participantSlots', slot._id, { status: 'pending', updatedAt: Date.now() })
      return null
    }
    if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await ctx.db.patch('payments', payment._id, { status: 'failed', verificationCode: 'verification_retry_required', verificationReason: 'Payment submitted. Verification needs to be retried.', verificationAttempts: attempts, verificationScheduledAt: 0 })
      await ctx.db.patch('participantSlots', slot._id, { status: 'pending', updatedAt: Date.now() })
      return null
    }
    const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]
    const scheduledAt = Date.now() + delay + 1
    const codePatch = args.code ? { verificationCode: args.code } : {}
    await ctx.db.patch('payments', payment._id, { status: 'confirming', ...codePatch, verificationReason: args.reason, verificationAttempts: attempts, verificationScheduledAt: scheduledAt })
    await ctx.scheduler.runAfter(delay, internal.verification.verifyNimiqTransaction, { paymentId: payment._id, scheduledAt })
    return null
  },
})

export const recomputeTabStatus = internalMutation({
  args: { tabId: v.id('tabs') },
  returns: v.null(),
  handler: async (ctx, args) => { await recomputeTabStatusForTab(ctx, args.tabId); return null },
})

async function recomputeTabStatusForTab(ctx: MutationCtx, tabId: Id<'tabs'>): Promise<void> {
  const tab = await ctx.db.get('tabs', tabId)
  if (!tab || tab.status === 'cancelled' || tab.status === 'expired') return
  const slots = await ctx.db.query('participantSlots').withIndex('by_tab', (q) => q.eq('tabId', tabId)).take(100)
  if (slots.length > 0 && slots.every((slot) => slot.status === 'paid') && tab.status !== 'settled') {
    await ctx.db.patch('tabs', tabId, { status: 'settled' })
  }
}

export const getVerificationConfig = query({
  args: {},
  returns: v.object({ configured: v.boolean(), network: v.union(v.literal('testnet'), v.literal('mainnet')) }),
  handler: () => {
    const network = env.NIMIQ_NETWORK?.toLowerCase()
    return { configured: Boolean(env.NIMIQ_RPC_URL && (network === 'testnet' || network === 'mainnet')), network: network === 'mainnet' ? 'mainnet' as const : 'testnet' as const }
  },
})

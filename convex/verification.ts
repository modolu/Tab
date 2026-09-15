import { ValidationUtils } from '@nimiq/utils/validation-utils'
import { internal } from './_generated/api'
import { internalAction, internalMutation, query, type MutationCtx } from './_generated/server'
import { env } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { getPaymentReference } from './reference'
import { v } from 'convex/values'

const MAX_VERIFICATION_ATTEMPTS = 6
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 60_000]

type RpcTransaction = {
  from?: unknown
  to?: unknown
  value?: unknown
  recipientData?: unknown
  networkId?: unknown
  executionResult?: unknown
  blockNumber?: unknown
}

type RpcBlock = { number?: unknown; batch?: unknown; type?: unknown; network?: unknown }

export type VerificationOutcome =
  | { kind: 'confirmed' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'confirming'; reason: string }
  | { kind: 'failed'; reason: string }

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string' || !ValidationUtils.isValidAddress(value)) return null
  return ValidationUtils.normalizeAddress(value)
}

function integerValue(value: unknown): bigint | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value)
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value)
  return null
}

function networkMatches(value: unknown, expected: 'testnet' | 'mainnet'): boolean {
  if (typeof value !== 'string') return false
  const normalized = value.toLowerCase().replace(/[^a-z]/g, '')
  return expected === 'testnet'
    ? ['test', 'testnet', 'testalbatross'].includes(normalized)
    : ['main', 'mainnet', 'mainalbatross'].includes(normalized)
}

function hasReachedMacroFinality(transactionBlock: RpcBlock, latestBlock: RpcBlock): boolean {
  const transactionBatch = integerValue(transactionBlock.batch)
  const latestBatch = integerValue(latestBlock.batch)
  if (transactionBatch === null || latestBatch === null) return false
  // Nimiq PoS finality is established by the macro block closing the transaction's batch.
  return latestBatch > transactionBatch || (latestBatch === transactionBatch && latestBlock.type === 'macro')
}

export function evaluateNimiqTransaction(input: {
  transaction: RpcTransaction
  transactionBlock: RpcBlock | null
  latestBlock: RpcBlock | null
  rpcNetworkId: unknown
  expectedNetwork: 'testnet' | 'mainnet'
  expectedSender: string
  expectedRecipient: string
  expectedAmountMinor: string
  expectedReference: string
}): VerificationOutcome {
  const { transaction } = input
  if (!input.latestBlock || !networkMatches(input.latestBlock.network, input.expectedNetwork)) {
    return { kind: 'confirming', reason: 'The configured Nimiq endpoint is not ready on the expected network.' }
  }
  if (String(transaction.networkId) !== String(input.rpcNetworkId)) {
    return { kind: 'invalid', reason: 'The transaction belongs to a different Nimiq network.' }
  }
  if (normalizeAddress(transaction.to) !== normalizeAddress(input.expectedRecipient)) {
    return { kind: 'invalid', reason: 'The recipient does not match this Tab.' }
  }
  if (normalizeAddress(transaction.from) !== normalizeAddress(input.expectedSender)) {
    return { kind: 'invalid', reason: 'The sender does not match the claimed wallet.' }
  }
  if (integerValue(transaction.value) !== BigInt(input.expectedAmountMinor)) {
    return { kind: 'invalid', reason: 'The transaction amount does not match this participant share.' }
  }
  if (transaction.recipientData !== input.expectedReference) {
    return { kind: 'invalid', reason: 'The payment reference does not match this Tab slot.' }
  }
  if (transaction.executionResult !== true) {
    return { kind: 'invalid', reason: 'The transaction was not successfully executed onchain.' }
  }
  if (!input.transactionBlock || !hasReachedMacroFinality(input.transactionBlock, input.latestBlock)) {
    return { kind: 'confirming', reason: 'Payment found onchain; waiting for Nimiq finality.' }
  }
  return { kind: 'confirmed' }
}

class RpcNotFoundError extends Error {}
class RpcTemporaryError extends Error {}

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
    throw new RpcTemporaryError('The Nimiq RPC endpoint could not be reached.')
  }
  if (!response.ok) throw new RpcTemporaryError(`Nimiq RPC returned HTTP ${response.status}.`)
  let body: { result?: { data?: T } | T; error?: { message?: string } }
  try { body = await response.json() as typeof body } catch { throw new RpcTemporaryError('Nimiq RPC returned invalid JSON.') }
  if (body.error) {
    const message = body.error.message ?? 'Nimiq RPC returned an error.'
    if (/not found|unknown transaction|no such transaction/i.test(message)) throw new RpcNotFoundError(message)
    throw new RpcTemporaryError(message)
  }
  if (!('result' in body) || body.result === undefined) throw new RpcTemporaryError('Nimiq RPC returned no result.')
  const result = body.result
  if (typeof result === 'object' && result !== null && 'data' in result) return result.data as T
  return result as T
}

async function findTransaction(hash: string): Promise<{ transaction: RpcTransaction | null; inMempool: boolean }> {
  try {
    return { transaction: await rpcCall<RpcTransaction>('getTransactionByHash', [hash]), inMempool: false }
  } catch (error) {
    if (!(error instanceof RpcNotFoundError)) throw error
    try {
      return { transaction: await rpcCall<RpcTransaction>('getTransactionFromMempool', [hash]), inMempool: true }
    } catch (mempoolError) {
      if (mempoolError instanceof RpcNotFoundError) return { transaction: null, inMempool: false }
      throw mempoolError
    }
  }
}

export const verifyNimiqTransaction = internalAction({
  args: { paymentId: v.id('payments') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.payments.getVerificationContext, { paymentId: args.paymentId })
    if (!context || context.payment.status === 'confirmed' || context.payment.status === 'invalid' || context.payment.status === 'failed') return null

    let outcome: VerificationOutcome
    try {
      const found = await findTransaction(context.payment.txHash)
      if (!found.transaction) {
        outcome = { kind: 'confirming', reason: 'Transaction submitted; waiting for it to appear onchain.' }
      } else if (found.inMempool) {
        outcome = { kind: 'confirming', reason: 'Transaction is in the Nimiq mempool; waiting for inclusion.' }
      } else {
        const [latestBlock, transactionBlock, rpcNetworkId] = await Promise.all([
          rpcCall<RpcBlock>('getLatestBlock', [false]),
          integerValue(found.transaction.blockNumber) === null ? Promise.resolve(null) : rpcCall<RpcBlock>('getBlockByNumber', [found.transaction.blockNumber, false]),
          rpcCall<unknown>('getNetworkId', []),
        ])
        outcome = evaluateNimiqTransaction({
          transaction: found.transaction,
          transactionBlock,
          latestBlock,
          rpcNetworkId,
          expectedNetwork: configuredNetwork(),
          expectedSender: context.payment.senderAddress,
          expectedRecipient: context.tab.recipientAddress,
          expectedAmountMinor: context.slot.amountMinor,
          expectedReference: getPaymentReference(context.tab.slug, context.slot._id, context.slot.shortId),
        })
      }
    } catch (error) {
      if (!(error instanceof RpcTemporaryError) && !(error instanceof RpcNotFoundError)) {
        const reason = error instanceof Error ? error.message : 'Verification configuration is invalid.'
        outcome = /NIMIQ_RPC_URL|NIMIQ_NETWORK|endpoint is not configured/i.test(reason)
          ? { kind: 'failed', reason: 'Onchain verification is not configured for this deployment.' }
          : { kind: 'invalid', reason }
      } else {
        outcome = { kind: 'confirming', reason: 'Nimiq verification is temporarily unavailable; retrying.' }
      }
    }

    await ctx.runMutation(internal.verification.applyVerificationResult, {
      paymentId: args.paymentId,
      kind: outcome.kind,
      reason: 'reason' in outcome ? outcome.reason : 'Nimiq transaction verified and finalized.',
    })
    return null
  },
})

export const applyVerificationResult = internalMutation({
  args: {
    paymentId: v.id('payments'),
    kind: v.union(v.literal('confirmed'), v.literal('invalid'), v.literal('confirming'), v.literal('failed')),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment || payment.status === 'confirmed' || payment.status === 'invalid' || payment.status === 'failed') return null
    const slot = await ctx.db.get(payment.participantSlotId)
    const tab = await ctx.db.get(payment.tabId)
    if (!slot || !tab) return null
    const attempts = (payment.verificationAttempts ?? 0) + 1
    await ctx.db.insert('paymentVerificationAttempts', { paymentId: payment._id, attemptedAt: Date.now(), result: args.kind, reason: args.reason })

    if (args.kind === 'confirmed') {
      const now = Date.now()
      await ctx.db.patch('payments', payment._id, { status: 'confirmed', verificationReason: args.reason, confirmedAt: now, verificationAttempts: attempts })
      await ctx.db.patch('participantSlots', slot._id, { status: 'paid', paymentId: payment._id, updatedAt: now })
      await recomputeTabStatusForTab(ctx, tab._id)
      return null
    }
    if (args.kind === 'invalid') {
      await ctx.db.patch('payments', payment._id, { status: 'invalid', verificationReason: args.reason, verificationAttempts: attempts })
      await ctx.db.patch('participantSlots', slot._id, { status: 'unpaid', updatedAt: Date.now() })
      return null
    }
    if (args.kind === 'failed') {
      await ctx.db.patch('payments', payment._id, { status: 'failed', verificationReason: args.reason, verificationAttempts: attempts })
      await ctx.db.patch('participantSlots', slot._id, { status: 'unpaid', updatedAt: Date.now() })
      return null
    }
    if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await ctx.db.patch('payments', payment._id, { status: 'failed', verificationReason: 'Verification timed out before the transaction reached finality.', verificationAttempts: attempts })
      await ctx.db.patch('participantSlots', slot._id, { status: 'unpaid', updatedAt: Date.now() })
      return null
    }
    await ctx.db.patch('payments', payment._id, { status: 'confirming', verificationReason: args.reason, verificationAttempts: attempts })
    const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]
    await ctx.scheduler.runAfter(delay, internal.verification.verifyNimiqTransaction, { paymentId: payment._id })
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

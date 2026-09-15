import { ValidationUtils } from '@nimiq/utils/validation-utils'
import { internal } from './_generated/api'
import { action, internalAction, internalMutation, query, type MutationCtx } from './_generated/server'
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
  | { kind: 'confirmed'; reason?: string; code?: string; diagnostic?: string }
  | { kind: 'invalid'; reason: string; code?: string; diagnostic?: string }
  | { kind: 'confirming'; reason: string; code?: string; diagnostic?: string }
  | { kind: 'failed'; reason: string; code: string; diagnostic?: string }

type RpcDisposition = 'retryable' | 'failed'
export type RpcErrorClassification = {
  code: string
  disposition: RpcDisposition
  message: string
}

type RpcObservation = {
  paymentId: string
  method: string
  httpStatus: number | null
  rpcErrorCode: number | string | null
  rpcErrorMessage: string | null
  responseShape: string
  verificationCode: string
  durationMs: number
}

export type RpcDiagnosticStatus = {
  method: string
  httpStatus?: number
  rpcErrorCode?: number | string
  rpcErrorMessage?: string
  responseShape: string
  verificationCode: string
  durationMs: number
}

export type RpcCallContext = {
  paymentId: string
  observations?: RpcObservation[]
}

type RpcCaller = <T>(method: string, params: unknown[], context: RpcCallContext) => Promise<T>

type StoredPaymentDiagnosticContext = {
  payment: { txHash: string; senderAddress: string }
  tab: { slug: string; recipientAddress: string }
  slot: { _id: Id<'participantSlots'>; amountMinor: string; shortId?: string }
}

export type NimiqPaymentDiagnostic = {
  configuredNetwork: string
  observedNetwork: string | null
  transactionFound: boolean
  transactionBlock: number | null
  macroBlockAfter: number | null
  latestBlock: number | null
  finalized: boolean
  executionResult: boolean | null
  recipientMatches: boolean | null
  amountMatches: boolean | null
  referenceMatches: boolean | null
  senderType: number | null
  rpcStatuses: RpcDiagnosticStatus[]
}

const rpcDiagnosticStatus = v.object({
  method: v.string(),
  httpStatus: v.optional(v.number()),
  rpcErrorCode: v.optional(v.union(v.number(), v.string())),
  rpcErrorMessage: v.optional(v.string()),
  responseShape: v.string(),
  verificationCode: v.string(),
  durationMs: v.number(),
})

const diagnosticResult = v.object({
  configuredNetwork: v.string(),
  observedNetwork: v.union(v.string(), v.null()),
  transactionFound: v.boolean(),
  transactionBlock: v.union(v.number(), v.null()),
  macroBlockAfter: v.union(v.number(), v.null()),
  latestBlock: v.union(v.number(), v.null()),
  finalized: v.boolean(),
  executionResult: v.union(v.boolean(), v.null()),
  recipientMatches: v.union(v.boolean(), v.null()),
  amountMatches: v.union(v.boolean(), v.null()),
  referenceMatches: v.union(v.boolean(), v.null()),
  senderType: v.union(v.number(), v.null()),
  rpcStatuses: v.array(rpcDiagnosticStatus),
})

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
  readonly code: 'rpc_response_invalid' | 'rpc_json_invalid'
  readonly diagnosticMessage: string

  constructor(message: string, code: 'rpc_response_invalid' | 'rpc_json_invalid' = 'rpc_response_invalid') {
    super(message)
    this.name = 'RpcResponseInvalidError'
    this.code = code
    this.diagnosticMessage = message
  }
}

export class RpcServerError extends Error {
  readonly rpcCode: number | string | null
  readonly rpcMessage: string

  constructor(rpcCode: number | string | null, rpcMessage: string) {
    super(rpcMessage)
    this.name = 'RpcServerError'
    this.rpcCode = rpcCode
    this.rpcMessage = rpcMessage
  }
}

type RpcTemporaryCode = 'rpc_unavailable' | 'rpc_rate_limited' | 'rpc_network_error' | 'rpc_timeout'

class RpcTemporaryError extends Error {
  readonly code: RpcTemporaryCode
  readonly diagnosticMessage: string

  constructor(message: string, code: RpcTemporaryCode, diagnosticMessage = message) {
    super(message)
    this.name = 'RpcTemporaryError'
    this.code = code
    this.diagnosticMessage = diagnosticMessage
  }
}

class RpcPermanentError extends Error {
  readonly code: string
  readonly diagnosticMessage: string
  readonly rpcErrorCode: number | string | null

  constructor(message: string, code: string, diagnosticMessage = message, rpcErrorCode: number | string | null = null) {
    super(message)
    this.name = 'RpcPermanentError'
    this.code = code
    this.diagnosticMessage = diagnosticMessage
    this.rpcErrorCode = rpcErrorCode
  }
}

class RpcNotFoundError extends Error {
  readonly code = 'rpc_transaction_not_found' as const
  readonly diagnosticMessage: string

  constructor(message: string) {
    super(message)
    this.name = 'RpcNotFoundError'
    this.diagnosticMessage = message
  }
}

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

function sanitizeDiagnosticMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim().slice(0, 240)
}

function valueShape(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (isRecord(value)) {
    const keys = Object.keys(value).filter((key) => !key.toLowerCase().includes('data')).slice(0, 12)
    return keys.length > 0 ? `object{${keys.join(',')}}` : 'object'
  }
  return typeof value
}

function responseShapeSummary(body: unknown): string {
  if (!isRecord(body)) return valueShape(body)
  if ('error' in body) return `jsonrpc.error:${valueShape(body.error)}`
  if (!isRecord(body.result)) return `jsonrpc.result:${valueShape(body.result)}`
  if (!('data' in body.result)) return 'jsonrpc.result.object_without_data'
  return `jsonrpc.result.data:${valueShape(body.result.data)}`
}

export function classifyHttpStatus(status: number): RpcErrorClassification {
  if (status === 401) return { code: 'rpc_http_401', disposition: 'failed', message: `RPC returned HTTP 401.` }
  if (status === 403) return { code: 'rpc_http_403', disposition: 'failed', message: `RPC returned HTTP 403.` }
  if (status === 408) return { code: 'rpc_timeout', disposition: 'retryable', message: 'RPC request timed out (HTTP 408).' }
  if (status === 429) return { code: 'rpc_rate_limited', disposition: 'retryable', message: 'RPC rate limit reached (HTTP 429).' }
  if (status >= 500) return { code: 'rpc_unavailable', disposition: 'retryable', message: `RPC returned HTTP ${status}.` }
  return { code: `rpc_http_${status}`, disposition: 'failed', message: `RPC returned HTTP ${status}.` }
}

export function classifyFetchFailure(error: unknown): RpcErrorClassification {
  if (error instanceof Error && error.name === 'AbortError') {
    return { code: 'rpc_timeout', disposition: 'retryable', message: 'RPC request timed out.' }
  }
  return { code: 'rpc_network_error', disposition: 'retryable', message: 'RPC endpoint could not be reached.' }
}

function isTransactionLookupMethod(method: string): boolean {
  return method === 'getTransactionByHash' || method === 'getTransactionFromMempool'
}

function isNotFoundMessage(message: string): boolean {
  return /not found|unknown transaction|no such transaction/i.test(message)
}

function rpcErrorDetails(error: unknown): { code: string; rpcErrorCode: number | string | null; rpcErrorMessage: string | null; message: string } {
  if (error instanceof RpcServerError) {
    return { code: 'rpc_method_error', rpcErrorCode: error.rpcCode, rpcErrorMessage: sanitizeDiagnosticMessage(error.rpcMessage), message: sanitizeDiagnosticMessage(error.message) }
  }
  if (error instanceof RpcResponseInvalidError) {
    return { code: error.code, rpcErrorCode: null, rpcErrorMessage: null, message: error.diagnosticMessage }
  }
  if (error instanceof RpcTemporaryError || error instanceof RpcPermanentError || error instanceof RpcNotFoundError) {
    return {
      code: error.code,
      rpcErrorCode: error instanceof RpcPermanentError ? error.rpcErrorCode : null,
      rpcErrorMessage: null,
      message: error.diagnosticMessage,
    }
  }
  const message = error instanceof Error ? sanitizeDiagnosticMessage(error.message) : 'Unexpected RPC error.'
  return { code: 'rpc_response_invalid', rpcErrorCode: null, rpcErrorMessage: null, message }
}

function diagnosticObservation(observation: RpcObservation): RpcDiagnosticStatus {
  return {
    method: observation.method,
    ...(observation.httpStatus === null ? {} : { httpStatus: observation.httpStatus }),
    ...(observation.rpcErrorCode === null ? {} : { rpcErrorCode: observation.rpcErrorCode }),
    ...(observation.rpcErrorMessage === null ? {} : { rpcErrorMessage: observation.rpcErrorMessage }),
    responseShape: observation.responseShape,
    verificationCode: observation.verificationCode,
    durationMs: observation.durationMs,
  }
}

function logRpcObservation(observation: RpcObservation): void {
  console.info('[NIM verification RPC]', {
    paymentId: observation.paymentId,
    method: observation.method,
    httpStatus: observation.httpStatus,
    rpcErrorCode: observation.rpcErrorCode,
    rpcErrorMessage: observation.rpcErrorMessage,
    responseShape: observation.responseShape,
    verificationCode: observation.verificationCode,
    durationMs: observation.durationMs,
  })
}

export function parseRpcSuccess<T>(body: unknown): T {
  if (!isRecord(body) || body.jsonrpc !== '2.0' || (typeof body.id !== 'number' && typeof body.id !== 'string')) {
    throw new RpcResponseInvalidError('Nimiq RPC returned an invalid JSON-RPC envelope.')
  }
  if (body.error !== undefined) {
    const error = isRecord(body.error) ? body.error : null
    const message = error && typeof error.message === 'string' ? error.message : 'Nimiq RPC returned an error.'
    const code = error && (typeof error.code === 'number' || typeof error.code === 'string') ? error.code : null
    throw new RpcServerError(code, message)
  }
  if (!isRecord(body.result) || !('data' in body.result) || !('metadata' in body.result)) {
    throw new RpcResponseInvalidError('Nimiq RPC success responses must contain result.data and result.metadata.')
  }
  return body.result.data as T
}

export function parseRpcJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new RpcResponseInvalidError('Nimiq RPC returned invalid JSON.', 'rpc_json_invalid')
  }
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

export async function rpcCall<T>(method: string, params: unknown[], context: RpcCallContext): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (env.NIMIQ_RPC_USERNAME && env.NIMIQ_RPC_PASSWORD) {
    headers.Authorization = `Basic ${btoa(`${env.NIMIQ_RPC_USERNAME}:${env.NIMIQ_RPC_PASSWORD}`)}`
  }
  const startedAt = Date.now()
  let httpStatus: number | null = null
  let rpcErrorCode: number | string | null = null
  let rpcErrorMessage: string | null = null
  let responseShape = 'not_received'
  let caughtError: unknown = null
  const endpoint = rpcUrl()
  try {
    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() }),
      })
    } catch (error) {
      const classification = classifyFetchFailure(error)
      responseShape = 'network_error'
      throw new RpcTemporaryError(classification.message, classification.code as RpcTemporaryCode, `${method}: ${classification.message}`)
    }

    httpStatus = response.status
    if (!response.ok) {
      responseShape = 'http_error'
      const classification = classifyHttpStatus(response.status)
      if (classification.disposition === 'retryable') {
        throw new RpcTemporaryError(classification.message, classification.code as RpcTemporaryCode, `${method}: ${classification.message}`)
      }
      throw new RpcPermanentError(classification.message, classification.code, `${method}: ${classification.message}`)
    }

    let body: unknown
    try {
      body = parseRpcJson(await response.text())
    } catch (error) {
      responseShape = 'invalid_json'
      throw error
    }
    responseShape = responseShapeSummary(body)

    try {
      return parseRpcSuccess<T>(body)
    } catch (error) {
      if (error instanceof RpcServerError) {
        rpcErrorCode = error.rpcCode
        rpcErrorMessage = sanitizeDiagnosticMessage(error.rpcMessage)
        if (isTransactionLookupMethod(method) && isNotFoundMessage(error.rpcMessage)) {
          throw new RpcNotFoundError(`${method} JSON-RPC error${error.rpcCode === null ? '' : ` ${error.rpcCode}`}: ${rpcErrorMessage}`)
        }
        throw new RpcPermanentError(
          `${method} JSON-RPC error${error.rpcCode === null ? '' : ` ${error.rpcCode}`}: ${rpcErrorMessage}`,
          'rpc_method_error',
          `${method} JSON-RPC error${error.rpcCode === null ? '' : ` ${error.rpcCode}`}: ${rpcErrorMessage}`,
          error.rpcCode,
        )
      }
      throw error
    }
  } catch (error) {
    caughtError = error
    throw error
  } finally {
    const details = caughtError === null ? { code: 'rpc_ok', rpcErrorCode, rpcErrorMessage, message: '' } : rpcErrorDetails(caughtError)
    const observation: RpcObservation = {
      paymentId: context.paymentId,
      method,
      httpStatus,
      rpcErrorCode: rpcErrorCode ?? details.rpcErrorCode,
      rpcErrorMessage: rpcErrorMessage ?? details.rpcErrorMessage,
      responseShape,
      verificationCode: details.code,
      durationMs: Math.max(0, Date.now() - startedAt),
    }
    context.observations?.push(observation)
    logRpcObservation(observation)
  }
}

async function getMacroBlockAfter(blockNumber: number, context: RpcCallContext, call: RpcCaller = rpcCall): Promise<number> {
  return normalizeMacroBlockAfter(await call<unknown>('getMacroBlockAfter', [blockNumber], context))
}

async function getLatestBlock(context: RpcCallContext, call: RpcCaller = rpcCall): Promise<RpcLatestBlock> {
  return normalizeRpcLatestBlock(await call<unknown>('getLatestBlock', [false], context))
}

async function findTransaction(hash: string, context: RpcCallContext): Promise<{ transaction: VerifiedRpcTransaction | null; inMempool: boolean }> {
  try {
    const raw = await rpcCall<RawRpcTransaction | null>('getTransactionByHash', [hash], context)
    return { transaction: raw ? normalizeRpcTransaction(raw) : null, inMempool: false }
  } catch (error) {
    if (!(error instanceof RpcNotFoundError)) throw error
    try {
      const raw = await rpcCall<RawRpcTransaction | null>('getTransactionFromMempool', [hash], context)
      return { transaction: raw ? normalizeRpcTransaction(raw, { allowPending: true }) : null, inMempool: true }
    } catch (mempoolError) {
      if (mempoolError instanceof RpcNotFoundError) return { transaction: null, inMempool: false }
      throw mempoolError
    }
  }
}

export async function collectNimiqPaymentDiagnostics(
  context: StoredPaymentDiagnosticContext,
  call: RpcCaller,
  rpcContext: RpcCallContext,
): Promise<NimiqPaymentDiagnostic> {
  const configured = env.NIMIQ_NETWORK?.trim().toLowerCase() ?? 'unconfigured'
  const expectedNetwork = configured === 'testnet' || configured === 'mainnet' ? configured : null
  const expectedReference = expectedNetwork
    ? getPaymentReference(context.tab.slug, context.slot._id, context.slot.shortId)
    : null
  const read = async <T>(operation: () => Promise<T>): Promise<{ value: T | null; error: unknown | null }> => {
    try {
      return { value: await operation(), error: null }
    } catch (error) {
      return { value: null, error }
    }
  }

  const network = await read(() => getLatestBlock(rpcContext, call))
  const transactionResult = await read(() => call<RawRpcTransaction | null>('getTransactionByHash', [context.payment.txHash], rpcContext))
  let transaction: VerifiedRpcTransaction | null = null
  if (transactionResult.value) {
    try {
      transaction = normalizeRpcTransaction(transactionResult.value)
    } catch {
      // The RPC observation retains the response shape; diagnostics never return a raw payload.
    }
  }

  const macro = transaction?.blockNumber === null || transaction?.blockNumber === undefined
    ? { value: null, error: null }
    : await read(() => getMacroBlockAfter(transaction.blockNumber as number, rpcContext, call))
  const finalNetwork = await read(() => getLatestBlock(rpcContext, call))
  const observedNetwork = network.value?.network ?? finalNetwork.value?.network ?? null
  const latestBlock = finalNetwork.value?.number ?? null
  const macroBlockAfter = macro.value

  return {
    configuredNetwork: configured,
    observedNetwork,
    transactionFound: transactionResult.value !== null && transactionResult.value !== undefined,
    transactionBlock: transaction?.blockNumber ?? null,
    macroBlockAfter,
    latestBlock,
    finalized: macroBlockAfter !== null && latestBlock !== null && evaluateMacroBlockFinality({ latestBlockNumber: latestBlock, macroBlockAfterTransaction: macroBlockAfter }),
    executionResult: transaction?.executionResult ?? null,
    recipientMatches: transaction && normalizeAddress(context.tab.recipientAddress) !== null
      ? normalizeAddress(transaction.recipientAddress) === normalizeAddress(context.tab.recipientAddress)
      : null,
    amountMatches: transaction ? transaction.valueMinor === context.slot.amountMinor : null,
    referenceMatches: transaction && expectedReference ? transaction.recipientData === expectedReference : null,
    senderType: transaction?.senderType ?? null,
    rpcStatuses: rpcContext.observations?.map(diagnosticObservation) ?? [],
  }
}

export const devDiagnoseNimiqPayment = action({
  args: { paymentId: v.id('payments') },
  returns: diagnosticResult,
  handler: async (ctx, args): Promise<NimiqPaymentDiagnostic> => {
    if (env.NIMIQ_ENABLE_DEV_DIAGNOSTICS?.trim().toLowerCase() !== 'true') {
      throw new Error('Development Nimiq diagnostics are disabled.')
    }
    const stored = await ctx.runQuery(internal.payments.getVerificationContext, { paymentId: args.paymentId })
    if (!stored) throw new Error('Payment not found.')
    const rpcContext: RpcCallContext = { paymentId: String(args.paymentId), observations: [] }
    return collectNimiqPaymentDiagnostics(stored, rpcCall, rpcContext)
  },
})

export const verifyNimiqTransaction = internalAction({
  args: { paymentId: v.id('payments'), scheduledAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claimed = await ctx.runMutation(internal.verification.claimVerificationAttempt, args)
    if (!claimed) return null
    const context = await ctx.runQuery(internal.payments.getVerificationContext, { paymentId: args.paymentId })
    if (!context || context.payment.status === 'confirmed' || context.payment.status === 'invalid') return null

    const rpcContext: RpcCallContext = { paymentId: String(args.paymentId), observations: [] }
    let outcome: VerificationOutcome
    try {
      const expectedNetwork = configuredNetwork()
      const networkBlock = await getLatestBlock(rpcContext)
      const networkOutcome = evaluateRpcNetwork({ actualNetwork: networkBlock.network, expectedNetwork })
      if (networkOutcome.kind === 'failed') {
        console.warn('Nimiq RPC network mismatch or unidentified network', {
          expected: expectedRpcNetwork(expectedNetwork),
          actual: typeof networkBlock.network === 'string' ? networkBlock.network : 'unknown',
        })
        outcome = networkOutcome
      } else {
        const found = await findTransaction(context.payment.txHash, rpcContext)
        const lookupOutcome = evaluateTransactionLookup({ transactionFound: Boolean(found.transaction), inMempool: found.inMempool })
        if (lookupOutcome) {
          outcome = lookupOutcome
        } else {
          const transaction = found.transaction
          if (!transaction) throw new RpcTemporaryError('Nimiq RPC returned no transaction.', 'rpc_unavailable')
          const [macroBlockAfterTransaction, rpcNetworkId] = await Promise.all([
            transaction.blockNumber === null ? Promise.resolve(null) : getMacroBlockAfter(transaction.blockNumber, rpcContext),
            rpcCall<unknown>('getNetworkId', [], rpcContext).then((value) => requiredInteger(value, 'networkId')),
          ])
          const finalLatestBlock = await getLatestBlock(rpcContext)
          outcome = evaluateNimiqTransaction({
            transaction,
            macroBlockAfterTransaction,
            latestBlock: finalLatestBlock,
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
        outcome = {
          kind: 'failed',
          code: error.code,
          reason: 'Nimiq verification returned an invalid response. Retry verification.',
          diagnostic: error.diagnosticMessage,
        }
      } else if (error instanceof RpcTemporaryError) {
        outcome = {
          kind: 'confirming',
          code: error.code,
          reason: 'Nimiq verification is temporarily unavailable; retrying.',
          diagnostic: error.diagnosticMessage,
        }
      } else if (error instanceof RpcNotFoundError) {
        outcome = {
          kind: 'confirming',
          code: error.code,
          reason: 'Transaction submitted; waiting for it to appear onchain.',
          diagnostic: error.diagnosticMessage,
        }
      } else if (error instanceof RpcPermanentError) {
        outcome = {
          kind: 'failed',
          code: error.code,
          reason: 'Nimiq verification failed. Retry verification.',
          diagnostic: error.diagnosticMessage,
        }
      } else {
        const diagnostic = error instanceof Error ? sanitizeDiagnosticMessage(error.message) : 'Unexpected verification error.'
        outcome = /NIMIQ_RPC_URL|NIMIQ_NETWORK|endpoint is not configured/i.test(diagnostic)
          ? { kind: 'failed', code: 'verification_not_configured', reason: 'Onchain verification is not configured for this deployment.' }
          : { kind: 'failed', code: 'rpc_response_invalid', reason: 'Nimiq verification failed. Retry verification.', diagnostic }
      }
    }

    const resultArgs = {
      paymentId: args.paymentId,
      kind: outcome.kind,
      reason: 'reason' in outcome && outcome.reason ? outcome.reason : 'Nimiq transaction verified and finalized.',
    } as const
    await ctx.runMutation(internal.verification.applyVerificationResult, {
      ...resultArgs,
      ...(outcome.code ? { code: outcome.code } : {}),
      ...(outcome.diagnostic ? { diagnostic: outcome.diagnostic } : {}),
    })
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
    diagnostic: v.optional(v.string()),
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
    await ctx.db.insert('paymentVerificationAttempts', {
      paymentId: payment._id,
      attemptedAt: Date.now(),
      result: args.kind,
      code: args.code,
      reason: args.diagnostic ?? args.reason,
    })

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

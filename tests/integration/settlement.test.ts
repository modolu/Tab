/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { anyApi } from 'convex/server'
import { internal } from '../../convex/_generated/api'
import schema from '../../convex/schema'
import { tabFixture, VALID_RECIPIENT } from '../fixtures/tab'

const modules = import.meta.glob('../../convex/**/*.*s')
const WALLET = 'NQ2111111111111111111111111111111111'
const OTHER_WALLET = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const tx = (letter: string) => letter.repeat(64)

async function create(t: ReturnType<typeof convexTest>) {
  return t.mutation(anyApi.tabs.createTab, { ...tabFixture, ownerSecretHash: 'b'.repeat(64) })
}

describe('Phase 2 slot claiming and payment recording', () => {
  it('atomically claims a slot and prevents wallet switching', async () => {
    const t = convexTest(schema, modules)
    const created = await create(t)
    const claimed = await t.mutation(anyApi.participants.claimParticipantSlot, { slug: created.slug, slotId: created.participantSlotIds[0], walletAddress: WALLET })
    expect(claimed.claimedByAddress.replace(/\s/g, '')).toBe(WALLET)
    expect(claimed.paymentReference).toBe(`TAB:${created.slug.slice(4)}:s0`)
    await expect(t.mutation(anyApi.participants.claimParticipantSlot, { slug: created.slug, slotId: created.participantSlotIds[0], walletAddress: OTHER_WALLET })).rejects.toThrow(/already claimed/i)
  })

  it('records one authoritative submitted payment and makes the slot pending', async () => {
    const t = convexTest(schema, modules)
    const created = await create(t)
    const slotId = created.participantSlotIds[0]
    await t.mutation(anyApi.participants.claimParticipantSlot, { slug: created.slug, slotId, walletAddress: WALLET })
    const recorded = await t.mutation(anyApi.payments.recordSubmittedPayment, { slug: created.slug, slotId, senderAddress: WALLET, txHash: tx('a') })
    expect(recorded.status).toBe('submitted')
    expect(recorded.slotStatus).toBe('pending')
    const duplicate = await t.mutation(anyApi.payments.recordSubmittedPayment, { slug: created.slug, slotId, senderAddress: WALLET, txHash: tx('a') })
    expect(duplicate.paymentId).toBe(recorded.paymentId)
    await expect(t.mutation(anyApi.payments.recordSubmittedPayment, { slug: created.slug, slotId, senderAddress: OTHER_WALLET, txHash: tx('b') })).rejects.toThrow(/claimed/i)
    const payment = await t.run(async (ctx) => ctx.db.get(recorded.paymentId))
    expect(payment).toMatchObject({ recipientAddress: 'NQ21 1111 1111 1111 1111 1111 1111 1111 1111', amountMinor: '1000000', txHash: tx('a'), status: 'submitted' })
  })

  it('confirms each verified payment and settles only after the final slot', async () => {
    const t = convexTest(schema, modules)
    const created = await create(t)
    for (const [index, slotId] of created.participantSlotIds.slice(0, 2).entries()) {
      await t.mutation(anyApi.participants.claimParticipantSlot, { slug: created.slug, slotId, walletAddress: WALLET })
      await t.mutation(anyApi.payments.recordSubmittedPayment, { slug: created.slug, slotId, senderAddress: WALLET, txHash: tx(index === 0 ? 'c' : 'd') })
    }
    const firstPayment = await t.run(async (ctx) => ctx.db.query('payments').withIndex('by_tx_hash', (q) => q.eq('txHash', tx('c'))).unique())
    const secondPayment = await t.run(async (ctx) => ctx.db.query('payments').withIndex('by_tx_hash', (q) => q.eq('txHash', tx('d'))).unique())
    await t.mutation(internal.verification.applyVerificationResult, { paymentId: firstPayment._id, kind: 'confirmed', reason: 'test verified' })
    expect((await t.query(anyApi.tabs.getTabBySlug, { slug: created.slug }))?.status).toBe('open')
    await t.mutation(internal.verification.applyVerificationResult, { paymentId: secondPayment._id, kind: 'confirmed', reason: 'test verified' })
    const tabBeforeFinal = await t.query(anyApi.tabs.getTabBySlug, { slug: created.slug })
    expect(tabBeforeFinal?.participants.slice(0, 2).every(({ status }) => status === 'paid')).toBe(true)
    expect(tabBeforeFinal?.status).toBe('open')

    const finalSlotId = created.participantSlotIds[2]
    await t.mutation(anyApi.participants.claimParticipantSlot, { slug: created.slug, slotId: finalSlotId, walletAddress: WALLET })
    const finalPayment = await t.mutation(anyApi.payments.recordSubmittedPayment, { slug: created.slug, slotId: finalSlotId, senderAddress: WALLET, txHash: tx('e') })
    await t.mutation(internal.verification.applyVerificationResult, { paymentId: finalPayment.paymentId, kind: 'confirmed', reason: 'test verified' })
    expect((await t.query(anyApi.tabs.getTabBySlug, { slug: created.slug }))?.status).toBe('settled')
  })

  it('rejects a reused hash and makes invalid verification non-settling', async () => {
    const t = convexTest(schema, modules)
    const created = await create(t)
    const first = created.participantSlotIds[0]
    const second = created.participantSlotIds[1]
    await t.mutation(anyApi.participants.claimParticipantSlot, { slug: created.slug, slotId: first, walletAddress: WALLET })
    await t.mutation(anyApi.participants.claimParticipantSlot, { slug: created.slug, slotId: second, walletAddress: WALLET })
    const firstPayment = await t.mutation(anyApi.payments.recordSubmittedPayment, { slug: created.slug, slotId: first, senderAddress: WALLET, txHash: tx('f') })
    await expect(t.mutation(anyApi.payments.recordSubmittedPayment, { slug: created.slug, slotId: second, senderAddress: WALLET, txHash: tx('f') })).rejects.toThrow(/already been used/i)
    await t.mutation(internal.verification.applyVerificationResult, { paymentId: firstPayment.paymentId, kind: 'invalid', reason: 'wrong amount' })
    const tab = await t.query(anyApi.tabs.getTabBySlug, { slug: created.slug })
    expect(tab?.participants[0].status).toBe('unpaid')
    const payment = await t.query(anyApi.payments.getPaymentStatus, { slug: created.slug, slotId: first })
    expect(payment?.status).toBe('invalid')
    await expect(t.mutation(anyApi.payments.retryVerification, { slug: created.slug, slotId: first })).rejects.toThrow(/permanently invalid/i)
  })

  it('keeps an exhausted verification pending and retries the same payment', async () => {
    const t = convexTest(schema, modules)
    const created = await create(t)
    const slotId = created.participantSlotIds[0]
    await t.mutation(anyApi.participants.claimParticipantSlot, { slug: created.slug, slotId, walletAddress: WALLET })
    const submitted = await t.mutation(anyApi.payments.recordSubmittedPayment, { slug: created.slug, slotId, senderAddress: WALLET, txHash: tx('1') })

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await t.mutation(internal.verification.applyVerificationResult, {
        paymentId: submitted.paymentId,
        kind: 'confirming',
        reason: 'Transaction is not yet finalized.',
        code: 'transaction_not_finalized',
      })
    }

    const exhausted = await t.query(anyApi.payments.getPaymentStatus, { slug: created.slug, slotId })
    expect(exhausted).toMatchObject({ status: 'failed', slotStatus: 'pending', verificationCode: 'verification_retry_required' })
    expect((await t.query(anyApi.tabs.getTabBySlug, { slug: created.slug }))?.participants[0].status).toBe('pending')
    await expect(t.mutation(anyApi.payments.recordSubmittedPayment, { slug: created.slug, slotId, senderAddress: WALLET, txHash: tx('2') })).rejects.toThrow(/submitted payment/i)

    // Simulate the previous deployment, which left a failed payment's slot as unpaid.
    await t.run(async (ctx) => ctx.db.patch('participantSlots', slotId, { status: 'unpaid' }))

    const retry = await t.mutation(anyApi.payments.retryVerification, { slug: created.slug, slotId })
    const repeatedRetry = await t.mutation(anyApi.payments.retryVerification, { slug: created.slug, slotId })
    expect(retry).toMatchObject({ paymentId: submitted.paymentId, txHash: tx('1'), status: 'submitted', slotStatus: 'pending' })
    expect(repeatedRetry).toEqual(retry)
    expect((await t.run(async (ctx) => ctx.db.query('payments').withIndex('by_slot', (q) => q.eq('participantSlotId', slotId)).take(10))).length).toBe(1)

    const stillUnconfirmed = await t.query(anyApi.payments.getPaymentStatus, { slug: created.slug, slotId })
    expect(stillUnconfirmed?.status).not.toBe('confirmed')
    await t.mutation(internal.verification.applyVerificationResult, { paymentId: submitted.paymentId, kind: 'confirmed', reason: 'Existing transaction verified.' })
    expect(await t.query(anyApi.payments.getPaymentStatus, { slug: created.slug, slotId })).toMatchObject({ status: 'confirmed', slotStatus: 'paid', txHash: tx('1') })
  })

  it('stores a safe verifier code and diagnostic without replacing the friendly payment reason', async () => {
    const t = convexTest(schema, modules)
    const created = await create(t)
    const slotId = created.participantSlotIds[0]
    await t.mutation(anyApi.participants.claimParticipantSlot, { slug: created.slug, slotId, walletAddress: WALLET })
    const submitted = await t.mutation(anyApi.payments.recordSubmittedPayment, { slug: created.slug, slotId, senderAddress: WALLET, txHash: tx('2') })

    await t.mutation(internal.verification.applyVerificationResult, {
      paymentId: submitted.paymentId,
      kind: 'failed',
      code: 'rpc_http_403',
      diagnostic: 'getLatestBlock returned HTTP 403',
      reason: 'Nimiq verification failed. Retry verification.',
    })

    const attempt = await t.run(async (ctx) => ctx.db.query('paymentVerificationAttempts').withIndex('by_payment', (q) => q.eq('paymentId', submitted.paymentId)).unique())
    expect(attempt).toMatchObject({ result: 'failed', code: 'rpc_http_403', reason: 'getLatestBlock returned HTTP 403' })
    expect(await t.query(anyApi.payments.getPaymentStatus, { slug: created.slug, slotId })).toMatchObject({ status: 'failed', verificationCode: 'rpc_http_403', verificationReason: 'Nimiq verification failed. Retry verification.' })
  })
})

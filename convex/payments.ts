import { ValidationUtils } from '@nimiq/utils/validation-utils'
import { internal } from './_generated/api'
import { internalQuery, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { getPaymentReference } from './reference'

const paymentStatus = v.union(
  v.literal('submitted'),
  v.literal('confirming'),
  v.literal('confirmed'),
  v.literal('failed'),
  v.literal('invalid'),
)

const slotStatus = v.union(v.literal('unpaid'), v.literal('pending'), v.literal('paid'))

const submittedPaymentResult = v.object({
  paymentId: v.id('payments'),
  txHash: v.string(),
  status: paymentStatus,
  slotStatus,
})

const retryVerificationResult = v.object({
  paymentId: v.id('payments'),
  txHash: v.string(),
  status: paymentStatus,
  slotStatus,
})

const paymentStatusResult = v.union(v.object({
  paymentId: v.id('payments'),
  txHash: v.string(),
  status: paymentStatus,
  verificationCode: v.optional(v.string()),
  verificationReason: v.optional(v.string()),
  slotStatus,
  createdAt: v.number(),
  confirmedAt: v.optional(v.number()),
}), v.null())

function normalizeTxHash(value: string): string {
  const hash = value.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('The transaction hash is invalid.')
  return hash
}

function normalizeAddress(value: string): string {
  const address = value.trim()
  if (!ValidationUtils.isValidAddress(address)) throw new Error('The connected Nimiq address is invalid.')
  return ValidationUtils.normalizeAddress(address)
}

function resultFromPayment(payment: Doc<'payments'>, slotStatus: Doc<'participantSlots'>['status']) {
  return {
    paymentId: payment._id,
    txHash: payment.txHash,
    status: payment.status,
    slotStatus,
  }
}

export const recordSubmittedPayment = mutation({
  args: {
    slug: v.optional(v.string()),
    slotId: v.id('participantSlots'),
    senderAddress: v.string(),
    txHash: v.string(),
  },
  returns: submittedPaymentResult,
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId)
    const tab = args.slug
      ? await ctx.db.query('tabs').withIndex('by_slug', (q) => q.eq('slug', args.slug as string)).first()
      : slot ? await ctx.db.get(slot.tabId) : null
    if (!tab) throw new Error('Tab not found.')
    if (!slot || slot.tabId !== tab._id) throw new Error('That participant slot does not belong to this Tab.')

    const senderAddress = normalizeAddress(args.senderAddress)
    if (!slot.claimedByAddress || normalizeAddress(slot.claimedByAddress) !== senderAddress) {
      throw new Error('This wallet has not claimed that participant slot.')
    }
    const txHash = normalizeTxHash(args.txHash)
    const existingByHash = await ctx.db.query('payments').withIndex('by_tx_hash', (q) => q.eq('txHash', txHash)).first()
    if (existingByHash) {
      if (existingByHash.tabId !== tab._id || existingByHash.participantSlotId !== slot._id) {
        throw new Error('This transaction hash has already been used for another payment.')
      }
      return resultFromPayment(existingByHash, slot.status)
    }

    if (slot.paymentId) {
      const existingPayment = await ctx.db.get(slot.paymentId)
      if (existingPayment) {
        if (existingPayment.txHash === txHash) return resultFromPayment(existingPayment, slot.status)
        if (existingPayment.status !== 'invalid') throw new Error('This participant slot already has a submitted payment. Retry its verification instead.')
      }
    }
    if (slot.status === 'paid') throw new Error('This participant slot is already paid.')

    const now = Date.now()
    const paymentId = await ctx.db.insert('payments', {
      tabId: tab._id,
      participantSlotId: slot._id,
      chain: 'nimiq',
      token: 'NIM',
      senderAddress,
      recipientAddress: tab.recipientAddress,
      amountMinor: slot.amountMinor,
      txHash,
      status: 'submitted',
      verificationAttempts: 0,
      createdAt: now,
      verificationScheduledAt: now + 1,
    })
    await ctx.db.patch('participantSlots', slot._id, { status: 'pending', paymentId, updatedAt: now })
    await ctx.scheduler.runAfter(0, internal.verification.verifyNimiqTransaction, { paymentId, scheduledAt: now + 1 })

    return { paymentId, txHash, status: 'submitted' as const, slotStatus: 'pending' as const }
  },
})

export const retryVerification = mutation({
  args: { slug: v.optional(v.string()), slotId: v.id('participantSlots') },
  returns: retryVerificationResult,
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId)
    const tab = args.slug
      ? await ctx.db.query('tabs').withIndex('by_slug', (q) => q.eq('slug', args.slug as string)).first()
      : slot ? await ctx.db.get(slot.tabId) : null
    if (!tab) throw new Error('Tab not found.')
    if (!slot || slot.tabId !== tab._id || !slot.paymentId) throw new Error('This participant slot has no submitted payment to retry.')

    const payment = await ctx.db.get(slot.paymentId)
    if (!payment || payment.tabId !== tab._id || payment.participantSlotId !== slot._id) {
      throw new Error('This participant slot has no valid submitted payment to retry.')
    }
    if (payment.status === 'confirmed' || slot.status === 'paid') return resultFromPayment(payment, slot.status)
    if (payment.status === 'invalid') throw new Error('This payment was permanently invalid and cannot be retried.')
    if ((payment.verificationScheduledAt ?? 0) > 0) return resultFromPayment(payment, slot.status)
    if (payment.status !== 'failed') throw new Error('This payment is already being verified.')

    const scheduledAt = Date.now() + 1
    await ctx.db.patch('payments', payment._id, {
      status: 'submitted',
      verificationAttempts: 0,
      verificationCode: 'verification_retry_requested',
      verificationReason: 'Payment submitted. Verification needs to be retried.',
      verificationScheduledAt: scheduledAt,
    })
    await ctx.db.patch('participantSlots', slot._id, { status: 'pending', updatedAt: Date.now() })
    await ctx.scheduler.runAfter(0, internal.verification.verifyNimiqTransaction, { paymentId: payment._id, scheduledAt })
    return {
      paymentId: payment._id,
      txHash: payment.txHash,
      status: 'submitted' as const,
      slotStatus: 'pending' as const,
    }
  },
})

export const getPaymentStatus = query({
  args: { slug: v.optional(v.string()), slotId: v.id('participantSlots') },
  returns: paymentStatusResult,
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId)
    const tab = args.slug
      ? await ctx.db.query('tabs').withIndex('by_slug', (q) => q.eq('slug', args.slug as string)).first()
      : slot ? await ctx.db.get(slot.tabId) : null
    if (!tab) return null
    if (!slot || slot.tabId !== tab._id || !slot.paymentId) return null
    const payment = await ctx.db.get(slot.paymentId)
    if (!payment) return null
    return {
      paymentId: payment._id,
      txHash: payment.txHash,
      status: payment.status,
      verificationCode: payment.verificationCode,
      verificationReason: payment.verificationReason,
      slotStatus: slot.status,
      createdAt: payment.createdAt,
      confirmedAt: payment.confirmedAt,
    }
  },
})

export const getVerificationContext = internalQuery({
  args: { paymentId: v.id('payments') },
  returns: v.union(v.object({
    payment: v.object({
      _id: v.id('payments'), _creationTime: v.number(), tabId: v.id('tabs'), participantSlotId: v.id('participantSlots'),
      chain: v.literal('nimiq'), token: v.literal('NIM'), senderAddress: v.string(), recipientAddress: v.string(),
      amountMinor: v.string(), txHash: v.string(), status: paymentStatus, verificationAttempts: v.optional(v.number()),
      verificationCode: v.optional(v.string()), verificationScheduledAt: v.optional(v.number()),
      verificationReason: v.optional(v.string()), createdAt: v.number(), confirmedAt: v.optional(v.number()),
    }),
    tab: v.object({ _id: v.id('tabs'), slug: v.string(), recipientAddress: v.string(), status: v.union(v.literal('open'), v.literal('settled'), v.literal('expired'), v.literal('cancelled')) }),
    slot: v.object({ _id: v.id('participantSlots'), tabId: v.id('tabs'), label: v.string(), amountMinor: v.string(), shortId: v.optional(v.string()), status: slotStatus, claimedByAddress: v.optional(v.string()), paymentId: v.optional(v.id('payments')), createdAt: v.number(), updatedAt: v.number() }),
  }), v.null()),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId)
    if (!payment) return null
    const tab = await ctx.db.get(payment.tabId)
    const slot = await ctx.db.get(payment.participantSlotId)
    if (!tab || !slot) return null
    return {
      payment: {
        _id: payment._id, _creationTime: payment._creationTime, tabId: payment.tabId, participantSlotId: payment.participantSlotId,
        chain: payment.chain, token: payment.token, senderAddress: payment.senderAddress, recipientAddress: payment.recipientAddress,
        amountMinor: payment.amountMinor, txHash: payment.txHash, status: payment.status, verificationAttempts: payment.verificationAttempts,
        verificationCode: payment.verificationCode, verificationScheduledAt: payment.verificationScheduledAt,
        verificationReason: payment.verificationReason, createdAt: payment.createdAt, confirmedAt: payment.confirmedAt,
      },
      tab: { _id: tab._id, slug: tab.slug, recipientAddress: tab.recipientAddress, status: tab.status },
      slot: {
        _id: slot._id, tabId: slot.tabId, label: slot.label, amountMinor: slot.amountMinor, shortId: slot.shortId,
        status: slot.status, claimedByAddress: slot.claimedByAddress, paymentId: slot.paymentId, createdAt: slot.createdAt, updatedAt: slot.updatedAt,
      },
    }
  },
})

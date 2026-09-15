import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  tabs: defineTable({
    slug: v.string(),
    title: v.string(),
    note: v.optional(v.string()),
    token: v.literal('NIM'),
    amountMinor: v.string(),
    recipientAddress: v.string(),
    allocationMode: v.union(v.literal('equal'), v.literal('custom')),
    status: v.union(v.literal('open'), v.literal('settled'), v.literal('expired'), v.literal('cancelled')),
    ownerSecretHash: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_slug', ['slug']),

  participantSlots: defineTable({
    tabId: v.id('tabs'),
    label: v.string(),
    amountMinor: v.string(),
    shortId: v.optional(v.string()),
    status: v.union(v.literal('unpaid'), v.literal('pending'), v.literal('paid')),
    claimedByAddress: v.optional(v.string()),
    paymentId: v.optional(v.id('payments')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_tab', ['tabId']),

  payments: defineTable({
    tabId: v.id('tabs'),
    participantSlotId: v.id('participantSlots'),
    chain: v.literal('nimiq'),
    token: v.literal('NIM'),
    senderAddress: v.string(),
    recipientAddress: v.string(),
    amountMinor: v.string(),
    txHash: v.string(),
    verificationAttempts: v.optional(v.number()),
    verificationCode: v.optional(v.string()),
    verificationScheduledAt: v.optional(v.number()),
    status: v.union(v.literal('submitted'), v.literal('confirming'), v.literal('confirmed'), v.literal('failed'), v.literal('invalid')),
    verificationReason: v.optional(v.string()),
    createdAt: v.number(),
    confirmedAt: v.optional(v.number()),
  }).index('by_tx_hash', ['txHash']).index('by_tab', ['tabId']).index('by_slot', ['participantSlotId']),

  paymentVerificationAttempts: defineTable({
    paymentId: v.id('payments'),
    attemptedAt: v.number(),
    result: v.string(),
    code: v.optional(v.string()),
    reason: v.optional(v.string()),
  }).index('by_payment', ['paymentId']),
})

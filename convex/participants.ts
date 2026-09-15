import { mutation, query } from './_generated/server'
import { ValidationUtils } from '@nimiq/utils/validation-utils'
import { v } from 'convex/values'
import { getPaymentReference } from './reference'

const slotClaimResult = v.object({
  tabId: v.id('tabs'),
  slotId: v.id('participantSlots'),
  claimedByAddress: v.string(),
  paymentReference: v.string(),
  status: v.union(v.literal('unpaid'), v.literal('pending'), v.literal('paid')),
})

export const getByTab = query({
  args: { tabId: v.id('tabs') },
  returns: v.array(v.object({
    _id: v.id('participantSlots'),
    _creationTime: v.number(),
    tabId: v.id('tabs'),
    label: v.string(),
    amountMinor: v.string(),
    status: v.union(v.literal('unpaid'), v.literal('pending'), v.literal('paid')),
    claimedByAddress: v.optional(v.string()),
    paymentId: v.optional(v.id('payments')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })),
  handler: (ctx, args) => ctx.db.query('participantSlots').withIndex('by_tab', (q) => q.eq('tabId', args.tabId)).take(100),
})

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(v.array(v.object({
    id: v.id('participantSlots'),
    label: v.string(),
    amountMinor: v.string(),
    status: v.union(v.literal('unpaid'), v.literal('pending'), v.literal('paid')),
  })), v.null()),
  handler: async (ctx, args) => {
    const tab = await ctx.db.query('tabs').withIndex('by_slug', (q) => q.eq('slug', args.slug)).first()
    if (!tab) return null
    const slots = await ctx.db.query('participantSlots').withIndex('by_tab', (q) => q.eq('tabId', tab._id)).take(100)
    return slots.map(({ _id, label, amountMinor, status }) => ({ id: _id, label, amountMinor, status }))
  },
})

export const claimParticipantSlot = mutation({
  args: {
    slug: v.optional(v.string()),
    slotId: v.id('participantSlots'),
    walletAddress: v.string(),
  },
  returns: slotClaimResult,
  handler: async (ctx, args) => {
    const slotForTab = await ctx.db.get(args.slotId)
    const tab = args.slug
      ? await ctx.db.query('tabs').withIndex('by_slug', (q) => q.eq('slug', args.slug as string)).first()
      : slotForTab ? await ctx.db.get(slotForTab.tabId) : null
    if (!tab) throw new Error('Tab not found.')
    if (tab.status !== 'open') throw new Error('This Tab is no longer open for payment.')

    const slot = slotForTab
    if (!slot || slot.tabId !== tab._id) throw new Error('That participant slot does not belong to this Tab.')
    const walletAddress = args.walletAddress.trim()
    if (!ValidationUtils.isValidAddress(walletAddress)) throw new Error('The connected Nimiq address is invalid.')
    const normalizedAddress = ValidationUtils.normalizeAddress(walletAddress)

    if (slot.status === 'paid') throw new Error('This participant slot is already paid.')
    if (slot.claimedByAddress && ValidationUtils.normalizeAddress(slot.claimedByAddress) !== normalizedAddress) {
      throw new Error('This participant slot is already claimed by another wallet.')
    }
    if (slot.status === 'pending' && !slot.claimedByAddress) {
      throw new Error('This participant slot already has a payment in verification.')
    }

    if (!slot.claimedByAddress) {
      await ctx.db.patch('participantSlots', slot._id, {
        claimedByAddress: normalizedAddress,
        updatedAt: Date.now(),
      })
    }

    return {
      tabId: tab._id,
      slotId: slot._id,
      claimedByAddress: normalizedAddress,
      paymentReference: getPaymentReference(tab.slug, slot._id, slot.shortId),
      status: slot.status,
    }
  },
})

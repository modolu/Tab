import { query } from './_generated/server'
import { v } from 'convex/values'

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

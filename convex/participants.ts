import { query } from './_generated/server'
import { v } from 'convex/values'

export const getByTab = query({
  args: { tabId: v.id('tabs') },
  handler: (ctx, args) => ctx.db.query('participantSlots').withIndex('by_tab', (q) => q.eq('tabId', args.tabId)).collect(),
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const tab = await ctx.db.query('tabs').withIndex('by_slug', (q) => q.eq('slug', args.slug)).first()
    if (!tab) return null
    const slots = await ctx.db.query('participantSlots').withIndex('by_tab', (q) => q.eq('tabId', tab._id)).collect()
    return slots.map(({ _id, label, amountMinor, status }) => ({ id: _id, label, amountMinor, status }))
  },
})

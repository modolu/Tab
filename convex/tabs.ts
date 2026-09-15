import { ValidationUtils } from '@nimiq/utils/validation-utils'
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

const createParticipantValidator = v.object({
  label: v.string(),
  amountMinor: v.optional(v.string()),
})

const createTabValidator = {
  title: v.string(),
  note: v.optional(v.string()),
  token: v.literal('NIM'),
  amountMinor: v.string(),
  recipientAddress: v.string(),
  allocationMode: v.union(v.literal('equal'), v.literal('custom')),
  participants: v.array(createParticipantValidator),
  ownerSecretHash: v.string(),
}

function parseLuna(value: string, field: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`${field} must be a non-negative integer string.`)
  return BigInt(value)
}

function validateDraft(args: {
  title: string
  note?: string
  token: 'NIM'
  amountMinor: string
  recipientAddress: string
  allocationMode: 'equal' | 'custom'
  participants: Array<{ label: string; amountMinor?: string }>
  ownerSecretHash: string
}) {
  if (!args.title.trim()) throw new Error('A Tab title is required.')
  if (args.title.trim().length > 120) throw new Error('Tab titles must be 120 characters or fewer.')
  if (args.note && args.note.trim().length > 500) throw new Error('Notes must be 500 characters or fewer.')
  if (args.token !== 'NIM') throw new Error('Only NIM Tabs are supported.')

  const totalMinor = parseLuna(args.amountMinor, 'Total')
  if (totalMinor <= 0n) throw new Error('The total must be greater than zero.')

  const recipientAddress = args.recipientAddress.trim()
  if (!ValidationUtils.isValidAddress(recipientAddress)) throw new Error('The recipient address is invalid.')
  if (!/^[a-f0-9]{64}$/.test(args.ownerSecretHash)) throw new Error('A valid owner secret hash is required.')
  if (args.participants.length < 1 || args.participants.length > 100) throw new Error('Add between 1 and 100 participants.')
  if (args.participants.some(({ label }) => !label.trim())) throw new Error('Every participant needs a label.')

  if (args.allocationMode === 'equal') {
    const base = totalMinor / BigInt(args.participants.length)
    const remainder = totalMinor % BigInt(args.participants.length)
    return args.participants.map((_, index) => (base + (BigInt(index) < remainder ? 1n : 0n)).toString())
  }

  const allocations = args.participants.map(({ amountMinor }) => {
    if (amountMinor === undefined) throw new Error('Custom shares are required for every participant.')
    return parseLuna(amountMinor, 'Share')
  })
  const allocated = allocations.reduce((sum, amount) => sum + amount, 0n)
  if (allocated !== totalMinor) throw new Error('Participant shares must equal the total exactly.')
  return allocations.map(String)
}

function toPublicTab(tab: {
  _id: string
  slug: string
  title: string
  note?: string
  token: 'NIM'
  amountMinor: string
  recipientAddress: string
  allocationMode: 'equal' | 'custom'
  status: 'open' | 'settled' | 'expired' | 'cancelled'
  createdAt: number
  updatedAt: number
}, slots: Array<{ _id: string; label: string; amountMinor: string; status: 'unpaid' | 'pending' | 'paid' }>) {
  return {
    id: tab._id,
    slug: tab.slug,
    title: tab.title,
    note: tab.note,
    token: tab.token,
    amountMinor: tab.amountMinor,
    recipientAddress: tab.recipientAddress,
    allocationMode: tab.allocationMode,
    status: tab.status,
    participants: slots.map((slot) => ({ id: slot._id, label: slot.label, amountMinor: slot.amountMinor, status: slot.status })),
    createdAt: tab.createdAt,
    updatedAt: tab.updatedAt,
  }
}

async function getPublicTab(ctx: { db: any }, slug: string) {
  const tab = await ctx.db.query('tabs').withIndex('by_slug', (q: any) => q.eq('slug', slug)).first()
  if (!tab) return null
  const slots = await ctx.db.query('participantSlots').withIndex('by_tab', (q: any) => q.eq('tabId', tab._id)).collect()
  return toPublicTab(tab, slots)
}

export const createTab = mutation({
  args: createTabValidator,
  handler: async (ctx, args) => {
    const amounts = validateDraft(args)
    const now = Date.now()
    let slug = ''
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `tab-${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
      const existing = await ctx.db.query('tabs').withIndex('by_slug', (q) => q.eq('slug', candidate)).first()
      if (!existing) {
        slug = candidate
        break
      }
    }
    if (!slug) throw new Error('Unable to allocate a unique Tab URL. Please retry.')

    const tabId = await ctx.db.insert('tabs', {
      slug,
      title: args.title.trim(),
      note: args.note?.trim() || undefined,
      token: 'NIM',
      amountMinor: args.amountMinor,
      recipientAddress: ValidationUtils.normalizeAddress(args.recipientAddress.trim()),
      allocationMode: args.allocationMode,
      status: 'open',
      ownerSecretHash: args.ownerSecretHash,
      createdAt: now,
      updatedAt: now,
    })
    const participantSlotIds = []
    for (let index = 0; index < args.participants.length; index += 1) {
      participantSlotIds.push(await ctx.db.insert('participantSlots', {
        tabId,
        label: args.participants[index].label.trim(),
        amountMinor: amounts[index],
        status: 'unpaid',
        createdAt: now,
        updatedAt: now,
      }))
    }
    return { tabId, slug, participantSlotIds }
  },
})

export const getTabBySlug = query({
  args: { slug: v.string() },
  handler: (ctx, args) => getPublicTab(ctx, args.slug),
})

export const getOrganizerTab = query({
  args: { slug: v.string(), ownerSecretHash: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const tab = await ctx.db.query('tabs').withIndex('by_slug', (q) => q.eq('slug', args.slug)).first()
    if (!tab) return null
    if (!args.ownerSecretHash || args.ownerSecretHash !== tab.ownerSecretHash) return null
    const slots = await ctx.db.query('participantSlots').withIndex('by_tab', (q) => q.eq('tabId', tab._id)).collect()
    return toPublicTab(tab, slots)
  },
})

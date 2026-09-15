import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { anyApi } from 'convex/server'
import schema from '../../convex/schema'
import { tabFixture, VALID_RECIPIENT } from '../fixtures/tab'

const modules = import.meta.glob('../../convex/**/*.*s')

describe('Phase 1 Convex create and join flow', () => {
  it('persists a Tab and all unpaid participant slots, then retrieves it publicly', async () => {
    const t = convexTest(schema, modules)
    const created = await t.mutation(anyApi.tabs.createTab, tabFixture)
    const publicTab = await t.query(anyApi.tabs.getTabBySlug, { slug: created.slug })

    expect(publicTab).not.toBeNull()
    expect(publicTab?.title).toBe('Studio dinner')
    expect(publicTab?.recipientAddress.replace(/\s/g, '')).toBe(VALID_RECIPIENT)
    expect(publicTab?.participants.map(({ amountMinor }) => amountMinor)).toEqual(['1000000', '1000000', '1000000'])
    expect(publicTab?.participants.every(({ status }) => status === 'unpaid')).toBe(true)
    expect(publicTab).not.toHaveProperty('ownerSecretHash')
    expect(publicTab?.participants.reduce((sum, slot) => sum + BigInt(slot.amountMinor), 0n)).toBe(BigInt(tabFixture.amountMinor))
    await expect(t.query(anyApi.tabs.getOrganizerTab, { slug: created.slug })).resolves.toBeNull()
    await expect(t.query(anyApi.tabs.getOrganizerTab, { slug: created.slug, ownerSecretHash: tabFixture.ownerSecretHash })).resolves.not.toBeNull()
  })

  it('rejects invalid custom allocations before persistence', async () => {
    const t = convexTest(schema, modules)
    await expect(t.mutation(anyApi.tabs.createTab, {
      ...tabFixture,
      allocationMode: 'custom',
      participants: [{ label: 'Dolu', amountMinor: '1000000' }, { label: 'Tobi', amountMinor: '999999' }, { label: 'Miracle', amountMinor: '1000000' }],
    })).rejects.toThrow(/equal the total/i)
  })

  it('returns null for a missing slug', async () => {
    const t = convexTest(schema, modules)
    await expect(t.query(anyApi.tabs.getTabBySlug, { slug: 'missing-tab' })).resolves.toBeNull()
  })
})

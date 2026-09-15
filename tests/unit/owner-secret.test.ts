import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOwnerSecret, hashOwnerSecret } from '../../src/lib/ids'

describe('owner secret security', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('generates a 256-bit owner secret with crypto.getRandomValues', () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues')

    const secret = createOwnerSecret()

    expect(getRandomValues).toHaveBeenCalledOnce()
    expect(getRandomValues.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array)
    expect(getRandomValues.mock.calls[0]?.[0]).toHaveLength(32)
    expect(secret).toHaveLength(43)
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('hashes without crypto.subtle', async () => {
    const originalSubtle = globalThis.crypto.subtle
    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: undefined,
    })

    try {
      await expect(hashOwnerSecret('abc')).resolves.toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      )
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', {
        configurable: true,
        value: originalSubtle,
      })
    }
  })

  it('produces deterministic, distinct, 32-byte SHA-256 hex hashes', async () => {
    const first = await hashOwnerSecret('same-secret')
    const second = await hashOwnerSecret('same-secret')
    const different = await hashOwnerSecret('different-secret')

    expect(first).toBe(second)
    expect(first).not.toBe(different)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
  })
})

import { describe, expect, it } from 'vitest'
import { formatLuna, parseNimToLuna, toSdkLuna } from '../../src/lib/money'

describe('NIM money helpers', () => {
  it('converts NIM to integer Luna', () => {
    expect(parseNimToLuna('1')).toBe(100000n)
    expect(parseNimToLuna('0.00001')).toBe(1n)
    expect(parseNimToLuna('1.23456')).toBe(123456n)
  })

  it('rejects invalid or non-positive totals', () => {
    expect(() => parseNimToLuna('1.234567')).toThrow()
    expect(() => parseNimToLuna('-1')).toThrow()
    expect(() => parseNimToLuna('0')).toThrow()
    expect(() => parseNimToLuna('one')).toThrow()
  })

  it('formats Luna without floating-point arithmetic', () => {
    expect(formatLuna(123456n)).toBe('1.23456')
    expect(formatLuna('100000')).toBe('1')
    expect(formatLuna(1n)).toBe('0.00001')
  })

  it('only converts safe SDK integers', () => {
    expect(toSdkLuna(123n)).toBe(123)
    expect(() => toSdkLuna(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow()
  })
})

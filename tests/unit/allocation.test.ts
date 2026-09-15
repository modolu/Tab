import { describe, expect, it } from 'vitest'
import { allocateEqual, validateCustomAllocation } from '../../src/lib/allocation'

describe('allocation engine', () => {
  it.each([
    [10n, 2, [5n, 5n]],
    [10n, 3, [4n, 3n, 3n]],
    [2n, 3, [1n, 1n, 0n]],
    [1n, 1, [1n]],
  ])('allocates %s across %s participants deterministically', (total, count, expected) => {
    expect(allocateEqual(total, count)).toEqual(expected)
  })

  it('rejects invalid totals and participant counts', () => {
    expect(() => allocateEqual(-1n, 2)).toThrow()
    expect(() => allocateEqual(10n, 0)).toThrow()
    expect(() => allocateEqual(10n, 1.5)).toThrow()
  })

  it('validates exact custom totals', () => {
    expect(() => validateCustomAllocation(10n, [4n, 6n])).not.toThrow()
    expect(() => validateCustomAllocation(10n, [4n, 5n])).toThrow()
    expect(() => validateCustomAllocation(10n, [11n, -1n])).toThrow()
  })
})

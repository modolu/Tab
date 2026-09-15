export type AllocationResult = {
  amountsMinor: string[]
  totalMinor: string
}

export function allocateEqual(totalMinor: bigint, participantCount: number): bigint[] {
  if (totalMinor < 0n) throw new Error('Total cannot be negative.')
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    throw new Error('At least one participant is required.')
  }

  const base = totalMinor / BigInt(participantCount)
  const remainder = totalMinor % BigInt(participantCount)
  return Array.from({ length: participantCount }, (_, index) =>
    base + (BigInt(index) < remainder ? 1n : 0n),
  )
}

export function validateCustomAllocation(totalMinor: bigint, allocations: bigint[]): void {
  if (totalMinor < 0n) throw new Error('Total cannot be negative.')
  if (allocations.length < 1) throw new Error('At least one participant is required.')
  if (allocations.some((amount) => amount < 0n)) throw new Error('Shares cannot be negative.')

  const total = allocations.reduce((sum, amount) => sum + amount, 0n)
  if (total !== totalMinor) throw new Error('Participant shares must equal the total exactly.')
}

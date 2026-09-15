export const LUNA_PER_NIM = 100_000n

const NIM_VALUE = /^(?:0|[1-9]\d*)(?:\.\d{1,5})?$/

export function parseNimToLuna(value: string): bigint {
  return parseNim(value, true)
}

export function parseNimToLunaAllowZero(value: string): bigint {
  return parseNim(value, false)
}

function parseNim(value: string, requirePositive: boolean): bigint {
  const normalized = value.trim()
  if (!NIM_VALUE.test(normalized)) {
    throw new Error('Enter a valid NIM amount with up to 5 decimal places.')
  }

  const [wholePart, fractionPart = ''] = normalized.split('.')
  const luna = BigInt(wholePart) * LUNA_PER_NIM + BigInt(fractionPart.padEnd(5, '0') || '0')

  if (requirePositive && luna <= 0n) {
    throw new Error('The total must be greater than zero.')
  }

  return luna
}

export function formatLuna(value: bigint | string): string {
  const luna = typeof value === 'string' ? parseLunaString(value) : value
  if (luna < 0n) throw new Error('Luna cannot be negative.')

  const whole = luna / LUNA_PER_NIM
  const fraction = (luna % LUNA_PER_NIM).toString().padStart(5, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

export function toSdkLuna(value: bigint | string): number {
  const luna = typeof value === 'string' ? parseLunaString(value) : value
  if (luna < BigInt(Number.MIN_SAFE_INTEGER) || luna > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('The Luna amount cannot be represented safely by the Nimiq SDK.')
  }
  return Number(luna)
}

export function parseLunaString(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error('Luna must be a non-negative integer string.')
  return BigInt(value)
}

function randomBytes(length: number): Uint8Array {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure randomness is unavailable. Cannot create a safe Tab secret.')
  }
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function createId(): string {
  return toBase64Url(randomBytes(16))
}

export function createSlug(): string {
  return toBase64Url(randomBytes(9))
}

export function createOwnerSecret(): string {
  return toBase64Url(randomBytes(32))
}

function assertCompactReferencePart(value: string, name: string): void {
  if (!/^[A-Za-z0-9-]+$/.test(value)) {
    throw new Error(`${name} must contain only ASCII letters, numbers, and hyphens.`)
  }
}

export function createPaymentReference(tabShortId: string, slotShortId: string): string {
  assertCompactReferencePart(tabShortId, 'Tab reference')
  assertCompactReferencePart(slotShortId, 'Slot reference')
  const reference = `TAB:${tabShortId}:${slotShortId}`
  if (new TextEncoder().encode(reference).byteLength > 64) {
    throw new Error('The Tab payment reference is too long.')
  }
  return reference
}

export function getTabShortId(slug: string): string {
  const shortId = slug.replace(/^tab-/, '')
  assertCompactReferencePart(shortId, 'Tab slug')
  return shortId
}

/** A compact deterministic fallback for records created before short IDs existed. */
export function deriveCompactReferenceId(value: string): string {
  let hash = 1469598103934665603n
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte)
    hash = BigInt.asUintN(64, hash * 1099511628211n)
  }
  return `h${hash.toString(36).padStart(13, '0')}`
}

export async function hashOwnerSecret(secret: string): Promise<string> {
  if (!secret) throw new Error('Owner secret cannot be empty.')
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure hashing is unavailable. Cannot create a safe Tab secret.')
  }
  const bytes = new TextEncoder().encode(secret)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

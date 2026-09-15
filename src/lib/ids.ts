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

export async function hashOwnerSecret(secret: string): Promise<string> {
  if (!secret) throw new Error('Owner secret cannot be empty.')
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure hashing is unavailable. Cannot create a safe Tab secret.')
  }
  const bytes = new TextEncoder().encode(secret)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

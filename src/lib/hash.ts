import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

/**
 * SHA-256 without relying on secure-context-only Web Crypto APIs.
 * The lowercase hexadecimal representation is shared by browser and Convex.
 */
export function sha256Hex(value: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(value)))
}

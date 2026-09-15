import type { CreateTabInput } from '../../src/lib/types'

export const VALID_RECIPIENT = 'NQ2111111111111111111111111111111111'

export const tabFixture: CreateTabInput = {
  title: 'Studio dinner',
  note: 'Thanks for joining.',
  token: 'NIM',
  amountMinor: '3000000',
  recipientAddress: VALID_RECIPIENT,
  allocationMode: 'equal',
  participants: [
    { label: 'Dolu', amountMinor: '1000000' },
    { label: 'Tobi', amountMinor: '1000000' },
    { label: 'Miracle', amountMinor: '1000000' },
  ],
  ownerSecretHash: 'a'.repeat(64),
}

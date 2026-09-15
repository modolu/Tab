export type MinorAmount = string

export type AllocationMode = 'equal' | 'custom'

export type TabStatus = 'open' | 'settled' | 'expired' | 'cancelled'

export type ParticipantDraft = {
  label: string
  amountMinor?: MinorAmount
}

export type TabDraft = {
  title: string
  note?: string
  token: 'NIM'
  amountMinor: MinorAmount
  recipientAddress: string
  allocationMode: AllocationMode
  participants: ParticipantDraft[]
}

export type CreateTabInput = TabDraft & {
  ownerSecretHash: string
}

export type PublicParticipant = {
  id: string
  label: string
  amountMinor: MinorAmount
  status: 'unpaid' | 'pending' | 'paid'
}

export type PublicTab = {
  id?: string
  slug: string
  title: string
  note?: string
  token: 'NIM'
  amountMinor: MinorAmount
  recipientAddress: string
  allocationMode: AllocationMode
  status: TabStatus
  participants: PublicParticipant[]
  createdAt?: number
  updatedAt?: number
}

export type CreateTabResult = {
  tabId: string
  slug: string
  participantSlotIds: string[]
}

export type SlotClaimResult = {
  tabId: string
  slotId: string
  claimedByAddress: string
  paymentReference: string
  status: 'unpaid' | 'pending' | 'paid'
}

export type SubmittedPaymentResult = {
  paymentId: string
  txHash: string
  status: 'submitted' | 'confirming' | 'confirmed' | 'failed' | 'invalid'
  slotStatus: 'unpaid' | 'pending' | 'paid'
}

export type PaymentStatus = {
  paymentId: string
  txHash: string
  status: 'submitted' | 'confirming' | 'confirmed' | 'failed' | 'invalid'
  verificationCode?: string
  verificationReason?: string
  slotStatus: 'unpaid' | 'pending' | 'paid'
  createdAt: number
  confirmedAt?: number
}

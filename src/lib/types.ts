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

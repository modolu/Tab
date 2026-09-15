import type { NimiqProvider } from '@nimiq/mini-app-sdk'

export type NimiqAccount = {
  address: string
  provider: NimiqProvider
}

export type NimiqPaymentRequest = {
  recipient: string
  amountMinor: string
  paymentReference: string
}

export type NimiqProviderState = 'connecting' | 'ready' | 'submitting' | 'submitted'

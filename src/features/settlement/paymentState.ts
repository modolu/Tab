import type { PaymentStatus } from '../../lib/types'

export type SettlementState = 'unpaid' | 'submitting' | 'submitted' | 'confirming' | 'confirmed' | 'failed' | 'invalid'

export function canShowPaymentAction(slotStatus: 'unpaid' | 'pending' | 'paid', paymentStatus: Pick<PaymentStatus, 'status'> | null | undefined): boolean {
  return slotStatus === 'unpaid' && paymentStatus !== undefined && paymentStatus?.status !== 'failed'
}

export function settlementMessage(state: SettlementState): string {
  switch (state) {
    case 'unpaid': return 'Ready to pay'
    case 'submitting': return 'Submitting payment…'
    case 'submitted':
    case 'confirming': return 'Payment submitted — verifying onchain…'
    case 'confirmed': return 'Paid ✓'
    case 'failed': return 'Payment submitted — verification needs to be retried.'
    case 'invalid': return 'Invalid payment'
  }
}

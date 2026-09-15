export type SettlementState = 'unpaid' | 'submitting' | 'submitted' | 'confirming' | 'confirmed' | 'failed' | 'invalid'

export function settlementMessage(state: SettlementState): string {
  switch (state) {
    case 'unpaid': return 'Ready to pay'
    case 'submitting': return 'Submitting payment…'
    case 'submitted':
    case 'confirming': return 'Payment submitted — verifying onchain…'
    case 'confirmed': return 'Paid ✓'
    case 'failed': return 'Payment failed'
    case 'invalid': return 'Invalid payment'
  }
}

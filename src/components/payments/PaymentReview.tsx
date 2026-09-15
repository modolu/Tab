import { formatLuna } from '../../lib/money'
import type { PublicParticipant, PublicTab } from '../../lib/types'

type PaymentReviewProps = {
  tab: PublicTab
  participant: PublicParticipant
  senderAddress: string
  isSubmitting: boolean
  onPay: () => void
}

function abbreviate(address: string): string {
  const compact = address.replace(/\s/g, '')
  return compact.length < 14 ? address : `${compact.slice(0, 8)}…${compact.slice(-6)}`
}

export default function PaymentReview({ tab, participant, senderAddress, isSubmitting, onPay }: PaymentReviewProps) {
  return (
    <section className="payment-review" aria-labelledby="payment-review-heading">
      <div className="section-title-row"><h3 id="payment-review-heading">Review payment</h3><span className="recipient-badge">NIM</span></div>
      <dl className="payment-details">
        <div><dt>Tab</dt><dd>{tab.title}</dd></div>
        <div><dt>Slot</dt><dd>{participant.label}</dd></div>
        <div><dt>Amount</dt><dd className="payment-amount">{formatLuna(participant.amountMinor)} NIM</dd></div>
        <div><dt>Recipient</dt><dd>{abbreviate(tab.recipientAddress)}</dd></div>
        <div><dt>Sender</dt><dd>{abbreviate(senderAddress)}</dd></div>
      </dl>
      <p className="payment-note">Nimiq Pay will ask you to approve this exact transfer.</p>
      <button className="button button-primary button-large" type="button" onClick={onPay} disabled={isSubmitting}>
        {isSubmitting ? 'Submitting…' : `Pay ${formatLuna(participant.amountMinor)} NIM`}
      </button>
    </section>
  )
}

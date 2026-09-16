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
      <div className="payment-amount-block">
        <p className="muted-label">Exact amount</p>
        <strong className="payment-amount-value">{formatLuna(participant.amountMinor)} <span>NIM</span></strong>
      </div>
      <dl className="payment-details">
        <div className="payment-detail-recipient"><dt>Recipient</dt><dd><details className="address-details"><summary>{abbreviate(tab.recipientAddress)}</summary><code>{tab.recipientAddress}</code></details></dd></div>
        <div className="payment-detail-sender"><dt>From</dt><dd><details className="address-details"><summary>{abbreviate(senderAddress)}</summary><code>{senderAddress}</code></details></dd></div>
        <div className="payment-context"><dt>Tab</dt><dd>{tab.title}</dd></div>
        <div className="payment-context"><dt>Slot</dt><dd>{participant.label}</dd></div>
      </dl>
      <p className="payment-note"><strong>Sent directly to the Tab recipient.</strong> Nimiq Pay will ask you to approve this exact transfer.</p>
      <button className="button button-primary button-large" type="button" onClick={onPay} disabled={isSubmitting}>
        {isSubmitting ? 'Submitting…' : `Pay ${formatLuna(participant.amountMinor)} NIM`}
      </button>
    </section>
  )
}

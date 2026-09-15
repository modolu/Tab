import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePaymentStatus, usePublicTab, useTabBackend } from '../app/providers'
import PaymentReview from '../components/payments/PaymentReview'
import WalletConnectButton from '../components/wallet/WalletConnectButton'
import { useParticipantSettlement } from '../features/join-tab/useParticipantSettlement'
import { canShowPaymentAction } from '../features/settlement/paymentState'
import { formatLuna } from '../lib/money'
import type { PublicParticipant, PublicTab } from '../lib/types'

function abbreviateAddress(address: string): string {
  const compact = address.replace(/\s/g, '')
  return compact.length < 14 ? address : `${compact.slice(0, 8)}…${compact.slice(-6)}`
}

export default function TabPage() {
  const { slug = '' } = useParams()
  const tab = usePublicTab(slug)
  const backend = useTabBackend()
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [retryingVerification, setRetryingVerification] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const selectedParticipant = tab?.participants.find(({ id }) => id === selectedSlotId)
  const paymentStatus = usePaymentStatus(slug, selectedSlotId ?? '')
  const settlement = useParticipantSettlement(tab ?? emptyTab, selectedParticipant)
  const selectionLocked = settlement.state === 'connecting' || settlement.state === 'submitting'

  if (tab === undefined) return <LoadingState />
  if (!tab) return <StateCard title="Tab not found" copy="This link may be incomplete or the Tab may no longer be available." />

  const paidCount = tab.participants.filter(({ status }) => status === 'paid').length
  const paidAmount = tab.participants.reduce((sum, participant) => participant.status === 'paid' ? sum + BigInt(participant.amountMinor) : sum, 0n)
  const progress = tab.amountMinor === '0' ? 0 : Number((paidAmount * 100n) / BigInt(tab.amountMinor))
  const verificationNeedsRetry = selectedParticipant !== undefined && selectedParticipant.status !== 'paid' && paymentStatus?.status === 'failed'

  async function retryVerification() {
    if (!selectedParticipant || !verificationNeedsRetry || retryingVerification) return
    setRetryError(null)
    setRetryingVerification(true)
    try {
      await backend.retryVerification(slug, selectedParticipant.id)
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'Verification could not be retried. Please try again.')
    } finally {
      setRetryingVerification(false)
    }
  }

  return (
    <div className="page page-tab">
      <header className="page-header"><Link className="back-link" to="/" aria-label="Back to home">←</Link><div><p className="eyebrow">TAB DETAILS</p><h2>{tab.title}</h2></div></header>
      <section className="total-card" aria-labelledby="tab-total">
        <p className="muted-label">Total contribution</p>
        <h1 id="tab-total">{formatLuna(tab.amountMinor)} <span>NIM</span></h1>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Verified payment progress"><span style={{ width: `${progress}%` }} /></div>
        <p className="progress-copy"><strong>{paidCount} of {tab.participants.length}</strong> contributions verified · {formatLuna(paidAmount)} NIM received</p>
      </section>
      {tab.note && <p className="note-card">{tab.note}</p>}
      <section className="content-section" aria-labelledby="shares-heading"><div className="section-title-row"><h3 id="shares-heading">Contributors</h3><span className="count-pill">{tab.participants.length}</span></div><div className="slot-list">{tab.participants.map((participant) => <ParticipantRow key={participant.id} participant={participant} selected={participant.id === selectedSlotId} disabled={selectionLocked} onSelect={() => setSelectedSlotId(participant.id)} />)}</div></section>
      <section className="recipient-card"><div><p className="muted-label">Recipient</p><strong>{abbreviateAddress(tab.recipientAddress)}</strong></div><span className="recipient-badge" aria-hidden="true">NIM</span><p className="sr-only">Payments go directly to the designated Nimiq recipient.</p></section>

      {selectedParticipant && canShowPaymentAction(selectedParticipant.status, paymentStatus) && settlement.state === 'idle' && (
        <section className="payment-action"><p className="payment-action-label">Your assigned share</p><h3>{formatLuna(selectedParticipant.amountMinor)} NIM</h3><p>Selecting a slot does not reserve payment until you connect your wallet.</p><WalletConnectButton onConnect={settlement.connect} /></section>
      )}
      {selectedParticipant && canShowPaymentAction(selectedParticipant.status, paymentStatus) && settlement.state === 'connecting' && <StatusCard title="Connecting wallet" copy="Confirm account access in Nimiq Pay…" />}
      {selectedParticipant && canShowPaymentAction(selectedParticipant.status, paymentStatus) && (settlement.state === 'connecting' || settlement.state === 'ready' || settlement.state === 'submitting') && settlement.walletAddress && (
        <PaymentReview tab={tab} participant={selectedParticipant} senderAddress={settlement.walletAddress} isSubmitting={settlement.state === 'submitting'} onPay={settlement.pay} />
      )}
      {selectedParticipant && verificationNeedsRetry && <StatusCard title="Payment submitted" copy="Payment submitted. Verification needs to be retried." actionLabel={retryingVerification ? 'Retrying verification…' : 'Retry verification'} actionDisabled={retryingVerification} onAction={retryVerification} />}
      {selectedParticipant && selectedParticipant.status === 'pending' && !verificationNeedsRetry && <StatusCard title="Payment submitted" copy="Verifying onchain… Please do not submit another payment for this slot." />}
      {selectedParticipant && selectedParticipant.status === 'paid' && <StatusCard title="This share is paid ✓" copy="The payment was independently verified onchain." />}
      {settlement.error && <p className="form-error" role="alert">{settlement.error}</p>}
      {retryError && <p className="form-error" role="alert">{retryError}</p>}
      {!selectedParticipant && <p className="future-note" role="status">Choose your assigned slot to connect a Nimiq wallet and pay your exact share.</p>}
    </div>
  )
}

const emptyTab: PublicTab = { slug: '', title: '', token: 'NIM', amountMinor: '1', recipientAddress: '', allocationMode: 'equal', status: 'open', participants: [] }

function ParticipantRow({ participant, selected, disabled, onSelect }: { participant: PublicParticipant; selected: boolean; disabled: boolean; onSelect: () => void }) {
  const statusLabel = participant.status === 'paid' ? 'Paid' : participant.status === 'pending' ? 'Verifying onchain' : selected ? 'Selected' : 'Choose this slot'
  const content = <><div className={`status-dot status-${participant.status}`} aria-hidden="true">{participant.status === 'paid' ? '✓' : participant.status === 'pending' ? '…' : ''}</div><div className="slot-name"><strong>{participant.label}</strong><span>{statusLabel}</span></div><strong className="slot-amount">{formatLuna(participant.amountMinor)} NIM</strong></>
  return participant.status === 'unpaid' ? <button className={`slot-row slot-button ${selected ? 'is-selected' : ''}`} type="button" onClick={onSelect} aria-pressed={selected} disabled={disabled}>{content}</button> : <div className="slot-row">{content}</div>
}

function LoadingState() { return <div className="page state-page"><div className="loading-pulse" aria-hidden="true" /><p className="muted-label">Loading Tab…</p></div> }
function StateCard({ title, copy }: { title: string; copy: string }) { return <div className="page state-page"><div className="state-icon" aria-hidden="true">—</div><h2>{title}</h2><p>{copy}</p><Link className="button button-primary" to="/">Back home</Link></div> }
function StatusCard({ title, copy, actionLabel, actionDisabled, onAction }: { title: string; copy: string; actionLabel?: string; actionDisabled?: boolean; onAction?: () => void }) { return <section className="status-card" role="status"><strong>{title}</strong><p>{copy}</p>{actionLabel && onAction && <button className="button button-secondary" type="button" onClick={onAction} disabled={actionDisabled}>{actionLabel}</button>}</section> }

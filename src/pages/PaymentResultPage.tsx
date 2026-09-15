import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { usePaymentStatus, usePublicTab, useTabBackend } from '../app/providers'

export default function PaymentResultPage() {
  const { slug = '', slotId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const txHash = searchParams.get('tx') ?? ''
  const senderAddress = searchParams.get('sender') ?? ''
  const backend = useTabBackend()
  const tab = usePublicTab(slug)
  const status = usePaymentStatus(slug, slotId)
  const [recording, setRecording] = useState(Boolean(txHash && senderAddress))
  const [recordError, setRecordError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!txHash || !senderAddress) { setRecording(false); return () => { active = false } }
    setRecording(true)
    backend.recordSubmittedPayment({ slug, slotId, senderAddress, txHash }).then(() => {
      if (active) { setRecording(false); setRecordError(null) }
    }).catch((error) => {
      if (active) { setRecording(false); setRecordError(error instanceof Error ? error.message : 'The submitted payment could not be saved. Retry below.') }
    })
    return () => { active = false }
  }, [backend, senderAddress, slotId, slug, txHash])

  if (tab === undefined) return <LoadingState />
  if (!tab) return <StateCard title="Tab not found" copy="The payment link is no longer available." />
  const participant = tab.participants.find(({ id }) => id === slotId)
  const isConfirmed = status?.status === 'confirmed' || participant?.status === 'paid'
  const isInvalid = status?.status === 'invalid'
  const isFailed = status?.status === 'failed'
  return (
    <div className="page state-page payment-result-page">
      <div className={`result-icon ${isConfirmed ? 'is-success' : isInvalid || isFailed ? 'is-error' : ''}`} aria-hidden="true">{isConfirmed ? '✓' : isInvalid || isFailed ? '!' : '…'}</div>
      <p className="eyebrow">{tab.title}</p>
      <h2>{isConfirmed ? 'Payment verified' : isInvalid ? 'Payment could not be verified' : isFailed ? 'Verification needs a retry' : 'Payment submitted'}</h2>
      <p>{isConfirmed ? `${participant?.label ?? 'Your'} share is paid.` : isInvalid ? (status?.verificationReason ?? 'This transaction did not match the assigned payment.') : isFailed ? 'Payment submitted. Verification needs to be retried from the Tab. Do not send another payment.' : recording ? 'Saving your transaction securely…' : 'Verifying onchain… Do not submit another payment for this slot.'}</p>
      {recordError && <div className="result-recovery" role="alert"><strong>Transaction hash captured</strong><p>{recordError}</p><button className="button button-secondary" type="button" onClick={() => window.location.reload()}>Retry recording</button></div>}
      {txHash && <p className="tx-hash">Transaction: {txHash.slice(0, 10)}…{txHash.slice(-8)}</p>}
      <Link className="button button-primary" to={`/t/${encodeURIComponent(slug)}`}>{isConfirmed ? 'Back to Tab' : 'View Tab status'}</Link>
    </div>
  )
}

function LoadingState() { return <div className="page state-page"><div className="loading-pulse" aria-hidden="true" /><p className="muted-label">Loading payment status…</p></div> }
function StateCard({ title, copy }: { title: string; copy: string }) { return <div className="page state-page"><div className="state-icon" aria-hidden="true">—</div><h2>{title}</h2><p>{copy}</p><Link className="button button-primary" to="/">Back home</Link></div> }

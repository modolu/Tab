import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTabBackend } from '../app/providers'
import { formatLuna } from '../lib/money'
import type { PublicTab } from '../lib/types'

function abbreviateAddress(address: string): string {
  const compact = address.replace(/\s/g, '')
  return compact.length < 14 ? address : `${compact.slice(0, 8)}…${compact.slice(-6)}`
}

export default function TabPage() {
  const { slug = '' } = useParams()
  const backend = useTabBackend()
  const [tab, setTab] = useState<PublicTab | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    backend.getTabBySlug(slug).then((result) => {
      if (active) { setTab(result); setLoading(false) }
    }).catch(() => {
      if (active) { setError('This Tab could not be loaded. Check your connection and try again.'); setLoading(false) }
    })
    return () => { active = false }
  }, [backend, slug])

  if (loading) return <LoadingState />
  if (error) return <StateCard title="Something went wrong" copy={error} />
  if (!tab) return <StateCard title="Tab not found" copy="This link may be incomplete or the Tab may no longer be available." />

  const paidCount = tab.participants.filter(({ status }) => status === 'paid').length
  const allocated = tab.participants.reduce((sum, participant) => sum + BigInt(participant.amountMinor), 0n)
  const progress = allocated === 0n ? 0 : Math.round((paidCount / tab.participants.length) * 100)

  return (
    <div className="page page-tab">
      <header className="page-header"><Link className="back-link" to="/" aria-label="Back to home">←</Link><div><p className="eyebrow">TAB DETAILS</p><h2>{tab.title}</h2></div></header>
      <section className="total-card" aria-labelledby="tab-total">
        <p className="muted-label">Total contribution</p>
        <h1 id="tab-total">{formatLuna(tab.amountMinor)} <span>NIM</span></h1>
        <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <p className="progress-copy"><strong>{paidCount} of {tab.participants.length}</strong> contributions verified</p>
      </section>
      {tab.note && <p className="note-card">{tab.note}</p>}
      <section className="content-section" aria-labelledby="shares-heading"><div className="section-title-row"><h3 id="shares-heading">Contributors</h3><span className="count-pill">{tab.participants.length}</span></div><div className="slot-list">{tab.participants.map((participant) => <ParticipantRow key={participant.id} {...participant} />)}</div></section>
      <section className="recipient-card"><div><p className="muted-label">Recipient</p><strong>{abbreviateAddress(tab.recipientAddress)}</strong></div><span className="recipient-badge" aria-hidden="true">NIM</span><p className="sr-only">Payments go directly to the designated Nimiq recipient.</p></section>
      <p className="future-note" role="status">Payment actions will be available in the next phase. Your share is reserved for now.</p>
    </div>
  )
}

function ParticipantRow({ label, amountMinor, status }: { label: string; amountMinor: string; status: string }) {
  const statusLabel = status === 'paid' ? 'Paid' : status === 'pending' ? 'Pending' : 'Unpaid'
  return <div className="slot-row"><div className={`status-dot status-${status}`} aria-hidden="true">{status === 'paid' ? '✓' : ''}</div><div className="slot-name"><strong>{label}</strong><span>{statusLabel}</span></div><strong className="slot-amount">{formatLuna(amountMinor)} NIM</strong></div>
}

function LoadingState() { return <div className="page state-page"><div className="loading-pulse" aria-hidden="true" /><p className="muted-label">Loading Tab…</p></div> }

function StateCard({ title, copy }: { title: string; copy: string }) { return <div className="page state-page"><div className="state-icon" aria-hidden="true">—</div><h2>{title}</h2><p>{copy}</p><Link className="button button-primary" to="/">Back home</Link></div> }

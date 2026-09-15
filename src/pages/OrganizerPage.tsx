import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTabBackend } from '../app/providers'
import { formatLuna } from '../lib/money'
import { buildNimiqPayDeepLink, buildShareUrl } from '../lib/share'
import type { PublicTab } from '../lib/types'

export default function OrganizerPage() {
  const { slug = '' } = useParams()
  const backend = useTabBackend()
  const [tab, setTab] = useState<PublicTab | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const shareUrl = buildShareUrl(window.location.origin, slug)

  useEffect(() => {
    let active = true
    const ownerSecret = sessionStorage.getItem(`tab-owner-secret:${slug}`) ?? undefined
    backend.getOrganizerTab(slug, ownerSecret).then((result) => {
      if (active) { setTab(result); setLoading(false) }
    }).catch(() => {
      if (active) { setError('This organizer view could not be loaded.'); setLoading(false) }
    })
    return () => { active = false }
  }, [backend, slug])

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Copy was unavailable. You can select and copy the link below.')
    }
  }

  if (loading) return <div className="page state-page"><div className="loading-pulse" aria-hidden="true" /><p className="muted-label">Creating your share view…</p></div>
  if (error) return <StateCard title="Could not load Tab" copy={error} />
  if (!tab) return <StateCard title="Tab not found" copy="This organizer link is no longer available." />

  const paidCount = tab.participants.filter(({ status }) => status === 'paid').length
  const deeplink = buildNimiqPayDeepLink(shareUrl)
  return (
    <div className="page page-tab organizer-page">
      <header className="page-header"><Link className="back-link" to="/" aria-label="Back to home">←</Link><div><p className="eyebrow">TAB CREATED</p><h2>{tab.title}</h2></div></header>
      <section className="success-card"><span className="success-icon" aria-hidden="true">✓</span><div><h3>Your Tab is ready</h3><p>Share the link with everyone contributing.</p></div></section>
      <section className="total-card organizer-total"><p className="muted-label">Collection total</p><h1>{formatLuna(tab.amountMinor)} <span>NIM</span></h1><p className="progress-copy"><strong>{paidCount} of {tab.participants.length}</strong> contributions verified</p></section>
      <section className="content-section" aria-labelledby="organizer-shares"><div className="section-title-row"><h3 id="organizer-shares">Allocation</h3><Link className="text-link" to={`/t/${encodeURIComponent(slug)}`}>Open participant view</Link></div><div className="slot-list">{tab.participants.map((participant) => <div className="slot-row" key={participant.id}><div className={`status-dot status-${participant.status}`} aria-hidden="true">{participant.status === 'paid' ? '✓' : ''}</div> <div className="slot-name"><strong>{participant.label}</strong><span>{participant.status === 'paid' ? 'Paid' : participant.status === 'pending' ? 'Pending' : 'Unpaid'}</span></div><strong className="slot-amount">{formatLuna(participant.amountMinor)} NIM</strong></div>)}</div></section>
      <section className="recipient-card"><div><p className="muted-label">Recipient</p><strong>{tab.recipientAddress}</strong></div><span className="recipient-badge">NIM</span></section>
      <section className="share-card"><p className="muted-label">Share link</p><div className="share-url">{shareUrl}</div><button className="button button-primary" type="button" onClick={copyShareLink}>{copied ? 'Link copied ✓' : 'Copy share link'}</button><a className="text-link deeplink" href={deeplink}>Open in Nimiq Pay</a></section>
    </div>
  )
}

function StateCard({ title, copy }: { title: string; copy: string }) { return <div className="page state-page"><div className="state-icon" aria-hidden="true">—</div><h2>{title}</h2><p>{copy}</p><Link className="button button-primary" to="/">Back home</Link></div> }

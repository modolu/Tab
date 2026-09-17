import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useOrganizerTab } from '../app/providers'
import { formatLuna } from '../lib/money'
import { buildNimiqPayCustomSchemeDeepLink, buildShareUrl, copyTextToClipboard, shareOrCopyTab } from '../lib/share'

function abbreviateAddress(address: string): string {
  const compact = address.replace(/\s/g, '')
  return compact.length < 14 ? address : `${compact.slice(0, 8)}…${compact.slice(-6)}`
}

export default function OrganizerPage() {
  const { slug = '' } = useParams()
  const ownerSecret = sessionStorage.getItem(`tab-owner-secret:${slug}`) ?? undefined
  const tab = useOrganizerTab(slug, ownerSecret)
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'copied' | 'shared' | 'cancelled' | 'error'>('idle')
  const shareUrl = buildShareUrl(window.location.origin, slug)

  if (!ownerSecret) return <MissingOrganizerAccess slug={slug} />
  if (tab === undefined) return <div className="page state-page" role="status" aria-live="polite" aria-busy="true"><div className="loading-pulse" aria-hidden="true" /><p className="muted-label">Loading your share view…</p></div>
  if (!tab) return <StateCard title="Could not load Tab" copy="This organizer link is no longer available or its private key is missing." />
  const tabTitle = tab.title

  async function shareTab() {
    try {
      const result = await shareOrCopyTab(shareUrl, tabTitle)
      setShareFeedback(result)
      if (result !== 'cancelled') window.setTimeout(() => setShareFeedback('idle'), 2200)
    } catch { setShareFeedback('error') }
  }

  async function copyShareLink() {
    try {
      await copyTextToClipboard(shareUrl)
      setShareFeedback('copied')
      window.setTimeout(() => setShareFeedback('idle'), 2200)
    } catch { setShareFeedback('error') }
  }
  const paidCount = tab.participants.filter(({ status }) => status === 'paid').length
  const paidAmount = tab.participants.reduce((sum, participant) => participant.status === 'paid' ? sum + BigInt(participant.amountMinor) : sum, 0n)
  const progress = tab.amountMinor === '0' ? 0 : Number((paidAmount * 100n) / BigInt(tab.amountMinor))
  const deeplink = buildNimiqPayCustomSchemeDeepLink(shareUrl)
  return (
    <div className="page page-tab organizer-page">
      <header className="page-header"><Link className="back-link" to="/" aria-label="Back to home">←</Link><div><p className="eyebrow">TAB CREATED</p><h2>{tab.title}</h2></div></header>
      <section className={tab.status === 'settled' ? 'settled-card' : 'success-card'} role={tab.status === 'settled' ? 'status' : undefined}><span className="success-icon" aria-hidden="true">✓</span><div><h3>{tab.status === 'settled' ? 'Tab settled' : 'Your Tab is ready'}</h3><p>{tab.status === 'settled' ? 'Every contribution has been verified.' : 'Share the link with everyone contributing.'}</p></div></section>
      <section className="total-card organizer-total"><p className="muted-label">Collection total</p><h1>{formatLuna(tab.amountMinor)} <span>NIM</span></h1><div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Verified payment progress"><span style={{ width: `${progress}%` }} /></div><p className="progress-copy"><strong>{paidCount} of {tab.participants.length}</strong> contributions verified · {formatLuna(paidAmount)} NIM received</p></section>
      <section className="content-section" aria-labelledby="organizer-shares"><div className="section-title-row"><h3 id="organizer-shares">Allocation</h3><Link className="text-link" to={`/t/${encodeURIComponent(slug)}`}>Open participant view</Link></div><div className="slot-list">{tab.participants.map((participant) => <div className="slot-row" key={participant.id}><div className={`status-dot status-${participant.status}`} aria-hidden="true">{participant.status === 'paid' ? '✓' : participant.status === 'pending' ? '…' : ''}</div><div className="slot-name"><strong>{participant.label}</strong><span>{participant.status === 'paid' ? 'Paid' : participant.status === 'pending' ? 'Verifying onchain' : 'Unpaid'}</span></div><strong className="slot-amount">{formatLuna(participant.amountMinor)} NIM</strong></div>)}</div></section>
      <section className="recipient-card"><div><p className="muted-label">Recipient</p><details className="address-details"><summary>{abbreviateAddress(tab.recipientAddress)}</summary><code>{tab.recipientAddress}</code></details></div><span className="recipient-badge">NIM</span></section>
      <section className="share-card"><p className="muted-label">Invite contributors</p><h3>Share this Tab</h3><div className="share-url">{shareUrl}</div><div className="share-actions"><button className="button button-primary" type="button" onClick={shareTab}>Share Tab</button><button className="button button-secondary" type="button" onClick={copyShareLink}>Copy link</button></div>{shareFeedback !== 'idle' && <p className={`share-feedback ${shareFeedback === 'error' ? 'is-error' : ''}`} role="status">{shareFeedback === 'shared' ? 'Share sheet opened ✓' : shareFeedback === 'copied' ? 'Link copied ✓' : shareFeedback === 'cancelled' ? 'Share cancelled' : 'Could not share or copy the link.'}</p>}<a className="text-link deeplink" href={deeplink}>Open in Nimiq Pay</a></section>
    </div>
  )
}

function StateCard({ title, copy }: { title: string; copy: string }) { return <div className="page state-page"><div className="state-icon" aria-hidden="true">—</div><h2>{title}</h2><p>{copy}</p><Link className="button button-primary" to="/">Back home</Link></div> }

function MissingOrganizerAccess({ slug }: { slug: string }) {
  return <div className="page state-page"><div className="state-icon" aria-hidden="true">—</div><h2>Organizer access unavailable</h2><p>Organizer access is only available in the browser session where this Tab was created.</p><div className="state-actions"><Link className="button button-primary" to="/">Back home</Link><Link className="button button-secondary" to={`/t/${encodeURIComponent(slug)}`}>Open participant view</Link></div></div>
}

import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTabBackend } from '../app/providers'
import { allocateEqual } from '../lib/allocation'
import { createOwnerSecret, hashOwnerSecret } from '../lib/ids'
import { formatLuna, parseNimToLuna, parseNimToLunaAllowZero } from '../lib/money'
import { buildShareUrl } from '../lib/share'
import { validateTabDraft } from '../lib/validation'
import type { ParticipantDraft, TabDraft } from '../lib/types'

type FormParticipant = { label: string; amountNim: string }

const initialParticipants: FormParticipant[] = [{ label: '', amountNim: '' }, { label: '', amountNim: '' }]

export default function CreateTabPage() {
  const navigate = useNavigate()
  const backend = useTabBackend()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [totalNim, setTotalNim] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [allocationMode, setAllocationMode] = useState<'equal' | 'custom'>('equal')
  const [participants, setParticipants] = useState<FormParticipant[]>(initialParticipants)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const totalMinor = useMemo(() => {
    try { return parseNimToLuna(totalNim) } catch { return null }
  }, [totalNim])
  const equalAllocations = useMemo(
    () => totalMinor === null ? [] : allocateEqual(totalMinor, participants.length),
    [participants.length, totalMinor],
  )
  const customAllocations = useMemo(() => participants.map(({ amountNim }) => {
    try { return parseNimToLunaAllowZero(amountNim) } catch { return null }
  }), [participants])
  const customTotal = customAllocations.every((amount) => amount !== null)
    ? customAllocations.reduce((sum, amount) => sum + (amount ?? 0n), 0n)
    : null
  const remaining = totalMinor === null || customTotal === null ? null : totalMinor - customTotal

  function updateParticipant(index: number, field: keyof FormParticipant, value: string) {
    setParticipants((current) => current.map((participant, participantIndex) => participantIndex === index
      ? { ...participant, [field]: value }
      : participant))
  }

  function addParticipant() {
    setParticipants((current) => [...current, { label: '', amountNim: '' }])
  }

  function removeParticipant(index: number) {
    if (participants.length <= 1) return
    setParticipants((current) => current.filter((_, participantIndex) => participantIndex !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsCreating(true)
    try {
      const amountMinor = parseNimToLuna(totalNim).toString()
      const draftParticipants: ParticipantDraft[] = participants.map((participant, index) => ({
        label: participant.label,
        amountMinor: allocationMode === 'equal'
          ? equalAllocations[index]?.toString()
          : parseNimToLunaAllowZero(participant.amountNim).toString(),
      }))
      const draft: TabDraft = {
        title,
        note,
        token: 'NIM',
        amountMinor,
        recipientAddress,
        allocationMode,
        participants: draftParticipants,
      }
      validateTabDraft(draft)
      const ownerSecret = createOwnerSecret()
      const ownerSecretHash = await hashOwnerSecret(ownerSecret)
      const result = await backend.createTab({ ...draft, ownerSecretHash })
      sessionStorage.setItem(`tab-owner-secret:${result.slug}`, ownerSecret)
      navigate(`/o/${encodeURIComponent(result.slug)}`)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Could not create this Tab. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="page page-form">
      <header className="page-header">
        <Link className="back-link" to="/" aria-label="Back to home">←</Link>
        <div><p className="eyebrow">NEW TAB</p><h2>Create a Tab</h2></div>
      </header>
      <form onSubmit={handleSubmit} noValidate>
        <section className="form-section" aria-labelledby="details-heading">
          <div className="section-heading"><span className="step-number">1</span><div><h3 id="details-heading">What’s this for?</h3><p>Give your shared cost a clear name.</p></div></div>
          <label>Purpose<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Studio dinner" required /></label>
          <label>Note <span className="optional">Optional</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a little context" rows={2} /></label>
        </section>

        <section className="form-section" aria-labelledby="amount-heading">
          <div className="section-heading"><span className="step-number">2</span><div><h3 id="amount-heading">How much?</h3><p>The total everyone will contribute.</p></div></div>
          <label>Total amount<div className="amount-input"><input inputMode="decimal" value={totalNim} onChange={(event) => setTotalNim(event.target.value)} placeholder="0.00" required /><span>NIM</span></div></label>
        </section>

        <section className="form-section" aria-labelledby="recipient-heading">
          <div className="section-heading"><span className="step-number">3</span><div><h3 id="recipient-heading">Who receives it?</h3><p>Payments go directly to this Nimiq address.</p></div></div>
          <label>Recipient address<input className="address-input" value={recipientAddress} onChange={(event) => setRecipientAddress(event.target.value)} placeholder="NQ…" autoCapitalize="characters" required /></label>
        </section>

        <section className="form-section" aria-labelledby="participants-heading">
          <div className="section-heading"><span className="step-number">4</span><div><h3 id="participants-heading">Who’s contributing?</h3><p>Add each person, then choose how to split the total.</p></div></div>
          <div className="participant-fields">
            {participants.map((participant, index) => (
              <div className="participant-row" key={index}>
                <label className="sr-only" htmlFor={`participant-${index}`}>Participant {index + 1} label</label>
                <input id={`participant-${index}`} value={participant.label} onChange={(event) => updateParticipant(index, 'label', event.target.value)} placeholder={`Participant ${index + 1}`} required />
                {allocationMode === 'custom' && <><label className="sr-only" htmlFor={`share-${index}`}>Share for {participant.label || `participant ${index + 1}`}</label><div className="share-input"><input id={`share-${index}`} inputMode="decimal" value={participant.amountNim} onChange={(event) => updateParticipant(index, 'amountNim', event.target.value)} placeholder="0.00" /><span>NIM</span></div></>}
                <button className="icon-button" type="button" onClick={() => removeParticipant(index)} aria-label={`Remove participant ${index + 1}`} disabled={participants.length <= 1}>×</button>
              </div>
            ))}
          </div>
          <button className="button button-secondary add-button" type="button" onClick={addParticipant}>+ Add participant</button>
          <div className="segmented-control" role="group" aria-label="Allocation mode">
            <button type="button" className={allocationMode === 'equal' ? 'selected' : ''} onClick={() => setAllocationMode('equal')}>Split equally</button>
            <button type="button" className={allocationMode === 'custom' ? 'selected' : ''} onClick={() => setAllocationMode('custom')}>Custom shares</button>
          </div>
          {allocationMode === 'equal' && totalMinor !== null && <div className="allocation-preview"><span>Each share</span><strong>{participants.length ? formatLuna(equalAllocations[0]) : '—'} NIM{equalAllocations.some((amount) => amount !== equalAllocations[0]) && <small> · remainder shared fairly</small>}</strong></div>}
          {allocationMode === 'custom' && <div className={`allocation-preview ${remaining !== null && remaining < 0n ? 'is-error' : ''}`}><span>{remaining === null ? 'Enter every share' : remaining === 0n ? 'All allocated' : 'Remaining'}</span><strong>{remaining === null ? '—' : `${formatLuna(remaining < 0n ? -remaining : remaining)} NIM`} {remaining !== null && remaining < 0n ? 'over' : ''}</strong></div>}
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-large submit-button" type="submit" disabled={isCreating}>{isCreating ? 'Creating…' : 'Review and create Tab'} <span aria-hidden="true">→</span></button>
      </form>
    </div>
  )
}

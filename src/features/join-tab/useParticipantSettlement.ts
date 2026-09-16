import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import { useTabBackend } from '../../app/providers'
import { connectNimiqAccount } from '../../nimiq/account'
import { NimiqAppError } from '../../nimiq/errors'
import { areNimiqAddressesEqual, sendNimPayment } from '../../nimiq/payment'
import type { PublicParticipant, PublicTab } from '../../lib/types'

export type SettlementUiState = 'idle' | 'connecting' | 'ready' | 'submitting'

export function useParticipantSettlement(tab: PublicTab, participant: PublicParticipant | undefined) {
  const backend = useTabBackend()
  const navigate = useNavigate()
  const providerRef = useRef<NimiqProvider | null>(null)
  const referenceRef = useRef<string | null>(null)
  const [state, setState] = useState<SettlementUiState>('idle')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    providerRef.current = null
    referenceRef.current = null
    setState('idle')
    setWalletAddress(null)
    setError(null)
  }, [participant?.id, tab.slug])

  async function connect() {
    if (!participant || participant.status !== 'unpaid' || tab.status !== 'open') return
    setError(null)
    setState('connecting')
    try {
      const account = await connectNimiqAccount()
      const claim = await backend.claimParticipantSlot(tab.slug, participant.id, account.address)
      providerRef.current = account.provider
      referenceRef.current = claim.paymentReference
      setWalletAddress(account.address)
      setState('ready')
    } catch (connectionError) {
      setState('idle')
      setError(connectionError instanceof NimiqAppError ? connectionError.message : 'Wallet connection failed. Please try again.')
    }
  }

  async function pay() {
    if (!participant || !walletAddress || !providerRef.current || !referenceRef.current || state !== 'ready') return
    if (areNimiqAddressesEqual(walletAddress, tab.recipientAddress)) {
      setError('Sender and recipient cannot be the same Nimiq account. Choose a different wallet.')
      return
    }
    setError(null)
    setState('submitting')
    try {
      const txHash = await sendNimPayment(providerRef.current, {
        recipient: tab.recipientAddress,
        amountMinor: participant.amountMinor,
        paymentReference: referenceRef.current,
      })
      navigate(`/payment-result/${encodeURIComponent(tab.slug)}/${encodeURIComponent(participant.id)}?tx=${encodeURIComponent(txHash)}&sender=${encodeURIComponent(walletAddress)}`)
    } catch (paymentError) {
      setState('ready')
      setError(paymentError instanceof NimiqAppError ? paymentError.message : 'Payment failed. Review the amount and try again.')
    }
  }

  return { state, walletAddress, error, connect, pay }
}

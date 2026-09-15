import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TabPage from '../../src/pages/TabPage'
import { usePaymentStatus, usePublicTab, useTabBackend } from '../../src/app/providers'
import { useParticipantSettlement } from '../../src/features/join-tab/useParticipantSettlement'
import type { PaymentStatus, PublicTab } from '../../src/lib/types'

vi.mock('../../src/app/providers', () => ({
  usePaymentStatus: vi.fn(),
  usePublicTab: vi.fn(),
  useTabBackend: vi.fn(),
}))

vi.mock('../../src/features/join-tab/useParticipantSettlement', () => ({
  useParticipantSettlement: vi.fn(),
}))

const retryVerification = vi.fn().mockResolvedValue({ paymentId: 'payment-dolu', txHash: 'a'.repeat(64), status: 'submitted', slotStatus: 'pending' })
const connect = vi.fn()
const pay = vi.fn()

const tab: PublicTab = {
  slug: 'studio-dinner',
  title: 'Studio Dinner',
  token: 'NIM',
  amountMinor: '3000000',
  recipientAddress: 'NQ21 1111 1111 1111 1111 1111 1111 1111 1111',
  allocationMode: 'equal',
  status: 'open',
  participants: [
    { id: 'slot-dolu', label: 'Dolu', amountMinor: '1000000', status: 'pending' },
    { id: 'slot-tester', label: 'Tester', amountMinor: '1000000', status: 'unpaid' },
    { id: 'slot-paid', label: 'Paid friend', amountMinor: '1000000', status: 'paid' },
  ],
}

function renderTab(paymentStatuses: Record<string, PaymentStatus | null | undefined> = {}, tabOverride: PublicTab = tab) {
  vi.mocked(usePublicTab).mockReturnValue(tabOverride)
  vi.mocked(usePaymentStatus).mockImplementation((_slug, slotId) => paymentStatuses[slotId])
  vi.mocked(useTabBackend).mockReturnValue({
    configured: true,
    createTab: vi.fn(),
    getTabBySlug: vi.fn(),
    getOrganizerTab: vi.fn(),
    claimParticipantSlot: vi.fn(),
    recordSubmittedPayment: vi.fn(),
    retryVerification,
    getPaymentStatus: vi.fn(),
  })
  vi.mocked(useParticipantSettlement).mockReturnValue({
    state: 'idle',
    walletAddress: null,
    error: null,
    connect,
    pay,
  })

  return render(
    <MemoryRouter initialEntries={['/t/studio-dinner']}>
      <Routes><Route path="/t/:slug" element={<TabPage />} /></Routes>
    </MemoryRouter>,
  )
}

function paymentStatus(slotId: string, status: PaymentStatus['status']): PaymentStatus {
  return {
    paymentId: `payment-${slotId}`,
    txHash: 'a'.repeat(64),
    status,
    slotStatus: status === 'confirmed' ? 'paid' : 'pending',
    createdAt: 1,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('Tab participant recovery selection', () => {
  it('shows verified progress for an open tab and the settled completion state', () => {
    const progressTab: PublicTab = {
      ...tab,
      amountMinor: '200000',
      participants: [
        { id: 'slot-paid', label: 'Dolu', amountMinor: '100000', status: 'paid' },
        { id: 'slot-open', label: 'Tester', amountMinor: '100000', status: 'unpaid' },
      ],
    }
    const { unmount } = renderTab({}, progressTab)
    expect(screen.getAllByText((_, element) => element?.textContent?.replace(/\s+/g, ' ').includes('1 of 2 contributions verified · 1 NIM received') ?? false).some((element) => element.classList.contains('progress-copy'))).toBe(true)
    unmount()

    renderTab({}, { ...progressTab, status: 'settled', participants: progressTab.participants.map((participant) => ({ ...participant, status: 'paid' })) })
    expect(screen.getByText('Tab settled').closest('section')).toHaveTextContent('Tab settled')
    expect(screen.getAllByText((_, element) => element?.textContent?.replace(/\s+/g, ' ').includes('2 of 2 contributions verified · 2 NIM received') ?? false).some((element) => element.classList.contains('progress-copy'))).toBe(true)
    expect(screen.getByText(/No one left to chase/i)).toBeInTheDocument()
  })

  it('keeps unpaid slots selectable and the unrelated Tester slot payment-ready', async () => {
    const user = userEvent.setup()
    renderTab({ 'slot-tester': null })

    await user.click(screen.getByRole('button', { name: /Tester.*10 NIM/i }))

    expect(screen.getByRole('button', { name: 'Connect Nimiq wallet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pay 10 NIM$/i })).not.toBeInTheDocument()
    expect(connect).not.toHaveBeenCalled()
  })

  it('makes a pending confirming slot inspectable without exposing payment controls', async () => {
    const user = userEvent.setup()
    renderTab({ 'slot-dolu': paymentStatus('slot-dolu', 'confirming') })

    await user.click(screen.getByRole('button', { name: /Dolu.*10 NIM/i }))

    expect(screen.getByText(/Verifying onchain… Please do not submit another payment/i)).toBeInTheDocument()
    expect(screen.getByText(/Do not submit another payment/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect Nimiq wallet' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pay 10 NIM$/i })).not.toBeInTheDocument()
  })

  it('exposes retry for a pending failed payment without invoking wallet or submission APIs', async () => {
    const user = userEvent.setup()
    renderTab({ 'slot-dolu': paymentStatus('slot-dolu', 'failed') })

    await user.click(screen.getByRole('button', { name: /Dolu.*10 NIM/i }))

    expect(screen.getByText(/Verification needs to be retried/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry verification' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect Nimiq wallet' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pay 10 NIM$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry verification' }))

    expect(retryVerification).toHaveBeenCalledWith('studio-dinner', 'slot-dolu')
    expect(connect).not.toHaveBeenCalled()
    expect(pay).not.toHaveBeenCalled()
  })

  it('does not make paid slots selectable or offer payment', async () => {
    renderTab()

    expect(screen.queryByRole('button', { name: /Paid friend.*1 NIM/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Paid · verified onchain/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect Nimiq wallet' })).not.toBeInTheDocument()
  })
})

import { renderHook, act } from '@testing-library/react'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useParticipantSettlement } from '../../src/features/join-tab/useParticipantSettlement'
import type { PublicParticipant, PublicTab } from '../../src/lib/types'

const mocks = vi.hoisted(() => ({
  claimParticipantSlot: vi.fn(),
  connectNimiqAccount: vi.fn(),
  navigate: vi.fn(),
  sendNimPayment: vi.fn(),
}))

vi.mock('../../src/app/providers', () => ({
  useTabBackend: () => ({ claimParticipantSlot: mocks.claimParticipantSlot }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}))

vi.mock('../../src/nimiq/account', () => ({
  connectNimiqAccount: mocks.connectNimiqAccount,
}))

vi.mock('../../src/nimiq/payment', async () => {
  const actual = await vi.importActual<typeof import('../../src/nimiq/payment')>('../../src/nimiq/payment')
  return { ...actual, sendNimPayment: mocks.sendNimPayment }
})

const participant: PublicParticipant = { id: 'slot-1', label: 'Dolu', amountMinor: '100000', status: 'unpaid' }
const tab: PublicTab = {
  slug: 'studio-dinner',
  title: 'Studio Dinner',
  token: 'NIM',
  amountMinor: '100000',
  recipientAddress: 'NQ21 1111 1111 1111 1111 1111 1111 1111 1111',
  allocationMode: 'equal',
  status: 'open',
  participants: [participant],
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('participant settlement sender protection', () => {
  it('blocks a sender that matches the recipient before payment submission', async () => {
    mocks.connectNimiqAccount.mockResolvedValue({
      address: 'nq2111111111111111111111111111111111',
      provider: {} as NimiqProvider,
    })
    mocks.claimParticipantSlot.mockResolvedValue({ paymentReference: 'TAB:abc:s0' })

    const { result } = renderHook(() => useParticipantSettlement(tab, participant))

    await act(async () => { await result.current.connect() })
    expect(result.current.state).toBe('ready')

    await act(async () => { await result.current.pay() })

    expect(result.current.error).toBe('Sender and recipient cannot be the same Nimiq account. Choose a different wallet.')
    expect(mocks.sendNimPayment).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})

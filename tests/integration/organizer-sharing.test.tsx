import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OrganizerPage from '../../src/pages/OrganizerPage'
import { useOrganizerTab } from '../../src/app/providers'
import type { PublicTab } from '../../src/lib/types'

vi.mock('../../src/app/providers', () => ({
  useOrganizerTab: vi.fn(),
}))

const tab: PublicTab = {
  slug: 'tab-ef7a1d7fcb7f4d43',
  title: 'Studio Dinner',
  token: 'NIM',
  amountMinor: '1000000',
  recipientAddress: 'NQ21 1111 1111 1111 1111 1111 1111 1111 1111',
  allocationMode: 'equal',
  status: 'open',
  participants: [{ id: 'slot-1', label: 'Dolu', amountMinor: '1000000', status: 'unpaid' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  vi.mocked(useOrganizerTab).mockReturnValue(tab)
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

describe('Organizer sharing', () => {
  it('launches the participant route with the Nimiq Pay custom scheme while sharing the ordinary URL', () => {
    sessionStorage.setItem('tab-owner-secret:tab-ef7a1d7fcb7f4d43', 'raw-owner-secret')
    render(
      <MemoryRouter initialEntries={['/o/tab-ef7a1d7fcb7f4d43']}>
        <Routes><Route path="/o/:slug" element={<OrganizerPage />} /></Routes>
      </MemoryRouter>,
    )

    const launcher = screen.getByRole('link', { name: 'Open in Nimiq Pay' })
    const launcherUrl = new URL(launcher.getAttribute('href') ?? '')
    expect(launcher.getAttribute('href')).toMatch(/^nimiqpay:\/\/miniapp\?url=/)
    expect(launcherUrl.searchParams.get('url')).toBe('http://localhost:3000/t/tab-ef7a1d7fcb7f4d43')
    expect(screen.getByText('localhost:3000/t/tab-ef7a1d7fcb7f4d43')).toBeInTheDocument()
    expect(screen.getByText('Participant link')).toBeInTheDocument()
    expect(screen.queryByText('raw-owner-secret')).not.toBeInTheDocument()
    expect(launcher.getAttribute('href')).not.toContain('raw-owner-secret')
  })

  it('explains missing organizer access without waiting for a skipped query', () => {
    vi.mocked(useOrganizerTab).mockReturnValue(undefined)
    render(
      <MemoryRouter initialEntries={['/o/tab-ef7a1d7fcb7f4d43']}>
        <Routes><Route path="/o/:slug" element={<OrganizerPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Organizer access is only available in the browser session where this Tab was created.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Open participant view' })).toHaveAttribute('href', '/t/tab-ef7a1d7fcb7f4d43')
    expect(screen.queryByText('Loading your share view…')).not.toBeInTheDocument()
  })
})

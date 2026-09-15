import { ConvexProvider, ConvexReactClient, useQuery } from 'convex/react'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { anyApi } from 'convex/server'
import type { CreateTabInput, CreateTabResult, PaymentStatus, PublicTab, SlotClaimResult, SubmittedPaymentResult } from '../lib/types'

export type TabBackend = {
  configured: boolean
  createTab: (input: CreateTabInput) => Promise<CreateTabResult>
  getTabBySlug: (slug: string) => Promise<PublicTab | null>
  getOrganizerTab: (slug: string, ownerSecret?: string) => Promise<PublicTab | null>
  claimParticipantSlot: (slug: string, slotId: string, walletAddress: string) => Promise<SlotClaimResult>
  recordSubmittedPayment: (input: { slug: string; slotId: string; senderAddress: string; txHash: string }) => Promise<SubmittedPaymentResult>
  retryVerification: (slug: string, slotId: string) => Promise<SubmittedPaymentResult>
  getPaymentStatus: (slug: string, slotId: string) => Promise<PaymentStatus | null>
}

const BackendContext = createContext<TabBackend | null>(null)

export const missingConvexUrlMessage =
  'Tab cannot start because VITE_CONVEX_URL is missing. Run `npx convex dev`, then restart the Vite server.'

export function requireConvexUrl(value: string | undefined): string {
  const url = value?.trim()
  if (!url) throw new Error(missingConvexUrlMessage)

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error()
  } catch {
    throw new Error('VITE_CONVEX_URL must be a valid http(s) Convex deployment URL.')
  }

  return url
}

export function createConvexBackend(client: ConvexReactClient): TabBackend {
  return {
    configured: true,
    createTab: (input) => client.mutation(anyApi.tabs.createTab, input),
    getTabBySlug: (slug) => client.query(anyApi.tabs.getTabBySlug, { slug }),
    getOrganizerTab: (slug, ownerSecret) => client.query(
      anyApi.tabs.getOrganizerTab,
      ownerSecret ? { slug, ownerSecret } : { slug },
    ),
    claimParticipantSlot: (slug, slotId, walletAddress) => client.mutation(anyApi.participants.claimParticipantSlot, { slug, slotId, walletAddress }),
    recordSubmittedPayment: (input) => client.mutation(anyApi.payments.recordSubmittedPayment, input),
    retryVerification: (slug, slotId) => client.mutation(anyApi.payments.retryVerification, { slug, slotId }),
    getPaymentStatus: (slug, slotId) => client.query(anyApi.payments.getPaymentStatus, { slug, slotId }),
  }
}

export function usePublicTab(slug: string): PublicTab | null | undefined {
  return useQuery(anyApi.tabs.getTabBySlug, slug ? { slug } : 'skip') as PublicTab | null | undefined
}

export function useOrganizerTab(slug: string, ownerSecret?: string): PublicTab | null | undefined {
  return useQuery(anyApi.tabs.getOrganizerTab, ownerSecret ? { slug, ownerSecret } : 'skip') as PublicTab | null | undefined
}

export function usePaymentStatus(slug: string, slotId: string): PaymentStatus | null | undefined {
  return useQuery(anyApi.payments.getPaymentStatus, slug && slotId ? { slug, slotId } : 'skip') as PaymentStatus | null | undefined
}

export function AppProviders({ children }: { children: ReactNode }) {
  let convexUrl: string
  try {
    convexUrl = requireConvexUrl(import.meta.env.VITE_CONVEX_URL as string | undefined)
  } catch (error) {
    return <ConfigurationError message={error instanceof Error ? error.message : missingConvexUrlMessage} />
  }

  return <ConfiguredAppProviders convexUrl={convexUrl}>{children}</ConfiguredAppProviders>
}

function ConfiguredAppProviders({ convexUrl, children }: { convexUrl: string; children: ReactNode }) {
  const client = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl])
  const backend = useMemo(() => createConvexBackend(client), [client])

  const content = <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>
  return <ConvexProvider client={client}>{content}</ConvexProvider>
}

function ConfigurationError({ message }: { message: string }) {
  return (
    <div className="page state-page" role="alert">
      <p className="eyebrow">CONFIGURATION REQUIRED</p>
      <h1>Tab needs Convex</h1>
      <p>{message}</p>
    </div>
  )
}

export function useTabBackend(): TabBackend {
  const backend = useContext(BackendContext)
  if (!backend) throw new Error('Tab backend is not available.')
  return backend
}

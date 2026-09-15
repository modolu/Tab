import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { anyApi } from 'convex/server'
import type { CreateTabInput, CreateTabResult, PublicTab } from '../lib/types'
import { createSlug } from '../lib/ids'

export type TabBackend = {
  configured: boolean
  createTab: (input: CreateTabInput) => Promise<CreateTabResult>
  getTabBySlug: (slug: string) => Promise<PublicTab | null>
  getOrganizerTab: (slug: string, ownerSecretHash?: string) => Promise<PublicTab | null>
}

const BackendContext = createContext<TabBackend | null>(null)

function createLocalBackend(): TabBackend {
  const records = new Map<string, PublicTab>()

  return {
    configured: false,
    async createTab(input) {
      const slug = `local-${createSlug()}`
      const participants = input.participants.map((participant, index) => ({
        id: `${slug}-${index}`,
        label: participant.label.trim(),
        amountMinor: participant.amountMinor ?? '0',
        status: 'unpaid' as const,
      }))
      const tab: PublicTab = {
        slug,
        title: input.title.trim(),
        note: input.note?.trim() || undefined,
        token: 'NIM',
        amountMinor: input.amountMinor,
        recipientAddress: input.recipientAddress,
        allocationMode: input.allocationMode,
        status: 'open',
        participants,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      records.set(slug, tab)
      return { tabId: slug, slug, participantSlotIds: participants.map(({ id }) => id) }
    },
    async getTabBySlug(slug) {
      return records.get(slug) ?? null
    },
    async getOrganizerTab(slug) {
      return records.get(slug) ?? null
    },
  }
}

export function AppProviders({ children }: { children: ReactNode }) {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
  const client = useMemo(() => convexUrl ? new ConvexReactClient(convexUrl) : null, [convexUrl])
  const backend = useMemo<TabBackend>(() => {
    if (!client) return createLocalBackend()
    return {
      configured: true,
      createTab: (input) => client.mutation(anyApi.tabs.createTab, input),
      getTabBySlug: (slug) => client.query(anyApi.tabs.getTabBySlug, { slug }),
      getOrganizerTab: (slug, ownerSecretHash) => client.query(anyApi.tabs.getOrganizerTab, { slug, ownerSecretHash }),
    }
  }, [client])

  const content = <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>
  return client ? <ConvexProvider client={client}>{content}</ConvexProvider> : content
}

export function useTabBackend(): TabBackend {
  const backend = useContext(BackendContext)
  if (!backend) throw new Error('Tab backend is not available.')
  return backend
}

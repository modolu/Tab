import { defineApp } from 'convex/server'
import { v } from 'convex/values'

const app = defineApp({
  env: {
    NIMIQ_RPC_URL: v.optional(v.string()),
    NIMIQ_NETWORK: v.optional(v.string()),
    NIMIQ_RPC_USERNAME: v.optional(v.string()),
    NIMIQ_RPC_PASSWORD: v.optional(v.string()),
    NIMIQ_ENABLE_DEV_DIAGNOSTICS: v.optional(v.string()),
  },
})

export default app

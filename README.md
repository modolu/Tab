# Tab

Tab is a Nimiq Pay Mini App for collecting one shared obligation from multiple contributors through direct, non-custodial NIM payments.

## Current state

Phase 1 is implemented: create a NIM Tab, allocate exact Luna shares, persist the Tab and participant slots in Convex, generate a share URL, and open the public participant view. Wallet settlement and transaction verification are intentionally deferred to Phase 2.

## Development

```bash
npm install
npm run dev -- --host
```

For Convex persistence, set `VITE_CONVEX_URL` in `.env.local` to the URL for a Convex deployment. The app shows an actionable configuration error if it is missing; it never substitutes in-memory persistence. Open the Vite Network URL in Nimiq Pay for mobile WebView testing. See [ARCHITECTURE.md](./ARCHITECTURE.md) and [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) for the technical and product source of truth.

To run Convex locally against a configured deployment, use `npx convex dev` in a separate terminal. The Convex schema and functions live in `convex/`.

## Scope

P0 is deliberately NIM-only:

`Create Tab → allocate shares → share → participant opens → pay NIM → verify onchain → realtime status → settled`

USDT, recurring billing, AI features, complex authentication, debt-netting, and additional chains are out of scope for the competition MVP.

# Tab

Tab is a Nimiq Pay Mini App for collecting one shared obligation from multiple contributors through direct, non-custodial NIM payments.

## Current state

The repository is scaffolded for the Cycle II MVP. Phase 1 will add the deterministic domain core and create/share/join state without starting wallet settlement.

## Development

```bash
npm install
npm run dev -- --host
```

Open the Vite Network URL in Nimiq Pay for mobile WebView testing. See [ARCHITECTURE.md](./ARCHITECTURE.md) and [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) for the technical and product source of truth.

## Scope

P0 is deliberately NIM-only:

`Create Tab → allocate shares → share → participant opens → pay NIM → verify onchain → realtime status → settled`

USDT, recurring billing, AI features, complex authentication, debt-netting, and additional chains are out of scope for the competition MVP.

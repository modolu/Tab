# Tab

Tab is a Nimiq Pay Mini App for collecting one shared obligation from multiple contributors through direct, non-custodial NIM payments.

## Current state

Phase 2 is implemented: participants claim a slot with an explicitly connected Nimiq account, review and approve an exact NIM payment, and see the submitted transaction independently verified before the slot becomes paid. Convex reactive queries update the organizer view and settle the Tab after every slot is verified.

## Development

```bash
npm install
npm run dev -- --host
```

For Convex persistence, set `VITE_CONVEX_URL` in `.env.local` to the URL for a Convex deployment. The app shows an actionable configuration error if it is missing; it never substitutes in-memory persistence. Configure the Convex deployment with `NIMIQ_NETWORK` and `NIMIQ_RPC_URL` using `npx convex env set`; the values must describe the same network. Use `NIMIQ_NETWORK=testnet` with `https://rpc.testnet.nimiqwatch.com`, or `NIMIQ_NETWORK=mainnet` with `https://rpc.nimiqwatch.com`. The endpoint remains environment-configurable; use a dedicated authenticated endpoint for production where possible, with optional `NIMIQ_RPC_USERNAME` and `NIMIQ_RPC_PASSWORD` kept server-side. Open the Vite Network URL in Nimiq Pay for mobile WebView testing. See [ARCHITECTURE.md](./ARCHITECTURE.md) and [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) for the technical and product source of truth.

To run Convex locally against a configured deployment, use `npx convex dev` in a separate terminal. The Convex schema and functions live in `convex/`.

## Scope

P0 is deliberately NIM-only:

`Create Tab → allocate shares → share → participant opens → pay NIM → verify onchain → realtime status → settled`

USDT, recurring billing, AI features, complex authentication, debt-netting, and additional chains are out of scope for the competition MVP.

Verification uses the current PoS JSON-RPC methods `getTransactionByHash`, `getTransactionFromMempool`, `getLatestBlock`, `getBlockByNumber`, and `getNetworkId`. A transaction is shown as paid only when its recipient, sender, Luna value, recipient data reference, execution result, configured network, and batch macro-block finality all match. The verifier checks `getLatestBlock.network` before transaction lookup: `TestAlbatross` is required for testnet and `MainAlbatross` for mainnet. A missing or mempool transaction remains confirming and is retried six times with bounded delays (5s, 10s, 20s, 40s, 60s); exhausted or unavailable verification leaves the payment failed but the slot pending, so the existing transaction can be retried without sending another payment. The reference format is `TAB:<tab-short-id>:<slot-short-id>` and is validated as UTF-8 ≤64 bytes.

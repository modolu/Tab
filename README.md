# Tab

Shared costs, settled.

Tab is a Nimiq Pay Mini App for turning one group expense into a clear, shareable flow: create the amount, assign shares, send one link, and receive direct NIM payments without holding anyone's funds.

## Why Tab

Splitwise is useful for tracking balances over time. Tab is deliberately smaller and more immediate: one obligation, one recipient, and a verified path to settled. Everyone sees the same progress, and the organizer does not need to chase screenshots or reconcile promises.

## How it works

1. Create a Tab with a purpose, total, recipient, and participant shares.
2. Share the participant link or open it through Nimiq Pay.
3. Each participant selects their assigned slot, explicitly connects Nimiq, reviews the exact amount, and approves a native NIM payment.
4. Convex records the transaction hash, then independently checks the Nimiq network, recipient, amount, reference, execution result, and macro-block finality.
5. Verified shares become Paid. When every share is verified, the Tab becomes Settled.

The physical P0 flow has been proven on a real iPhone inside Nimiq Pay using Nimiq TestAlbatross testnet. Mainnet support is configuration-ready but has not been claimed as physically tested here.

## Nimiq Pay and security

Tab uses the official `@nimiq/mini-app-sdk` only at the wallet boundary. `listAccounts()` is called after an explicit user action, and `sendBasicTransactionWithData()` opens native Nimiq Pay approval. Tab never requests seed phrases, stores private keys, or signs on a server. Payments go directly to the configured recipient.

A transaction hash means submitted, not paid. Only the Convex verifier can mark a payment confirmed and a slot paid. Organizer ownership continues to use the client-generated secret/session model; public Tab queries exclude the owner secret hash.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev -- --host
```

Set `VITE_CONVEX_URL` in `.env.local` to a Convex deployment URL. The app reports missing configuration instead of substituting in-memory persistence. Run `npx convex dev` in a separate terminal when developing Convex functions.

Configure the Convex deployment with `npx convex env set`:

```text
NIMIQ_NETWORK=testnet
NIMIQ_RPC_URL=https://rpc.testnet.nimiqwatch.com
```

The documented example endpoints are:

```text
Mainnet: https://rpc.nimiqwatch.com
Testnet: https://rpc.testnet.nimiqwatch.com
```

The endpoint remains environment-configurable. Use a dedicated authenticated provider for production where possible; optional `NIMIQ_RPC_USERNAME` and `NIMIQ_RPC_PASSWORD` stay server-side and must never be placed in browser environment variables. The official local Mini App flow may use the Vite LAN URL over HTTP in Nimiq Pay.

### Production release

Keep the development Convex deployment and production Convex deployment separate. On the authenticated production target, set `NIMIQ_NETWORK=mainnet`, `NIMIQ_RPC_URL=https://rpc.nimiqwatch.com`, and leave `NIMIQ_ENABLE_DEV_DIAGNOSTICS` absent or `false`. Deploy Convex with the current CLI workflow (`npx convex deploy --prod`) only after confirming the target and credentials. Set the resulting production Convex URL as Vercel's `VITE_CONVEX_URL` build environment variable. The included [vercel.json](./vercel.json) rewrites direct SPA routes back to `index.html` so `/t/:slug`, `/o/:slug`, and payment routes survive refresh.

The testnet pairing remains `NIMIQ_NETWORK=testnet` with `https://rpc.testnet.nimiqwatch.com`. Never copy testnet payment records into production, and never put Convex or RPC secrets in Vite/browser environment variables.

## Architecture

The frontend is React + Vite. Convex provides the schema, mutations, reactive public queries, and server-side verification actions. The Nimiq provider adapter keeps wallet calls out of UI components. Internal money values remain integer Luna strings; conversion to the SDK's safe JavaScript number happens only at the transaction boundary.

The payment reference is deterministic and compact: `TAB:<tab-short-id>:<slot-short-id>`, encoded as UTF-8 in at most 64 bytes. Verification uses `getLatestBlock`, `getTransactionByHash`, `getTransactionFromMempool`, and `getMacroBlockAfter`. A transaction is final when `getLatestBlock.number >= getMacroBlockAfter(transaction.blockNumber)`. Temporary absence or RPC failure remains retryable; exhausted verification never reopens a submitted slot for a second payment.

For development-only verifier diagnostics, set `NIMIQ_ENABLE_DEV_DIAGNOSTICS=true` on the Convex deployment and run:

```bash
npx convex run verification:devDiagnoseNimiqPayment '{"paymentId":"<payment-id>"}'
```

This read-only action accepts only a stored payment ID, is environment-gated and disabled by default, and must be disabled or removed before production submission. It is not exposed in the public UI.

## Commands

```bash
npm test
npm run lint
npm run typecheck
npm run build
npx convex dev --once
```

See [docs/QA_CHECKLIST.md](./docs/QA_CHECKLIST.md) for the manual mobile checklist. [ARCHITECTURE.md](./ARCHITECTURE.md) and [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) remain the technical and product source of truth.

## Competition scope

The current P0 is intentionally NIM-only: create, split, share, pay, independently verify, and settle. USDT, Polygon and other chains, recurring billing, saved groups, notifications, social login, debt netting, AI, itemized allocation, chat, and analytics platforms are deferred. Lightweight aggregate counts can be read from existing Convex data for competition reporting; Tab does not collect unnecessary personal information.

## Competition release

Tab is a group payment collection Mini App built inside Nimiq Pay. It coordinates one shared obligation, one recipient, and multiple direct contributors. Nimiq Pay supplies account permission and native transaction approval; the payment reference identifies the assigned slot; Convex independently verifies the raw Nimiq transaction and macro-block finality; reactive queries show live progress and settlement. Funds move contributor → recipient directly, with no seed phrase, private key, or custodial balance handled by Tab. Tab is not a Splitwise clone: it resolves one immediate collection instead of becoming a long-lived expense ledger.

The complete P0 flow was physically validated on Nimiq Pay TestAlbatross testnet. See [release QA](./docs/RELEASE_QA.md), [tester guide](./docs/TESTER_GUIDE.md), and the [submission draft](./docs/SUBMISSION.md). No mainnet physical payment is claimed until it is manually performed.

## License

MIT. Built for the Nimiq Pay Mini App competition.

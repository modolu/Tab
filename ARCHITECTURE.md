# TAB — ARCHITECTURE.md

> **Shared costs, settled.**
>
> Tab is a Nimiq Pay Mini App for creating a shared payment tab, allocating contributions, inviting participants, and settling each share directly onchain — without custody, awkward wallet-address copying, or a separate payment app.

---

## 0. Document Status

**Role:** Technical source of truth for the Tab codebase.

**Competition:** Nimiq Mini Apps Competition — Cycle II.

**Primary target:** A polished, functional Nimiq Pay Mini App that can be used by a real group immediately.

**Architecture rule:** If implementation materially diverges from this document, update this document first or document the reason in the pull request/commit.

**MVP constraint:** Prioritize a complete, reliable, mobile-first end-to-end payment flow over feature count.

---

# 1. Executive Summary

Tab turns a shared cost into a lightweight, shareable payment object.

A creator opens a **Tab** for something like:

- rent;
- group dinner;
- birthday gift;
- event contribution;
- team subscription;
- house internet;
- group order;
- shared transport.

They define:

```text
what the tab is for
recipient
currency/token
amount
participants
allocation method
optional due date
```

Tab calculates the contribution owed by each participant and creates a shareable link/deeplink. Participants open the Tab inside Nimiq Pay, see exactly what they owe, approve a wallet transaction, and immediately appear as paid once the transaction is verified.

The core experience is:

```text
CREATE TAB
    ↓
ALLOCATE SHARES
    ↓
SHARE LINK
    ↓
PARTICIPANTS PAY IN NIM
    ↓
VERIFY ONCHAIN
    ↓
LIVE STATUS
    ↓
TAB SETTLED
```

Tab is **not** a portfolio tool, expense ledger, debt graph, or trip expense tracker.

Its product primitive is a **payment collection tab**: one obligation, one destination, multiple contributors, clear settlement state.

---

# 2. Originality Boundary

The competition already contains expense-splitting products, including a prior Cycle I submission that tracks shared expenses and calculates settlement paths.

Tab therefore deliberately avoids the following product shape:

```text
multiple expenses
→ who paid for what
→ net debts between everyone
→ shortest settlement graph
```

Tab instead implements:

```text
one shared obligation
→ assign shares
→ direct participant-to-recipient payments
→ real-time collection progress
```

This distinction is architectural, not cosmetic.

## 2.1 Tab will not implement in the MVP

- multi-expense debt ledgers;
- reimbursement graphs;
- shortest-path/net-debt settlement algorithms;
- trip expense history;
- “A owes B, B owes C” simplification.

## 2.2 Tab’s core differentiation

- collection-first rather than reimbursement-first;
- organizer creates the amount before or after a shared purchase;
- every contributor pays the designated recipient directly;
- non-custodial;
- payment state is verified onchain;
- no Tab-controlled escrow;
- shareable link is the core acquisition loop;
- recurring real-world use cases extend beyond travel.

---

# 3. Product Principles

## 3.1 Payment is the product, not an integration checkbox

A Tab is incomplete until money moves through Nimiq Pay.

Nimiq wallet access, transaction approval, transaction submission, and verification are core application behavior.

## 3.2 Non-custodial by default

Tab never receives or holds participant funds.

Payments flow directly:

```text
participant wallet → recipient wallet
```

## 3.3 One-screen comprehension

Within seconds, a participant must understand:

```text
What is this for?
How much do I owe?
Who receives it?
Has anyone else paid?
What button do I press?
```

## 3.4 Mobile-first, Nimiq Pay-first

Tab is designed for Nimiq Pay’s embedded WebView before desktop browser optimization.

## 3.5 Onchain truth over client claims

A participant cannot mark themselves paid manually.

Payment state is derived from a real transaction hash and validated transaction data.

## 3.6 Graceful refusal is normal UX

Wallet permission denial, transaction cancellation, insufficient funds, stale tabs, and network failure are expected outcomes and must have clear recovery states.

## 3.7 Minimal personal data

Tab stores only what is needed to coordinate a payment collection. No seed phrases, private keys, unnecessary identity information, or hidden tracking.

---

# 4. Target Users

## Primary

Crypto-native friend groups and small teams who already use wallets and need to collect shared payments quickly.

## Secondary

- housemates;
- creators collecting group contributions;
- communities;
- event organizers;
- small clubs;
- teams paying recurring group costs;
- families already using Nimiq Pay.

---

# 5. Core User Stories

## Organizer

```text
As an organizer,
I want to create one shared payment tab,
so everyone knows exactly what to pay and I can see settlement progress without chasing people manually.
```

## Participant

```text
As a participant,
I want to open one link and pay my assigned share from my wallet,
so I do not have to copy an address, calculate an amount, or send proof separately.
```

## Organizer after payment

```text
As an organizer,
I want Tab to verify payments onchain automatically,
so nobody has to send screenshots or claim they already paid.
```

---

# 6. MVP Feature Set

## P0 — Required

1. Create a Tab.
2. Set title/purpose.
3. Set total amount.
4. Set recipient wallet.
5. Choose allocation:
   - equal split;
   - custom amounts.
6. Add participant labels/names.
7. Generate shareable Tab URL.
8. Open inside Nimiq Pay.
9. Connect Nimiq wallet via Mini App SDK.
10. Participant selects/claims their slot.
11. Pay assigned share in NIM.
12. Embed Tab identifier in transaction data where appropriate.
13. Store transaction hash.
14. Verify payment server-side/onchain.
15. Live/realtime progress UI.
16. Paid/pending/unpaid states.
17. Organizer view.
18. Participant view.
19. Copy/share native deeplink.
20. Mobile-first responsive UX.
21. Error and cancellation handling.

## P1 — High-value if time permits

- due date;
- reminders/share action;
- itemized allocation helper;
- payment receipt screen;
- Tab completion celebration;
- NIM amount + optional fiat estimate;
- USDT on Polygon as a second payment rail.

## P2 — Post-hackathon

- recurring tabs;
- saved groups;
- payment reminders/push;
- USDT on more chains;
- Tab templates;
- merchant/group-order mode;
- CSV export;
- recurring subscriptions;
- optional organizer wallet-signature authentication.

---

# 7. Nimiq Integration Strategy

Tab will use Nimiq Pay deeply enough that removing Nimiq Pay would remove the main product experience.

## 7.1 Nimiq provider

Use:

```ts
import { init } from '@nimiq/mini-app-sdk'
```

Core methods:

```text
listAccounts()
isConsensusEstablished()
getBlockNumber()
sendBasicTransaction()
sendBasicTransactionWithData()
```

Preferred settlement call:

```text
sendBasicTransactionWithData
```

because the transaction data field can carry a compact Tab payment reference.

Example logical data:

```text
TAB:<tabShortId>:<slotShortId>
```

The exact byte-length constraints must be verified against current provider/network limits before implementation.

## 7.2 Why NIM is P0

NIM should be the primary MVP rail because:

- it demonstrates native Nimiq integration;
- Nimiq wallet operations are directly supported by the Mini App SDK;
- it avoids the additional native gas-token requirement introduced by EVM ERC-20 transfers;
- it gives the project a stronger Nimiq-specific identity.

## 7.3 USDT as P1

USDT on Polygon can be supported via:

```text
window.ethereum
wallet_switchEthereumChain
eth_call
eth_sendTransaction
```

Use `viem` for ABI encoding and unit conversion.

Do not compromise NIM flow quality to add USDT.

---

# 8. High-Level Architecture

```text
┌───────────────────────────────────────────┐
│              NIMIQ PAY APP                │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │           TAB MINI APP              │  │
│  │ React + TypeScript + Vite           │  │
│  │                                     │  │
│  │ Create / Join / Pay / Status        │  │
│  └───────────────┬─────────────────────┘  │
│                  │                        │
│      injected Nimiq provider              │
│                  │                        │
│         native confirmations              │
└──────────────────┼────────────────────────┘
                   │
         direct blockchain payment
                   │
                   ▼
          ┌─────────────────┐
          │ NIMIQ NETWORK   │
          └────────┬────────┘
                   │
                   │ verification
                   ▼
┌───────────────────────────────────────────┐
│             TAB BACKEND                   │
│                                           │
│  Convex                                   │
│  ├── tabs                                 │
│  ├── participant slots                    │
│  ├── payment intents                      │
│  ├── transaction verification             │
│  └── realtime status                      │
└──────────────────┬────────────────────────┘
                   │
                   ▼
            reactive client UI
```

---

# 9. Recommended Technology Stack

## Frontend

```text
React
TypeScript
Vite
Tailwind CSS or disciplined CSS variables/components
@nimiq/mini-app-sdk
viem (only for EVM/USDT support)
```

Why Vite instead of Next.js for the Mini App shell:

- aligns closely with official Nimiq examples;
- simple static deployment;
- small client footprint;
- no unnecessary server-rendering assumptions inside a WebView;
- fast local-network testing on a phone.

## Backend

```text
Convex
```

Use Convex for:

- tab persistence;
- participant-slot state;
- realtime payment progress;
- mutation validation;
- transaction-verification jobs/actions;
- idempotency.

A different backend may be substituted if implementation constraints require it, but do not add a conventional API server purely for ceremony.

## Deployment

```text
Frontend: Vercel
Backend: Convex cloud
Wallet host: Nimiq Pay
```

---

# 10. Repository Structure

```text
tab/
├── README.md
├── ARCHITECTURE.md
├── PRODUCT_BRIEF.md
├── LICENSE
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
│
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   └── providers.tsx
│   │
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── CreateTabPage.tsx
│   │   ├── TabPage.tsx
│   │   ├── OrganizerPage.tsx
│   │   └── PaymentResultPage.tsx
│   │
│   ├── components/
│   │   ├── tab/
│   │   ├── payments/
│   │   ├── wallet/
│   │   └── ui/
│   │
│   ├── features/
│   │   ├── create-tab/
│   │   ├── join-tab/
│   │   ├── settlement/
│   │   └── sharing/
│   │
│   ├── nimiq/
│   │   ├── provider.ts
│   │   ├── account.ts
│   │   ├── payment.ts
│   │   ├── errors.ts
│   │   └── types.ts
│   │
│   ├── evm/
│   │   ├── provider.ts
│   │   └── usdt.ts
│   │
│   ├── lib/
│   │   ├── money.ts
│   │   ├── allocation.ts
│   │   ├── ids.ts
│   │   ├── share.ts
│   │   └── validation.ts
│   │
│   └── styles/
│
├── convex/
│   ├── schema.ts
│   ├── tabs.ts
│   ├── participants.ts
│   ├── payments.ts
│   ├── verification.ts
│   └── crons.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
└── public/
```

---

# 11. Domain Model

## Tab

```ts
type Tab = {
  id: string
  slug: string
  title: string
  note?: string

  token: 'NIM' | 'USDT_POLYGON'
  amountMinor: string

  recipientAddress: string

  allocationMode: 'equal' | 'custom'
  status: 'open' | 'settled' | 'expired' | 'cancelled'

  dueAt?: number

  ownerSecretHash: string

  createdAt: number
  updatedAt: number
}
```

Use integer/minor units for all financial arithmetic.

Never store money as floating-point numbers.

## ParticipantSlot

```ts
type ParticipantSlot = {
  id: string
  tabId: string

  label: string
  amountMinor: string

  claimedByAddress?: string

  status: 'unpaid' | 'pending' | 'paid'

  paymentId?: string

  createdAt: number
  updatedAt: number
}
```

## Payment

```ts
type Payment = {
  id: string
  tabId: string
  participantSlotId: string

  chain: 'nimiq' | 'polygon'
  token: 'NIM' | 'USDT'

  senderAddress: string
  recipientAddress: string
  amountMinor: string

  txHash: string

  status:
    | 'submitted'
    | 'confirming'
    | 'confirmed'
    | 'failed'
    | 'invalid'

  verificationReason?: string

  createdAt: number
  confirmedAt?: number
}
```

---

# 12. Money Model

## 12.1 Integer arithmetic only

For NIM:

```text
1 NIM = 100,000 Luna
```

Represent values as integer Luna.

For USDT:

```text
1 USDT = 1,000,000 raw units
```

Represent values as integer raw token units.

## 12.2 Allocation invariant

For every Tab:

```text
sum(participant.amountMinor) === tab.amountMinor
```

The UI and backend both enforce this invariant.

## 12.3 Equal split rounding

When amount does not divide evenly:

1. calculate floor share;
2. calculate remainder;
3. distribute one minor unit to the first `remainder` slots deterministically.

Never create an unallocated remainder.

---

# 13. Creation Flow

```text
Home
 ↓
Create a Tab
 ↓
Title + total
 ↓
Recipient wallet
 ↓
Participants
 ↓
Equal or custom allocation
 ↓
Review
 ↓
Create
 ↓
Share link
```

The creator should be able to create a useful Tab in under 60 seconds.

---

# 14. Participant Flow

```text
Open shared link/deeplink
 ↓
See title + amount + recipient
 ↓
Choose assigned slot
 ↓
Connect Nimiq wallet
 ↓
Review payment
 ↓
Native Nimiq Pay approval
 ↓
Transaction submitted
 ↓
Verification
 ↓
Paid ✓
```

Participant should never need to manually copy:

- recipient address;
- amount;
- memo/reference.

---

# 15. Organizer Ownership

For MVP speed, use a high-entropy organizer secret rather than building full application authentication.

Creation:

```text
client generates 128+ bit secret
→ backend stores cryptographic hash
→ browser stores secret locally
→ optional owner URL fragment/token for recovery
```

Organizer-only mutations require the secret.

Never log or persist the raw owner secret server-side.

Post-hackathon, migrate organizer control to wallet-signature authentication.

---

# 16. Participant Slot Claiming

A slot begins unclaimed.

A participant chooses a slot and connects a wallet.

The backend can atomically bind:

```text
slot → wallet address
```

Rules:

- a paid slot cannot be reclaimed;
- a pending slot cannot be reassigned automatically;
- organizer can reset an unpaid slot;
- one wallet may pay multiple slots if explicitly allowed.

Do not overbuild identity. The payment is the important proof.

---

# 17. NIM Payment Flow

Preferred flow:

```text
1. Initialize Nimiq provider.
2. Request account access.
3. Confirm consensus available.
4. Construct exact amount in Luna.
5. Build compact Tab reference.
6. Call sendBasicTransactionWithData().
7. Receive txHash.
8. Persist Payment(status=submitted).
9. Run verification.
10. Mark slot paid only after verification.
```

Pseudo-code:

```ts
const nimiq = await init({ timeout: 10_000 })
const [sender] = await nimiq.listAccounts()

const txHash = await nimiq.sendBasicTransactionWithData({
  recipient: tab.recipientAddress,
  value: Number(amountLuna),
  data: paymentReference,
})
```

Implementation must check current SDK type limits and convert large integer values safely.

---

# 18. Transaction Verification

Client receipt is not enough.

The backend verifies that the submitted transaction matches the expected payment intent.

Verify:

```text
tx exists
recipient == expected recipient
sender == claimed sender (when available)
amount == exact assigned amount
data/reference matches Tab/payment intent (when used)
transaction reached required confirmation/finality state
```

Verification must be idempotent.

A tx hash may only settle one payment record unless explicitly designed otherwise.

---

# 19. Payment State Machine

```text
UNPAID
  │
  ▼
SUBMITTING
  │
  ├── user rejects ─────→ UNPAID
  │
  ├── provider error ───→ UNPAID / ERROR
  │
  ▼
SUBMITTED
  │
  ▼
CONFIRMING
  │
  ├── invalid ──────────→ INVALID
  │
  ├── failed ───────────→ FAILED (slot remains PENDING; retry existing tx)
  │
  ▼
CONFIRMED
  │
  ▼
PAID
```

Never conflate “wallet returned tx hash” with “payment verified”.

---

# 20. Realtime Status

Use Convex reactive queries for:

```text
number paid
number pending
amount collected
amount remaining
participant status
Tab settlement state
```

When verification completes, all open clients update automatically.

Do not add custom WebSocket infrastructure.

---

# 21. Share Links and Nimiq Pay Deeplinks

Canonical web route:

```text
https://tab.app/t/<slug>
```

Nimiq Pay deep link:

```text
https://nimpay.app/miniapps/open/<encoded-tab-url>
```

or the supported custom-scheme equivalent.

The share button should prefer Web Share API on supported mobile devices and fall back to copy-link.

---

# 22. Optional USDT on Polygon

Only implement after the NIM flow is stable.

Flow:

```text
eth_requestAccounts
→ wallet_switchEthereumChain(Polygon)
→ verify USDT balance
→ encode ERC20 transfer
→ eth_sendTransaction
→ verify receipt/logs
```

Important UX requirement:

Users must be told that EVM USDT transfers require the chain’s native gas token.

If this creates confusion during the hackathon, ship NIM-only and make it excellent.

---

# 23. Backend Function Boundaries

## Queries

```text
getTabBySlug
getOrganizerTab
getPaymentStatus
```

## Mutations

```text
createTab
claimParticipantSlot
resetParticipantSlot
recordSubmittedPayment
cancelTab
```

## Actions

```text
verifyNimiqTransaction
verifyEvmTransaction
```

## Internal mutations

```text
markPaymentConfirming
markPaymentConfirmed
markPaymentInvalid
recomputeTabStatus
```

---

# 24. Convex Schema Guidance

Tables:

```text
tabs
participantSlots
payments
paymentVerificationAttempts
```

Indexes:

```text
tabs.by_slug
participantSlots.by_tab
payments.by_tx_hash
payments.by_tab
payments.by_slot
verificationAttempts.by_payment
```

Do not persist derived values unnecessarily when they can be calculated cheaply, unless needed for performance/UX.

---

# 25. Idempotency

Critical operations must be safe to replay.

## Create Tab

Client may provide an idempotency key.

## Record payment

Unique constraint by transaction hash.

## Retry verification

The public retry action only reschedules verification for the existing Payment and transaction hash. It cannot provide transaction details or mark a payment confirmed. A failed verification keeps its participant slot pending so the participant is never prompted to pay twice.

## Verify payment

Repeated verification of a confirmed payment returns the same state without duplicating side effects.

## Recompute Tab

Safe to run any time.

---

# 26. Security Model

## Never store

- seed phrases;
- private keys;
- wallet entropy;
- raw signing keys;
- arbitrary sensitive personal information.

## All payment signing

Happens in Nimiq Pay.

## Server validation

Never trust:

```text
client amount
client recipient
client paid flag
client token
client transaction metadata
```

Reconcile against the Tab record and blockchain data.

## Secrets

External provider/RPC secrets remain server-side.

No hardcoded credentials in the public repository.

---

# 27. Privacy

Tab should disclose clearly what it stores.

MVP data:

```text
Tab title/note
participant labels
wallet addresses involved in payment
transaction hashes
amounts
timestamps
```

Wallet addresses and transaction hashes are already public onchain, but their association with participant labels is application data and should be treated carefully.

Avoid analytics that collect more than necessary.

---

# 28. Failure Handling

## Provider unavailable

Show:

```text
Open Tab inside Nimiq Pay to settle this payment.
```

## Account access rejected

Treat as cancellation, not crash.

## Consensus unavailable

Disable payment CTA and show retry.

## Insufficient balance

Give actionable balance error.

## Transaction rejected

Return participant to review state.

## Transaction hash received but verification delayed

Show:

```text
Payment submitted — verifying onchain…
```

and continue polling/reactive status.

## Backend unavailable

Never encourage user to submit the same payment repeatedly without checking tx status.

---

# 29. Mobile UX Requirements

Target small phone WebView first.

- 44px+ tap targets;
- safe-area padding;
- avoid horizontal scrolling;
- no hover-only affordances;
- keyboard-safe forms;
- loading indicators for wallet dialogs;
- clear return state after native confirmation;
- status not encoded by color alone.

---

# 30. Visual Product Direction

Tab should feel like modern consumer fintech, not a crypto dashboard.

Reference qualities:

```text
clean
calm
fast
social
trustworthy
minimal
```

Avoid:

- candlestick charts;
- neon “Web3” clichés;
- dense transaction metadata on primary screens;
- long wallet addresses unless user asks for detail.

Primary screen should emphasize:

```text
TAB TITLE
$ / NIM total
progress ring/bar
participant list
payment status
```

---

# 31. Performance

Performance is directly relevant to judging.

Targets:

- minimal initial JS bundle;
- route-level lazy loading only if justified;
- no huge icon library imports;
- no large animation package unless necessary;
- optimistic UI only where it cannot fake settlement;
- cache stable Tab metadata;
- realtime status should not require full-page reload.

---

# 32. Accessibility

- semantic labels;
- visible focus states;
- readable contrast;
- screen-reader text for status icons;
- reduced-motion preference respected;
- form errors tied to inputs;
- no color-only distinction for paid/pending/unpaid.

---

# 33. Testing Strategy

## Unit tests

```text
allocation math
rounding
money formatting
validation
dedupe/idempotency
state transitions
```

## Integration tests

```text
create Tab
claim slot
record tx hash
verification success
verification failure
Tab auto-settles when all slots paid
```

## Wallet adapter tests

Mock provider:

```text
user accepts
user rejects
provider timeout
no accounts
consensus false
transaction returns hash
```

## End-to-end

At least one real testnet NIM flow on a physical Nimiq Pay installation before submission.

---

# 34. Observability

Record structured server logs for:

```text
tab_id
payment_id
verification attempt
chain
result
latency
error code
```

Do not log owner secrets or sensitive provider payloads.

Minimal product analytics:

```text
Tab created
Tab shared
participant opened
wallet connected
payment submitted
payment verified
Tab settled
```

Use privacy-respecting analytics or server-side aggregate counters.

---

# 35. Competition Scoring Strategy

## Functionality / reliability / usefulness — 45 points

Optimize for:

- creator flow under one minute;
- no dead ends;
- real payments;
- clear errors;
- instant status updates;
- finished visual treatment;
- obvious real-world use.

## Nimiq Pay + Nimiq integration — 25 points

Demonstrate:

- native Nimiq wallet connection;
- NIM payment signing;
- transaction data/reference if appropriate;
- onchain verification;
- Nimiq Pay deep link;
- NIM as a real product rail, not decoration.

## Real usage — 15 points

Before judging:

- recruit real testers;
- create real Tabs;
- collect real feedback;
- fix issues;
- document user count and completed settlements truthfully.

## Design / UX — 10 points

Prioritize mobile-first polish and confidence around payment actions.

## Builder promotion — 5 points

- post progress;
- share launch;
- participate in builder community;
- provide screenshots/demo;
- ask for testers.

---

# 36. Submission Requirements Checklist

Before submission:

```text
[ ] public GitHub repository
[ ] MIT License
[ ] no leaked secrets
[ ] Nimiq Pay Mini Apps Framework used
[ ] NIM and/or USDT support
[ ] app works on first try
[ ] live deployment
[ ] tested inside Nimiq Pay
[ ] participant and organizer flows work
[ ] written description <= 250 words
[ ] GitHub profile details ready
[ ] Nimiq wallet address ready for payout
[ ] demo video/walkthrough prepared if possible
[ ] README includes setup, architecture and usage
[ ] error states checked
[ ] real users/test feedback documented
```

---

# 37. Hackathon Build Plan

Given the short remaining Cycle II window, use this order.

## Phase 0 — Setup

```text
repo
MIT license
Vite + React + TS
Nimiq Mini App SDK
Convex
mobile shell
```

## Phase 1 — Deterministic core

```text
Tab schema
allocation engine
create flow
share route
participant states
```

## Phase 2 — Real NIM settlement

```text
provider initialization
account request
NIM payment
transaction reference
tx hash storage
verification
```

## Phase 3 — Realtime + polish

```text
live payment status
progress UI
errors
empty states
mobile polish
sharing
```

## Phase 4 — Ship

```text
deploy
physical-device test
public repo
README
submit early
recruit testers
fix bugs
demo video
promotion
```

## Optional only after all P0 works

```text
USDT on Polygon
due date
receipts
item allocation
```

---

# 38. Definition of Done

Tab MVP is done when:

```text
✓ creator can create a Tab
✓ exact participant shares always equal total
✓ share link works
✓ participant can open it inside Nimiq Pay
✓ participant can connect a Nimiq wallet
✓ participant can send the exact NIM amount
✓ transaction hash is captured
✓ backend verifies the payment
✓ paid status cannot be faked from the client
✓ organizer sees progress update without refresh
✓ all participants paid → Tab becomes settled
✓ wallet rejection and network errors are handled cleanly
✓ app works on a real phone
✓ repository is public + MIT licensed
✓ production URL is live
✓ no secrets exist in frontend/repo
✓ submission description fits 250 words
✓ demo path can be completed reliably in under 90 seconds
```

---

# 39. Demo Narrative

A strong demo is one continuous story:

```text
1. Create “Studio Dinner” — 30 NIM.
2. Add Dolu, Tobi, Miracle — 10 NIM each.
3. Share the Tab.
4. Open participant link in Nimiq Pay.
5. Participant sees exactly 10 NIM owed.
6. Tap Pay.
7. Native Nimiq confirmation appears.
8. Approve payment.
9. Return to Tab: “Verifying…”
10. Payment flips to Paid.
11. Organizer screen updates live.
12. Repeat with final participant or use prepared demo state.
13. Tab reaches 30/30 NIM and becomes Settled.
```

The demo should make the value obvious without explaining blockchain mechanics.

---

# 40. Product Positioning

Primary:

> **Tab — Shared costs, settled.**

Alternative:

> **Open a Tab. Share the cost. Settle in NIM.**

One-line pitch:

> **Tab turns any shared cost into a payment link where everyone knows exactly what they owe and can settle directly from Nimiq Pay.**

---

# 41. Long-Term Direction

Tab can grow from one-off group collections into a lightweight payment coordination layer:

```text
one-off tabs
→ saved groups
→ recurring tabs
→ household/shared subscriptions
→ events and group orders
→ merchant group checkout
```

The long-term moat is not expense arithmetic.

It is:

> **making multi-person payment coordination feel as simple as sending one link.**

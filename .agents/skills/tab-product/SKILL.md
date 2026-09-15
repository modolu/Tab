---
name: tab-product
description: Product-specific engineering rules for the Tab Nimiq Pay Mini App. Use whenever implementing, reviewing, debugging, testing, or making architectural or UX decisions in the Tab project. Enforces the NIM-first P0 scope, competition priorities, payment safety, mobile UX, Convex architecture, and prevents scope drift into Splitwise-style debt tracking, USDT, recurring billing, AI, or unnecessary infrastructure.
---
# Tab Product Engineering Skill

## Purpose

This skill governs implementation of **Tab**, a Nimiq Pay Mini App for group payment collection.

Use this skill for every product, frontend, backend, payment, UX, testing, deployment, and architectural task in the Tab repository.

This skill does **not** replace the official Nimiq Mini Apps skill.

For Nimiq SDK syntax, provider APIs, wallet behavior, transaction APIs, deeplink formats, and current framework-specific implementation details:

> The installed official Nimiq Mini Apps skill is authoritative.

For Tab-specific product behavior and architecture:

> `TAB_ARCHITECTURE.md` is the technical source of truth.

> `TAB_PRODUCT_BRIEF.md` is the product and positioning source of truth.

If there is a conflict:

1. Current official Nimiq SDK/framework requirements override stale SDK assumptions.
2. `TAB_ARCHITECTURE.md` governs Tab's technical design.
3. `TAB_PRODUCT_BRIEF.md` governs product behavior and positioning.
4. This skill governs implementation discipline and scope.
5. Do not silently redesign the product.

---

# 1. Product Identity

Tab is a **group payment collection Mini App**.

Its product primitive is:

```text
one shared obligation
→ one recipient
→ multiple assigned contributors
→ direct contributor-to-recipient payments
→ verified live settlement
```

The core P0 journey is:

```text
Create Tab
→ allocate shares
→ share
→ participant opens
→ participant selects their slot
→ connect Nimiq wallet
→ pay exact NIM share
→ capture transaction hash
→ verify onchain
→ realtime status update
→ Tab settled
```

Tab coordinates payment.

Tab does not custody funds.

Funds flow directly:

```text
participant wallet → designated recipient wallet
```

The wallet handles money.

Tab handles coordination.

---

# 2. What Tab Is Not

Never reshape Tab into:

* a Splitwise clone;
* a multi-expense ledger;
* a trip-expense tracker;
* a debt graph;
* a reimbursement optimizer;
* a shortest-path settlement engine;
* a portfolio dashboard;
* a custodial payment pool;
* an escrow product;
* a generic wallet;
* a social network;
* an AI assistant.

Do not implement:

```text
A owes B
B owes C
therefore A pays C
```

Tab's model is:

```text
everyone who owes a contribution
→ pays the designated Tab recipient directly
```

This distinction is architectural, not cosmetic.

---

# 3. Competition Objective

The implementation should optimize primarily for:

1. Functionality.
2. Reliability.
3. Usefulness.
4. Meaningful Nimiq Pay integration.
5. Real usage.
6. Mobile UX quality.
7. Builder promotion readiness.

When choosing between:

```text
one polished working feature
```

and:

```text
three partially working features
```

choose the polished working feature.

The Mini App should work correctly on the first attempt during judging.

The payment flow is more important than feature count.

---

# 4. P0 Scope

The required Cycle II MVP is NIM-first.

P0 includes:

* create Tab;
* title/purpose;
* total NIM amount;
* designated recipient address;
* participant labels;
* equal allocation;
* custom allocation;
* exact allocation invariant;
* shareable URL;
* Nimiq Pay deeplink;
* participant slot selection;
* Nimiq account access;
* NIM transaction;
* transaction reference where technically appropriate;
* transaction hash capture;
* server-side/onchain verification;
* unpaid state;
* pending state;
* paid state;
* realtime organizer progress;
* realtime participant state;
* automatic Tab settlement;
* mobile-first UI;
* error handling;
* production deployment;
* public MIT-compatible repository.

P0 is complete only when a real NIM transaction can move through the entire system.

---

# 5. Explicitly Deferred Scope

Do not implement any of these until the complete P0 NIM flow is stable:

* USDT;
* Polygon;
* other EVM networks;
* recurring billing;
* saved groups;
* account systems;
* social login;
* wallet-signature authentication;
* debt netting;
* reminders infrastructure;
* itemized bill parsing;
* AI features;
* subscription management;
* CSV exports;
* merchant dashboards;
* complex analytics;
* custodial smart contracts;
* multiple payment destinations;
* multi-chain abstraction layers.

Do not add future-proof architecture for these unless current P0 code directly requires it.

Premature extensibility is not a goal.

Shipping is the goal.

---

# 6. Technical Stack

Preferred stack:

```text
Frontend
- React
- TypeScript
- Vite
- React Router
- @nimiq/mini-app-sdk
- @nimiq/utils
- disciplined CSS / Tailwind if already configured

Backend
- Convex

Testing
- Vitest
- React Testing Library
- appropriate Convex tests

Deployment
- frontend: Vercel
- backend: Convex
- wallet host: Nimiq Pay
```

Do not replace Vite with Next.js.

Do not introduce a conventional API server unless there is a concrete technical requirement.

Do not create custom WebSocket infrastructure.

Convex reactive queries provide realtime state.

---

# 7. Repository Discipline

Follow the repository structure defined by `TAB_ARCHITECTURE.md`.

Primary structure:

```text
src/
  app/
  pages/
  components/
    tab/
    payments/
    wallet/
    ui/
  features/
    create-tab/
    join-tab/
    settlement/
    sharing/
  nimiq/
  evm/
  lib/
  styles/

convex/
tests/
  unit/
  integration/
  fixtures/

public/
```

Do not create unnecessary architectural layers such as:

```text
repositories/
services/
managers/
controllers/
use-cases/
gateways/
domain-services/
```

unless the existing implementation has a concrete complexity that justifies them.

Prefer the smallest architecture that remains:

* understandable;
* testable;
* secure;
* maintainable for the competition.

---

# 8. Source-of-Truth Discipline

Before implementing a feature:

1. Read the relevant section of `TAB_ARCHITECTURE.md`.
2. Read the relevant product behavior in `TAB_PRODUCT_BRIEF.md`.
3. Check the installed official Nimiq skill for current SDK requirements if the task touches Nimiq.
4. Inspect existing implementation before modifying it.

Do not rewrite existing working architecture because another pattern is fashionable.

Do not silently change:

* domain terminology;
* statuses;
* money representation;
* ownership model;
* payment semantics;
* verification semantics;
* routing conventions.

If a material architecture change is unavoidable:

1. identify the technical reason;
2. state the incompatibility;
3. make the smallest viable change;
4. update architecture documentation accordingly.

---

# 9. Domain Model

Core domain entities are:

```text
Tab
ParticipantSlot
Payment
PaymentVerificationAttempt
```

## Tab

Conceptually:

```ts
type Tab = {
  id: string
  slug: string
  title: string
  note?: string

  token: 'NIM'
  amountMinor: string

  recipientAddress: string

  allocationMode: 'equal' | 'custom'

  status:
    | 'open'
    | 'settled'
    | 'expired'
    | 'cancelled'

  ownerSecretHash: string

  createdAt: number
  updatedAt: number
}
```

Do not add token variants to P0 merely for future expansion.

---

## ParticipantSlot

Conceptually:

```ts
type ParticipantSlot = {
  id: string
  tabId: string

  label: string
  amountMinor: string

  claimedByAddress?: string

  status:
    | 'unpaid'
    | 'pending'
    | 'paid'

  paymentId?: string

  createdAt: number
  updatedAt: number
}
```

A participant slot represents an assigned contribution.

It is not a user account.

---

## Payment

Conceptually:

```ts
type Payment = {
  id: string

  tabId: string
  participantSlotId: string

  chain: 'nimiq'
  token: 'NIM'

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

Never represent an unverified transaction as `paid`.

---

# 10. Money Rules

Financial correctness is non-negotiable.

For NIM:

```text
1 NIM = 100,000 Luna
```

All internal financial arithmetic must use integer minor units.

Persist monetary values as integer strings where required by the existing data model.

Never perform allocation with floating-point numbers.

Never use:

```ts
0.1 + 0.2
```

style arithmetic for financial state.

Use `bigint` or exact integer-string conversion.

---

# 11. Allocation Invariant

Every Tab must satisfy:

```text
sum(participant.amountMinor) === tab.amountMinor
```

This invariant must be enforced:

* in client-side UX;
* in shared/domain utilities where applicable;
* again server-side.

Never trust client-calculated totals.

---

## Equal Split

Equal allocations must use deterministic remainder distribution.

Algorithm:

```text
base = floor(total / participantCount)

remainder = total % participantCount

each participant receives base

the first `remainder` participants each receive +1 Luna
```

Example:

```text
10 Luna across 3 participants

→ 4
→ 3
→ 3
```

Never discard remainder.

---

## Custom Split

A custom split is valid only when:

```text
sum(custom shares) === total
```

Do not automatically alter custom values unless the UI explicitly informs the user.

---

# 12. Nimiq Address Rules

Use official Nimiq utilities to validate addresses.

Do not implement a homemade regex as the authoritative validator.

Normalize input consistently.

Do not silently change a valid recipient address to another address.

The recipient is critical payment state.

---

# 13. Organizer Ownership

P0 deliberately avoids a full account/authentication system.

Organizer ownership uses a high-entropy secret.

Expected pattern:

```text
client generates secret
→ backend receives hash / verifies secret flow
→ backend stores cryptographic hash
→ raw secret remains client-side
```

Requirements:

* minimum 128 bits of entropy;
* use cryptographically secure randomness;
* do not use `Math.random()`;
* do not persist raw organizer secret server-side;
* do not log raw organizer secret;
* do not commit secrets;
* do not expose owner authentication material in public Tab responses.

Wallet-signature authentication is post-hackathon unless explicitly required.

---

# 14. Nimiq Integration Rules

The official Nimiq Mini Apps skill is authoritative for exact current SDK syntax.

The intended product behavior is:

```text
initialize Nimiq provider
→ request account access
→ establish/check network readiness
→ determine sender account
→ construct exact assigned Luna amount
→ construct compact payment reference
→ request native NIM transaction
→ receive transaction hash
→ persist submitted payment
→ verify independently
```

Payment approval must remain inside Nimiq Pay.

Tab must never handle:

* private keys;
* seed phrases;
* wallet entropy;
* signing keys.

---

# 15. Payment Reference Rules

When supported by the current Nimiq SDK/network, prefer a compact transaction data reference:

```text
TAB:<tabShortId>:<slotShortId>
```

Requirements:

* compact;
* deterministic;
* ASCII where possible;
* safely within the current Nimiq transaction-data byte limit;
* validated by encoded byte length, not JavaScript character count.

Do not place:

* personal data;
* participant names;
* secrets;
* sensitive metadata

inside transaction data.

---

# 16. Payment State Machine

Preserve this semantic sequence:

```text
UNPAID
  ↓
SUBMITTING
  ↓
SUBMITTED
  ↓
CONFIRMING
  ↓
CONFIRMED
  ↓
PAID
```

Possible branches:

```text
user rejects
→ UNPAID

provider error
→ UNPAID or recoverable ERROR

verification invalid
→ INVALID

network transaction failure
→ FAILED
```

A returned transaction hash is **not** proof of payment.

Never set:

```text
slot.status = paid
```

solely because the wallet returned a hash.

---

# 17. Independent Onchain Verification

Payment truth comes from blockchain verification, not client claims.

The backend must verify the transaction against expected server-side data.

Verify where available:

```text
transaction exists
recipient == expected recipient
sender == claimed sender
amount == exact assigned amount
reference == expected payment reference
transaction reached required confirmation/finality state
```

Never trust client-provided:

```text
amount
recipient
token
paid flag
transaction metadata
verification status
```

Reconstruct expected payment state from the Tab and ParticipantSlot.

---

# 18. Verification Timing

Blockchain inclusion can be delayed.

Do not interpret:

```text
transaction not yet visible
```

as:

```text
payment invalid
```

Use:

```text
submitted
→ confirming
→ retry
→ confirmed
```

where appropriate.

Verification must be idempotent.

Repeated verification of an already-confirmed payment must not:

* duplicate payment records;
* pay a slot twice;
* double-count collected amount;
* trigger repeated settlement side effects.

---

# 19. Transaction Hash Uniqueness

A transaction hash may settle at most one payment record unless a future architecture explicitly changes that rule.

Reject duplicate transaction hashes.

This must be enforced server-side.

---

# 20. Slot Claiming

A participant chooses an assigned slot.

The slot may bind to the participant's Nimiq address.

Rules:

* a paid slot cannot be reclaimed;
* a pending slot cannot silently switch wallets;
* organizer may reset an unpaid slot if supported;
* one wallet may pay multiple slots if the product flow explicitly allows it;
* identity infrastructure should remain minimal.

The blockchain payment is the important proof.

Do not overbuild identity.

---

# 21. Convex Rules

Use Convex for:

* Tab persistence;
* participant slots;
* payment records;
* verification state;
* scheduled verification work;
* realtime UI updates;
* idempotency enforcement.

Preferred boundaries:

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
```

## Internal mutations

```text
markPaymentConfirming
markPaymentConfirmed
markPaymentInvalid
recomputeTabStatus
```

Do not expose privileged internal state transitions directly to the client.

---

# 22. Realtime Rules

Use Convex reactive queries.

Realtime UI should update:

* paid count;
* pending count;
* amount collected;
* amount remaining;
* participant status;
* Tab settlement state.

Do not add:

* Socket.IO;
* custom WebSockets;
* manual realtime infrastructure

unless Convex cannot satisfy a specific requirement.

---

# 23. Tab Settlement

A Tab becomes `settled` only when all required participant contributions are verified.

Conceptually:

```text
all participantSlots.status === paid
→ tab.status = settled
```

or the equivalent verified financial invariant.

Do not mark a Tab settled from optimistic client state.

Settlement must be derived from backend-verified participant/payment state.

---

# 24. Sharing

Canonical Tab route:

```text
/t/<slug>
```

A shared URL should bring a participant directly to the relevant Tab.

Where supported, provide a Nimiq Pay deeplink.

Prefer:

```text
Web Share API
```

on supported mobile devices.

Fallback:

```text
copy link
```

The shared link is a core product acquisition mechanism.

Do not require account signup before someone can understand a shared Tab.

---

# 25. Mobile-First UX

The primary environment is a small mobile WebView inside Nimiq Pay.

Design for that first.

Requirements:

* minimum ~44px interactive targets;
* safe-area awareness;
* no horizontal scrolling;
* readable typography;
* clear touch states;
* visible focus states;
* keyboard-safe forms;
* clear loading states;
* no hover-only interaction;
* short wallet addresses by default;
* full address available when needed;
* payment status not communicated by color alone;
* participant can understand the screen within seconds.

Desktop is secondary.

---

# 26. Product Design Direction

Tab should feel like modern consumer fintech.

Desired qualities:

```text
clean
calm
premium
social
friendly
fast
trustworthy
```

Avoid:

```text
crypto trading dashboards
neon Web3 aesthetics
candlestick charts
excessive glassmorphism
giant gradients
dense blockchain metadata
tiny wallet addresses
terminal-style interfaces
```

The primary screen should emphasize:

```text
Tab title
total
progress
participant list
individual shares
payment status
primary action
```

Blockchain mechanics should remain secondary.

---

# 27. Participant Comprehension Test

Within several seconds, a participant should be able to answer:

```text
What is this payment for?

How much do I owe?

Who receives the money?

What is my current payment status?

What do I tap next?
```

If the interface makes these answers unclear, simplify it.

---

# 28. Payment UX Rules

Before payment, clearly show:

* purpose;
* exact amount;
* recipient;
* participant identity/slot;
* payment action.

During payment:

* show a loading/progress state;
* prevent accidental duplicate submissions where possible.

After wallet submission:

Do not say:

```text
Paid
```

Immediately show something like:

```text
Payment submitted
Verifying onchain…
```

Only after independent verification should the UI show:

```text
Paid ✓
```

---

# 29. Failure UX

Failures are normal product states.

Handle explicitly:

## Provider unavailable

Explain that the Tab should be opened inside Nimiq Pay where appropriate.

## Account access rejected

Treat as user cancellation.

Do not crash.

## No account

Show an actionable state.

## Consensus/network unavailable

Disable or pause payment and offer retry.

## Insufficient balance

Show a clear actionable error.

## Transaction rejected

Return to payment review.

## Transaction hash received but verification delayed

Show:

```text
Payment submitted — verifying onchain…
```

Do not encourage repeated payments.

## Backend/RPC unavailable

Preserve transaction state safely and provide retry/recovery behavior.

---

# 30. Security Rules

Never store or expose:

* seed phrases;
* private keys;
* signing keys;
* raw wallet secrets;
* raw organizer secrets;
* unnecessary personal information.

Never hardcode:

* RPC credentials;
* production deployment secrets;
* API keys;
* private environment values.

Public repo must remain safe to publish at all times.

`.env.example` contains names/placeholders only.

---

# 31. Privacy Rules

Collect only what Tab needs.

Expected data may include:

* Tab title;
* optional note;
* participant labels;
* participant wallet addresses where required;
* recipient address;
* transaction hashes;
* payment amounts;
* timestamps.

Avoid unnecessary tracking.

Remember that linking:

```text
human-readable participant label
↔ wallet address
```

creates application-level personal context even though wallet transactions themselves are public.

---

# 32. Performance Rules

Competition judging rewards a product that feels finished.

Prefer:

* small dependency footprint;
* lightweight components;
* targeted imports;
* fast first render;
* realtime updates without refresh;
* minimal loading waterfalls.

Avoid:

* giant icon packages;
* large animation frameworks;
* heavyweight state libraries;
* unnecessary client-side abstractions;
* huge design systems.

Do not trade reliability for clever performance tricks.

---

# 33. Accessibility Rules

Implement:

* semantic HTML;
* proper labels;
* accessible status text;
* visible focus;
* readable contrast;
* input error associations;
* keyboard usability where applicable;
* reduced motion support where animation exists;
* status labels in addition to visual color.

Accessibility is part of polish, not post-hackathon cleanup.

---

# 34. Testing Philosophy

Every phase ends with tests.

Prioritize tests around things that can lose trust or money.

Required categories:

```text
allocation math
money conversion
rounding
validation
idempotency
payment state transitions
slot claiming
payment recording
verification
automatic settlement
wallet adapter behavior
```

Avoid test-count vanity.

Write tests for meaningful behavior.

---

# 35. Wallet Adapter Testing

Mock at least:

```text
account access accepted
account access rejected
provider unavailable
provider timeout
no accounts
consensus unavailable
transaction accepted
transaction hash returned
transaction request rejected
```

Client wallet tests must never be used as a substitute for backend verification tests.

---

# 36. Verification Tests

Test at least:

```text
correct transaction confirms payment
wrong recipient is invalid
wrong amount is invalid
wrong sender is invalid where sender verification applies
wrong reference is invalid where reference is used
unknown transaction remains pending/retryable where appropriate
duplicate tx hash is rejected
repeated verification is idempotent
confirmed slot cannot be confirmed twice
final paid slot settles the Tab
```

---

# 37. End-to-End Requirement

Before competition submission, perform at least one real end-to-end NIM payment on a physical device using Nimiq Pay.

A mocked transaction flow does not qualify as a finished Tab MVP.

The real flow must demonstrate:

```text
create
→ share/open
→ select slot
→ wallet approval
→ NIM transaction
→ tx hash
→ backend verification
→ realtime paid state
→ organizer progress
→ settled
```

---

# 38. Phase Discipline

Development proceeds in phases.

Every phase must end with:

```text
working application
tests passing
typecheck passing
lint passing
production build passing
manual verification
clean commit
```

Do not begin the next phase while the previous phase is broken.

---

# 39. Phase 0 — Setup

Purpose:

Establish a minimal runnable app.

Includes:

```text
repo
MIT license
React + Vite + TypeScript
Convex
Nimiq dependencies
routing
mobile shell
testing
environment template
```

No feature expansion.

---

# 40. Phase 1 — Deterministic Core

Includes:

```text
domain schema
money utilities
allocation engine
validation
owner secret
create Tab flow
participant slots
Convex persistence
share route
Tab detail
```

Runnable state:

```text
Create
→ Allocate
→ Persist
→ Open shared Tab
```

No wallet payment implementation yet.

---

# 41. Phase 2 — NIM Settlement

Includes:

```text
Nimiq provider
account access
network readiness
slot claiming
payment reference
exact Luna amount
native transaction
tx hash capture
submitted payment record
onchain verification
idempotency
```

Runnable state:

```text
Open Tab
→ choose slot
→ connect wallet
→ pay
→ verify
→ paid
```

---

# 42. Phase 3 — Realtime + Polish

Includes:

```text
realtime organizer status
realtime participant status
progress
error states
sharing
deeplink
completion state
mobile polish
accessibility
```

Runnable state must remain fully functional.

---

# 43. Phase 4 — Ship

Includes:

```text
production deployment
physical-device testing
README
screenshots
demo
public repository
real testers
bug fixes
submission preparation
promotion
```

Do not add major features during this phase.

---

# 44. Definition of MVP Done

Tab is competition-ready only when:

```text
✓ creator can create a Tab
✓ exact shares equal exact total
✓ recipient is valid
✓ share URL works
✓ participant can open Tab
✓ participant can select their slot
✓ participant can access Nimiq wallet
✓ participant can submit exact NIM payment
✓ transaction hash is captured
✓ transaction is independently verified
✓ client cannot fake paid status
✓ participant becomes Paid only after verification
✓ organizer receives live progress
✓ final verified contribution settles Tab
✓ wallet rejection is handled
✓ network delays are handled
✓ duplicate payments are guarded
✓ app works on a physical phone
✓ production deployment works
✓ public repository is MIT-compatible
✓ no secrets are committed
✓ core demo can be completed reliably
```

---

# 45. Coding Style

Prefer:

* explicit types;
* small functions;
* descriptive names;
* domain terms from the product;
* deterministic behavior;
* early validation;
* boring reliable code;
* comments only where intent is non-obvious.

Avoid:

* clever abstractions;
* generic enterprise architecture;
* premature generalization;
* excessive hook indirection;
* unnecessary dependency injection;
* deeply nested component state;
* duplicated validation logic without reason;
* `any` unless unavoidable at an external boundary.

---

# 46. Agent Behavior

When assigned a task:

## First

Read:

```text
TAB_ARCHITECTURE.md
TAB_PRODUCT_BRIEF.md
this skill
relevant existing files
official Nimiq skill when applicable
```

## Then

Determine:

```text
current phase
exact requested scope
affected files
tests required
whether a current SDK constraint changes anything
```

## Then implement

Do not ask for permission for ordinary implementation choices already resolved by the source-of-truth documents.

Do not expand scope.

Do not begin future phases.

---

# 47. Agent Must Not

Never:

* redesign Tab into an expense tracker;
* add USDT during core NIM work;
* add another chain;
* create complex authentication;
* add AI features;
* build recurring payments;
* introduce custodial funds;
* mark payments successful optimistically;
* trust client payment state;
* store financial values as floats;
* store raw owner secrets;
* store wallet private material;
* commit credentials;
* skip tests to move faster;
* delete existing tests simply to get green CI;
* replace working architecture without concrete reason;
* hide failures with mocks;
* claim an end-to-end flow works if only mocks were tested.

---

# 48. Fast-Deadline Decision Rule

This project has a very short competition window.

When choosing implementation strategy, use this priority:

```text
1. Can the full NIM flow work?
2. Can it work reliably twice?
3. Can a real user understand it?
4. Can a real user complete it on mobile?
5. Can we test it?
6. Can we demonstrate it clearly?
7. Can we polish it further?
8. Only then consider P1.
```

When uncertain whether to add something:

Ask:

> Does this materially increase the probability that the P0 NIM flow works, scores better, or is easier to demonstrate?

If no:

Do not build it.

---

# 49. Bug-Fix Priority

Fix bugs in this order:

## P0 blocker

Anything preventing:

```text
create
share
pay
verify
realtime update
settlement
```

Fix immediately.

## P0 reliability

Examples:

```text
double submission
stale state
duplicate tx
incorrect allocation
verification race
broken reload
wallet cancellation bug
```

Fix before UI polish.

## Mobile usability

Examples:

```text
blocked CTA
keyboard overlap
unreadable amount
unsafe tap targets
confusing payment state
```

Fix before decorative polish.

## Visual polish

Fix after functional reliability.

## P1 feature bug

Ignore until P0 is complete unless it affects P0 code.

---

# 50. Commit Discipline

Every completed phase should produce a clean commit.

Recommended style:

```text
chore: bootstrap Tab mini app

feat: implement deterministic tab creation flow

feat: add Nimiq Pay settlement flow

feat: verify NIM settlements onchain

feat: add realtime settlement states and recovery UX

feat: polish and ship competition MVP
```

Do not mix unrelated experimental work into phase commits.

Before committing:

```text
tests
typecheck
lint
build
```

must pass.

---

# 51. End-of-Task Report

After every implementation task, report:

1. files created;
2. files modified;
3. behavior implemented;
4. tests added;
5. commands run;
6. test results;
7. lint result;
8. typecheck result;
9. build result;
10. manual test performed;
11. known limitations;
12. security considerations;
13. architecture deviations, if any;
14. recommended commit message;
15. exact next phase/task.

Do not report future work as completed.

---

# 52. Competition Demo Standard

Build toward this continuous demo:

```text
Create "Studio Dinner"
→ total 30 NIM
→ Dolu 10
→ Tobi 10
→ Miracle 10
→ create Tab
→ share/open participant link
→ select one 10 NIM slot
→ connect Nimiq wallet
→ Pay 10 NIM
→ native confirmation
→ transaction submitted
→ "Verifying onchain…"
→ participant becomes Paid
→ organizer updates without refresh
→ final contribution arrives
→ Tab becomes Settled
```

The audience should understand what Tab does without needing a blockchain explanation.

---

# 53. Product North Star

Every technical decision should reinforce this:

> Tab turns one shared cost into one payment link where everyone knows exactly what they owe and can settle directly from Nimiq Pay.

And the product promise remains:

> **Shared costs, settled.**


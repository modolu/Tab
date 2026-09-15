# Competition submission draft

## One-line pitch

Tab turns any shared cost into a shareable payment tab where every participant sees exactly what they owe and settles directly from Nimiq Pay.

## Tagline

Shared costs, settled.

## Submission description

Tab is a group payment collection Mini App built inside Nimiq Pay. Shared dinners, studio costs, and small group obligations usually become a messy loop of screenshots, reminders, and manual reconciliation. Tab makes one shared obligation clear: one recipient, multiple assigned contributors, and an exact share for each person.

The organizer creates a Tab, chooses equal or custom allocations, and shares one link. Each participant opens the Tab, explicitly connects Nimiq, reviews the amount and recipient, and approves a native NIM transfer. Funds move directly from contributor to recipient; Tab never holds keys or funds. After submission, Convex independently checks the transaction reference, recipient, value, execution result, network, and Nimiq macro-block finality before showing Paid. Reactive state updates the group and marks the Tab Settled when every share is verified.

Tab is not a Splitwise clone: it coordinates one immediate collection instead of maintaining a long-lived expense ledger or debt graph. The complete P0 flow was physically validated on an iPhone inside Nimiq Pay TestAlbatross testnet.

## Demo script (30–60 seconds)

Create “Studio Dinner” → set a small total → show equal shares → share the participant link → open it inside Nimiq Pay → select a slot → connect wallet → review and approve NIM → show Submitted / Verifying onchain → show Paid → return to organizer progress → complete the final share → show Tab Settled.

## Screenshot checklist

- [ ] Home
- [ ] Create Tab
- [ ] Equal/custom allocation
- [ ] Participant view
- [ ] Payment review
- [ ] Verifying onchain
- [ ] Paid
- [ ] Settled
- [ ] Organizer progress

## Promotion drafts

### X/Twitter

We built Tab, a Nimiq Pay Mini App for one shared cost: create a Tab, assign exact shares, share one link, and let contributors pay the recipient directly in NIM. Convex independently verifies each transaction before marking it Paid, then settles the group in realtime. Built and physically tested on Nimiq TestAlbatross. Feedback welcome.

### Community / Skool

Tab is a small, non-custodial group payment flow for shared dinners, studio costs, and similar one-off obligations. It runs inside Nimiq Pay, uses native NIM approval, and verifies each payment independently before the organizer sees a settled result. We are looking for testers on Nimiq testnet, especially mobile WebView feedback.

### GitHub description

Nimiq Pay Mini App for collecting one shared cost through direct, independently verified NIM payments.

## Lightweight competition metrics

Use the existing Convex deployment dashboard and data, keeping development/testnet and production/mainnet deployments separate. Report aggregate counts only: Tabs created, participant slots, submitted payments, confirmed payments, and settled Tabs. Do not fabricate numbers or add third-party analytics.

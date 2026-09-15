# TAB — PRODUCT BRIEF

## Product

**Tab**

### Tagline

**Shared costs, settled.**

### One-line pitch

Tab turns any shared cost into a shareable payment tab where every participant sees exactly what they owe and settles directly from Nimiq Pay.

---

## 1. Executive Summary

Shared expenses are rarely hard because of arithmetic. They are hard because collecting the money is fragmented.

Someone pays for dinner, rent, a birthday gift, an event, house internet, a team subscription, or a group order. Then the organizer has to calculate shares, copy a wallet address, message everyone individually, answer “how much do I owe?”, check transaction screenshots, and chase whoever has not paid.

Tab collapses that workflow into one object.

The organizer creates a **Tab**, enters the total amount, chooses who is contributing, and assigns equal or custom shares. Tab creates a shareable link. Each participant opens the link inside Nimiq Pay, sees their exact contribution, approves the payment from their own wallet, and is marked paid once the transaction is verified onchain.

No custody. No manual wallet-address copying. No screenshots as proof. No separate payment app.

The product is designed as a Nimiq Pay-native consumer utility, not a generic expense tracker with a wallet button added afterward.

---

## 2. The Problem

The typical shared-payment workflow looks like this:

1. One person pays or receives the group bill.
2. Someone manually calculates contributions.
3. A wallet address gets pasted into a group chat.
4. Everyone asks what amount they owe.
5. Participants make separate transfers.
6. Screenshots or transaction hashes are posted as proof.
7. The organizer manually checks who has paid.
8. People are chased until the group is settled.

The payment itself may take seconds. Coordination takes hours or days.

Most expense-splitting tools focus on maintaining a ledger of many historical expenses and calculating who owes whom. Tab focuses on a different moment:

> **There is one shared cost. Get it collected cleanly.**

---

## 3. Product Thesis

A group payment should be as simple as sharing a link.

The ideal flow is:

```text
Create
→ Split
→ Share
→ Pay
→ Verified
→ Settled
```

The wallet should handle the money. Tab should handle the coordination.

---

## 4. What Tab Is

Tab is a mobile-first Nimiq Pay Mini App for **group payment collection**.

An organizer can:

- create a shared payment tab;
- set a total;
- choose NIM as the payment rail;
- specify a recipient wallet;
- add participant slots;
- split equally or assign custom amounts;
- share the Tab with one link;
- watch payment status update live;
- know when the Tab is fully settled.

A participant can:

- open a Tab link;
- understand the purpose of the payment immediately;
- select their slot;
- connect their Nimiq wallet;
- see the exact amount and recipient;
- approve the payment inside Nimiq Pay;
- receive a verified paid state.

---

## 5. What Tab Is Not

Tab is intentionally **not**:

- a Splitwise clone;
- a trip-expense ledger;
- a debt graph;
- a reimbursement optimizer;
- a crypto portfolio tracker;
- a custodial payment pool;
- an escrow product.

The Nimiq Mini Apps Competition already contains expense-splitting products. Tab therefore stays collection-first: one obligation, one recipient, multiple direct contributions.

---

## 6. Target Audience

### Primary Persona — The Organizer

A crypto-native user who regularly coordinates shared costs among friends, housemates, or small teams.

Examples:

- “Everyone send 10 NIM for dinner.”
- “We need to collect the house internet bill.”
- “Five of us are buying a gift together.”
- “Everyone owes their share for the event booking.”

Pain points:

- repeating wallet addresses;
- answering contribution questions;
- checking screenshots;
- manual reminders;
- losing track of who paid.

### Secondary Persona — The Participant

Someone who just wants to know:

> “How much do I need to pay, and where do I tap?”

They do not want to calculate, copy addresses, or navigate several apps.

---

## 7. Primary Use Cases

### Group dinner

30 NIM, three people, 10 NIM each.

### House utilities

A monthly internet or electricity cost split between housemates.

### Birthday gift

One organizer purchases the gift; everyone contributes a custom share.

### Event contribution

A group collects toward a venue, reservation, transport, or booking.

### Shared subscription

A team or household collects contributions toward a recurring service.

### Group order

One recipient pays a vendor while participants settle their assigned shares.

---

## 8. User Journey

### Organizer

1. Open Tab inside Nimiq Pay.
2. Tap **Create Tab**.
3. Enter purpose, total, and recipient.
4. Add participants.
5. Choose equal or custom allocation.
6. Review the total.
7. Create Tab.
8. Share the generated link.
9. Watch payments arrive live.
10. Tab automatically becomes **Settled** when all shares are verified.

### Participant

1. Tap shared Tab link.
2. Nimiq Pay opens the Mini App.
3. See purpose, total, recipient, progress, and assigned slots.
4. Select their slot.
5. Connect wallet.
6. Review exact payment.
7. Tap **Pay**.
8. Approve native wallet confirmation.
9. Tab shows **Verifying**.
10. Transaction confirms.
11. Slot becomes **Paid**.

---

## 9. Core UX

### Home

```text
TAB

Shared costs, settled.

[ Create a Tab ]

Recent Tabs
Studio Dinner      Settled
Internet Bill      3 / 4 paid
Birthday Gift      2 / 6 paid
```

### Tab Detail

```text
STUDIO DINNER

30 NIM
██████████░░░░ 20 / 30 settled

✓ Dolu      10 NIM   Paid
✓ Tobi      10 NIM   Paid
○ Miracle   10 NIM   Pay now

Recipient
NQxx ... xxxx

[ Pay 10 NIM ]
```

### Completion

```text
TAB SETTLED ✓

30 / 30 NIM received
3 contributors

No one left to chase.
```

---

## 10. Nimiq Pay Integration

Nimiq Pay is not an accessory to Tab; it is the payment layer.

Tab uses the Nimiq Mini App SDK to:

- access the user’s Nimiq account with permission;
- confirm network readiness;
- request NIM transfers;
- display native wallet approval;
- obtain transaction hashes;
- attach a compact Tab reference to payment data where appropriate;
- verify the transaction against the expected recipient and amount.

The resulting experience keeps cryptographic keys inside Nimiq Pay and lets users approve every sensitive wallet action through native confirmation dialogs.

### Why NIM first

NIM is the preferred MVP rail because the competition rewards meaningful Nimiq integration and because the native Mini App provider offers a very direct user experience.

USDT on Polygon is a strong extension after the NIM flow is production-quality.

---

## 11. Differentiation

The closest category alternatives solve “who owes whom after many expenses?”

Tab solves:

> **“We have one shared cost. How do we collect it from everyone cleanly?”**

Key differentiators:

- one shared obligation rather than a multi-expense ledger;
- direct participant-to-recipient payments;
- no pooled custody;
- shareable deep link;
- exact amount prefilled;
- live collection state;
- onchain verification instead of screenshots;
- useful for rent, utilities, gifts, events, subscriptions and group orders—not only trips.

---

## 12. Product Principles

### Calm, not crypto-complex

Users should not need to understand transaction encoding or blockchain internals.

### Trust by visibility

Always show:

- purpose;
- amount;
- recipient;
- participant share;
- settlement status.

### No fake success

“Paid” means verified, not “user clicked the button.”

### No custody

Tab coordinates funds but does not hold them.

### Fast enough for real life

A participant should be able to go from link to approved payment in well under a minute.

---

## 13. Competition Fit

The competition’s judging heavily rewards functionality, reliability, usefulness, meaningful Nimiq Pay integration, real usage, design quality, and promotion.

Tab is deliberately shaped around those dimensions.

### Functionality and usefulness

A complete group payment can be created, shared, paid, verified and closed.

### Nimiq Pay integration

Wallet connection and real NIM transfer are central to the product promise.

### Real usage

The app has a natural invitation loop: every Tab creator brings multiple participants into the product.

### Design

The payment state is simple enough to create a premium, focused mobile interface.

### Promotion

Each public/shared Tab can produce organic usage, while build updates and user feedback can be documented during the competition.

---

## 14. MVP Scope

### Must ship

- create Tab;
- NIM recipient;
- equal/custom split;
- participant slots;
- share link;
- Nimiq wallet connection;
- NIM payment;
- transaction hash capture;
- onchain verification;
- real-time progress;
- paid/pending/unpaid states;
- polished mobile UX;
- production deployment;
- public MIT-licensed repo.

### Ship only if core is stable

- due dates;
- receipt screen;
- itemized split helper;
- native sharing polish;
- USDT on Polygon.

### Do not build for Cycle II

- complex recurring billing engine;
- extensive account system;
- debt-netting algorithms;
- dozens of chains;
- custodial smart contracts;
- social feed;
- AI features without a clear need.

---

## 15. Success Metrics

Hackathon success is not just “app deployed.”

Track:

- Tabs created;
- participant opens;
- wallet connects;
- payments submitted;
- verified payments;
- settled Tabs;
- payment success rate;
- median time from Tab open to paid;
- returning organizers;
- tester feedback resolved.

For judging, report only real numbers.

---

## 16. Monetization — Post Hackathon

The initial product should be free.

Potential future models:

- premium recurring groups;
- organizer templates;
- business/merchant group checkout;
- payment records/export;
- branded event Tabs;
- notification automation;
- optional fiat onboarding integrations.

Do not introduce transaction custody or hidden payment fees just to monetize quickly.

---

## 17. Brand Direction

### Name

**Tab**

Short, familiar, social, and payment-oriented.

### Brand promise

**Shared costs, settled.**

### Personality

- direct;
- friendly;
- premium;
- calm;
- social;
- trustworthy.

### Visual feel

Modern consumer fintech rather than a Web3 terminal.

Avoid excessive chain jargon, glowing neon crypto visuals, charts, and intimidating wallet detail.

---

## 18. 250-Word Submission Draft

**Tab is a group payment collection Mini App built inside Nimiq Pay.**

Shared costs are easy to calculate but annoying to collect. Someone pays for dinner, a gift, rent, an event, house internet, or a group order, then spends the next few days reposting a wallet address, answering “how much do I owe?”, checking screenshots, and chasing whoever has not paid.

With Tab, an organizer creates one shared payment tab, enters the total, adds participants, and splits the amount equally or with custom shares. Tab generates a shareable link. Each participant opens it in Nimiq Pay, sees exactly what they owe and who receives it, then approves the NIM payment from their own wallet. Tab verifies the transaction onchain and updates the collection status live until the full amount is settled.

Tab is non-custodial: funds move directly from each participant to the designated recipient. It does not hold user funds or ask anyone to manually copy wallet addresses or send screenshots as proof.

Unlike expense-ledger apps that calculate complex debts between many people, Tab focuses on one job: **turn one shared cost into a payment link that the whole group can settle.**

Nimiq Pay is core to the experience through native wallet access, NIM transactions, user-approved confirmations, and direct settlement.

**Create. Split. Share. Settle.**

---

## 19. Demo Story

The demo should be short and obvious:

1. Create “Studio Dinner” for 30 NIM.
2. Add three people at 10 NIM each.
3. Share the Tab.
4. Open participant view in Nimiq Pay.
5. Tap Pay 10 NIM.
6. Approve native confirmation.
7. Watch the participant switch from “Verifying” to “Paid”.
8. Show organizer progress update live.
9. Finish with the settled state.

The judge should understand the product before the demo reaches 20 seconds.

---

## 20. Long-Term Vision

Tab starts with one-off collections and can become the coordination layer for shared payments:

```text
one-off shared tabs
→ saved groups
→ recurring household bills
→ event contributions
→ shared subscriptions
→ group checkout
→ small-team payment coordination
```

The long-term goal is simple:

> **Whenever several people need to contribute toward one thing, open a Tab.**

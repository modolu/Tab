# Tab mobile QA checklist

Use a real Nimiq Pay testnet wallet for payment checks. Do not use a fake payment or a mainnet-value payment while developing.

## Create

- [ ] Equal split creates the expected shares.
- [ ] Custom split shows the remaining amount and blocks invalid allocation.
- [ ] Invalid recipient address is blocked with an actionable error.
- [ ] Keyboard does not hide the create action.

## Share

- [ ] Participant URL opens at `/t/:slug`.
- [ ] Share Tab uses the native Web Share sheet where available.
- [ ] Copy link fallback shows `Link copied` feedback.
- [ ] Nimiq Pay deep link opens the full encoded production URL.
- [ ] Shared URLs contain no organizer secret.

## Payment

- [ ] Wallet connection requires an explicit tap.
- [ ] Review shows the exact NIM amount and recipient.
- [ ] Native Nimiq Pay approval is requested.
- [ ] Submitted payment shows `Verifying onchain`.
- [ ] Only backend verification shows `Paid`.

## Recovery

- [ ] Wallet rejection leaves the slot unpaid and available to retry.
- [ ] Verification retry is reachable after refresh or app reopen.
- [ ] Retry reuses the existing transaction and never opens another wallet payment.
- [ ] Pending or failed verification never shows a normal Pay CTA.
- [ ] Paid state survives a fresh route load.
- [ ] Duplicate payment attempts are blocked.

## Settlement

- [ ] Organizer progress updates reactively after a participant payment.
- [ ] First verified payment leaves the Tab open.
- [ ] Final verified payment changes the Tab to Settled.

## Mobile

- [ ] 320px viewport has no horizontal scroll.
- [ ] 375px viewport has no clipped content.
- [ ] 390px viewport has comfortable card and button spacing.
- [ ] 430px viewport does not leave awkward empty space.
- [ ] iPhone Nimiq Pay WebView has safe-area-aware spacing.
- [ ] Keyboard does not block the primary CTA.
- [ ] Buttons and icon controls have touch targets around 44px or larger.

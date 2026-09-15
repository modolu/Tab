# Tab release QA

Use this checklist for the hosted release. A checked box means the test was actually performed; do not mark physical mainnet checks complete from mocks or testnet evidence.

## Production operator setup

Confirm the target is the project's default production deployment before changing anything. Then set the backend environment there:

```bash
npx convex env set --prod NIMIQ_NETWORK mainnet
npx convex env set --prod NIMIQ_RPC_URL https://rpc.nimiqwatch.com
npx convex env set --prod NIMIQ_ENABLE_DEV_DIAGNOSTICS false
npx convex deploy --prod
```

Set the resulting production Convex URL as Vercel's `VITE_CONVEX_URL` production environment variable, then deploy the Vite app. Do not copy development/testnet data into production. If the CLI requests authentication, run `npx convex login` and repeat only after confirming the displayed production target.

## Automated

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] `npx convex dev --once`

## Hosted frontend

- [ ] HTTPS deployment loads.
- [ ] Home loads.
- [ ] Create loads.
- [ ] Direct `/t/:slug` reload returns the app, not a hosting 404.
- [ ] Direct `/o/:slug` reload returns the app, not a hosting 404.
- [ ] Production share links use the deployed domain.
- [ ] Nimiq Pay opens the production URL.
- [ ] Wallet permission appears only after an explicit interaction.

## Production payment

- [ ] Create a small production Tab.
- [ ] Connect a Nimiq wallet.
- [ ] Exact NIM amount and recipient are visible before approval.
- [ ] Native transaction confirmation appears.
- [ ] Transaction reaches submitted and verifying states.
- [ ] Mainnet RPC independently verifies the transaction.
- [ ] Slot becomes Paid only after verification.
- [ ] Organizer progress updates reactively.
- [ ] Final contribution settles the Tab.

## Recovery and mobile

- [ ] Refresh while pending restores the existing payment state.
- [ ] Retry verification never offers a second payment.
- [ ] Paid state survives refresh.
- [ ] 320px, 375px, 390px, and 430px widths have no horizontal scroll.
- [ ] iPhone Nimiq Pay WebView has no keyboard-blocked CTA.
- [ ] Reduced-motion mode remains readable.

## Configuration safety

- [ ] Production Convex has `NIMIQ_NETWORK=mainnet`.
- [ ] Production Convex has `NIMIQ_RPC_URL=https://rpc.nimiqwatch.com`.
- [ ] `NIMIQ_ENABLE_DEV_DIAGNOSTICS` is absent or false.
- [ ] Production frontend has the production `VITE_CONVEX_URL`.
- [ ] No `.env.local`, credentials, or private wallet material is committed.

## Competition metrics

Keep the development/testnet and production/mainnet deployments separate. In the Convex dashboard Data view, report aggregate counts from the production tables: `tabs` rows = Tabs created, `participantSlots` rows = participant slots, `payments` rows = submitted payments, `payments` filtered to `status=confirmed` = confirmed payments, and `tabs` filtered to `status=settled` = settled Tabs. Do not publish wallet labels, addresses, transaction details, or fabricated counts.

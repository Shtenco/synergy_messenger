# SYNERGY Messenger V3 Phase 4D — Finance Bridge Design

## Goal
Add non-custodial payments to direct and MLS group chats without ever exposing wallet private keys to Messenger.

## Security boundary
- Messenger creates and transports canonical payment intents and receipts only.
- Wallet/Finance owns private keys, signing, compliance, routing and submission.
- Runtime has no private-key import/export/signTransaction method.
- A payment can move from draft to submitted only through an explicit `authorizeAndSubmit()` call on an injected Finance provider.
- Payment amounts use integer atomic-unit decimal strings; JavaScript floating-point amounts are rejected.
- Payment payloads travel only inside existing Double Ratchet or MLS application encryption.
- Local payment state is Vault-sealed at rest.
- Finance provider absence disables payment actions fail-closed but leaves messaging intact.

## Provider contract
`FinanceBridgeProvider` exposes:
- `getCapabilities()`
- `preview(intent)`
- `authorizeAndSubmit(intent)` — must represent an explicit user authorization boundary
- `refresh(receipt)`
- `verifyReceipt(receipt)`

The provider returns no private key material and never gives Messenger a raw signing primitive.

## Payment protocol
### PaymentIntent
Versioned, canonical object containing paymentId, payerDeviceId, payeeRef, chatId, asset, network, amountAtomic, decimals, memo, createdAt, expiresAt and nonce.

### PaymentReceipt
Versioned object containing paymentId, status (`submitted|confirmed|failed|cancelled|expired`), asset/network/amountAtomic, txRef, providerRef, timestamps and optional public proof metadata. No secrets.

### E2E application messages
- pairwise secure payload type `payment`
- MLS group payload type `payment`

Wire packets must not expose amount, asset, memo, txRef or receipt state outside ciphertext.

## Local persistence
IndexedDB schema v6 adds `payments` with public routing minimum (`paymentId`, `chatId`, `updatedAt`) plus a Vault-sealed blob containing the full intent/receipt lifecycle.

## UI
Finance strip becomes functional only when provider capabilities are present. Payment composer requires asset/network/amount and shows a preview/confirmation screen. Chat renders payment cards with local status. No fake balance is shown.

## Integration with SYNERGIA Pay
The bridge is compatible with a provider backed by `synergy_pay_system`, but the messenger never calls live execution directly. A production adapter must enforce that system's compliance/readiness/custody boundary.

## Definition of Done
- strict intent/receipt validation
- float rejection and atomic-unit arithmetic
- Vault-sealed payment repository
- pairwise E2E payment events
- MLS E2E payment events
- explicit authorization boundary
- idempotent submit/receipt updates
- no private-key/signing primitive in runtime
- provider unavailable = payments disabled only
- UI payment cards and request/send flow
- all prior tests stay green

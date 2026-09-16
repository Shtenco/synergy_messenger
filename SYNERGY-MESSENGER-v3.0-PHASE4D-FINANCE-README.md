# SYNERGY Messenger v3.0.0-alpha.7 — Phase 4D Finance Bridge

Phase 4D adds a **non-custodial payment capability** to direct Double Ratchet chats and MLS groups.

## Security boundary

Messenger never receives a wallet private key and exposes no generic raw signing API. A payment remains local draft/preview state until the user explicitly confirms it through an injected Finance provider. The only money-moving boundary is `FinanceBridgeProvider.authorizeAndSubmit(intent)`.

Providers exposing `getPrivateKey`, `exportPrivateKey`, `importPrivateKey`, `signTransaction` or `signRawTransaction` are rejected. Returned receipts must also pass `provider.verifyReceipt()` before Messenger publishes them to the E2E chat.

## Exact amounts

Human decimal input is converted to integer atomic-unit strings without JavaScript floating-point arithmetic. Exponent notation, negatives, rounding and excess fractional precision are rejected.

## E2E protocol

`PaymentIntent`, `PaymentReceipt` and status events reuse the existing secure application channels:

- 1:1: Double Ratchet
- groups: MLS provider application messages

Asset, network, amount, memo and transaction references are absent from outer transport packet bodies.

Incoming receipts are shown as **peer-reported** status. E2E authenticates the sender but does not independently prove blockchain/bank settlement. Local Finance provider verification is required for locally generated receipts.

## Local persistence

IndexedDB schema v6 adds `payments`. Full payment records are Vault-sealed; raw rows retain only minimum routing metadata (`paymentId`, `chatId`, `updatedAt`, sealed ciphertext).

## Runtime provider

Browser/Capacitor runtime optionally reads `globalThis.SYNERGY_FINANCE_BRIDGE`. If it is absent, invalid or unsafe, Finance is disabled while P2P messaging, media, voice and groups continue normally.

A production adapter may be backed by `synergy_pay_system`, but the Messenger does not bypass that system's compliance, readiness, custody or execution gates.

## UI

The ◈ button now opens a real two-step payment flow:

1. select an asset/network announced by provider capabilities;
2. enter an exact decimal amount and optional E2E memo;
3. obtain provider preview;
4. explicitly confirm in Finance;
5. publish the verified receipt as an E2E payment card.

No demo balance or hard-coded payment endpoint exists.

## Release boundaries

This release does not claim live banking/crypto execution by itself. Live capability depends entirely on a separately configured Finance provider with lawful accounts, credentials, compliance controls and custody/signing infrastructure. Messenger remains non-custodial by design.

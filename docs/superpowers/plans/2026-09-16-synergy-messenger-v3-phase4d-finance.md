# Finance Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-custodial Finance Bridge to pairwise and MLS chats without exposing wallet signing keys to Messenger.

**Architecture:** A strict payment protocol and Vault-sealed repository sit below a FinanceController. An injected provider owns preview/authorization/submission. Payment events reuse existing Double Ratchet and MLS encryption.

**Tech Stack:** JavaScript ES modules, WebCrypto/Vault, IndexedDB, existing SecureMessengerCore, GroupMessagingCore, UnifiedMessengerController.

**Spec:** `docs/superpowers/specs/2026-09-16-synergy-messenger-v3-phase4d-finance-design.md`

## Global Constraints
- No private key import/export or generic signing primitive in Messenger runtime.
- Amounts are integer atomic-unit strings only.
- Payment payloads must be E2E encrypted.
- Production payment execution requires explicit provider authorization.
- Existing messaging remains usable without a Finance provider.

---

### Task 1: Payment protocol + repository
**Files:** create `src/v3/finance/payment-protocol.js`, `src/v3/finance/payment-repository.js`; modify `src/v3/storage/db.js`; tests under `tests/v3/finance/`.
**Interfaces:** produces `validatePaymentIntent`, `validatePaymentReceipt`, `PaymentRepository`.
- [ ] Write failing validation and sealed-at-rest tests.
- [ ] Run tests and verify RED.
- [ ] Implement canonical validation and schema v6 repository.
- [ ] Run tests and verify GREEN.

### Task 2: Provider boundary + controller
**Files:** create `src/v3/finance/finance-bridge-provider.js`, `src/v3/finance/finance-controller.js`.
**Interfaces:** produces `FinanceController.createDraft`, `preview`, `authorizeAndSubmit`, `refresh`.
- [ ] Write tests proving no submit occurs before authorization and duplicate authorization is idempotent.
- [ ] Run RED.
- [ ] Implement minimal provider/controller.
- [ ] Run GREEN.

### Task 3: Pairwise + MLS encrypted payment events
**Files:** modify `src/v3/core/secure-payload.js`, `src/v3/secure-messenger-core.js`, `src/v3/groups/group-payload.js`, `src/v3/groups/group-controller.js`, `src/v3/groups/unified-messenger-controller.js`.
- [ ] Write wire tests asserting amount/asset/memo are absent from opaque packets.
- [ ] Run RED.
- [ ] Add payment send/receive events to both secure paths.
- [ ] Run GREEN.

### Task 4: UI and runtime composition
**Files:** modify `src/v3/index.js`, `js/v3-bootstrap.js`, `js/app.js`, `index.html`, CSS if needed.
- [ ] Write runtime/UI regression tests for provider gating, payment modal/card and no fake balance.
- [ ] Run RED.
- [ ] Add injected `SYNERGY_FINANCE_BRIDGE` adapter and payment UI.
- [ ] Run GREEN.

### Task 5: Release verification
- [ ] `npm run build:www`
- [ ] `npm test`
- [ ] syntax sweep runtime JS
- [ ] grep audit for private-key/signTransaction/export-secret patterns and direct finance endpoints
- [ ] source↔www hashes
- [ ] package alpha.7 and verify ZIP

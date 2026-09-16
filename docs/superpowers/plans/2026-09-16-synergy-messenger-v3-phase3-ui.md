# SYNERGY Messenger V3 Phase 3 UI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace v2.1 demo chat behavior with persistent local contacts, encrypted history, real SecureMessengerCore messaging, encrypted delivery/read receipts, and offline P2P Contact Card/Public ID onboarding.

**Architecture:** Add a UI-domain layer between DOM code and SecureMessengerCore. Store only public contact metadata in clear IndexedDB stores; encrypt all message display/history records with the existing Vault. Extend SecureMessengerCore with versioned encrypted application payloads for text and receipts, while keeping transport packets opaque.

**Tech Stack:** ES modules, WebCrypto, IndexedDB, existing V3 Vault/CryptoEngine/SyncEngine, Capacitor static web bundle, node:test TDD.

**Spec:** `docs/PHASE3-UI-DESIGN.md`

## Global Constraints
- No central API, user database, or mandatory directory server.
- New plaintext history must never be written into `messages`, `outbox`, `inbox`, `conversations`, or `contacts` stores.
- Contact Card must be self-contained and verifiable by existing prekey verification.
- Phase 3 supports 1:1 secret chats only.
- Existing Phase 1 and Phase 2 tests must remain green.
- Existing visual CSS/layout should be preserved unless a Phase 3 control requires an additive style.

---

### Task 1: Phase-3 database and encrypted UI history

**Files:**
- Modify: `src/v3/storage/db.js`
- Modify: `tests/v3/helpers/memory-db.js`
- Create: `src/v3/ui/contact-repository.js`
- Create: `src/v3/ui/conversation-repository.js`
- Create: `src/v3/ui/history-repository.js`
- Test: `tests/v3/ui/repositories.test.js`

**Interfaces:**
- `ContactRepository.put/get/list/delete`
- `ConversationRepository.put/get/list/delete`
- `HistoryRepository.put/get/update/listByChat/delete`

- [ ] Write tests proving schema v3 stores exist, contact/conversation persistence works, and raw `uiHistory` rows do not contain message plaintext.
- [ ] Run the test and confirm RED because Phase-3 stores/repositories do not exist.
- [ ] Implement schema v3 and repositories using Vault AAD `SYNERGY-HISTORY-V1|chatId|messageId`.
- [ ] Re-run repository tests and full existing storage/crypto regression.
- [ ] Commit `feat: add encrypted phase3 ui repositories`.

### Task 2: Versioned secure payloads and encrypted receipts

**Files:**
- Create: `src/v3/core/secure-payload.js`
- Modify: `src/v3/secure-messenger-core.js`
- Modify: `src/v3/index.js`
- Test: `tests/v3/ui/secure-payload.test.js`
- Test: `tests/v3/ui/secure-receipts.test.js`

**Interfaces:**
- `encodeSecurePayload(payload): Uint8Array`
- `decodeSecurePayload(bytes): payload`
- `SecureMessengerCore.sendReceipt(peerBundle, targetMessageId, state)`
- `SecureMessengerCore.onReceipt(handler)`
- Existing `sendText()` continues returning `{messageId, sessionId}` and `onMessage()` continues exposing `text`.

- [ ] Write RED tests for typed text payload, backwards-compatible legacy text, encrypted delivered/read receipt and invalid receipt state rejection.
- [ ] Implement the minimal payload codec and SecureMessengerCore routing.
- [ ] Verify ciphertext packet bodies contain neither text nor receipt target plaintext.
- [ ] Run Phase-2 secure-core regressions plus new tests.
- [ ] Commit `feat: add encrypted message receipts`.

### Task 3: Public ID and self-contained P2P Contact Card

**Files:**
- Create: `src/v3/ui/contact-card.js`
- Test: `tests/v3/ui/contact-card.test.js`

**Interfaces:**
- `formatPublicId(identity): string`
- `encodeContactCard({name,bundle}): string`
- `decodeContactCard(uri): {name,bundle}`

- [ ] Write RED tests for stable Public ID, round-trip typed arrays, malformed card rejection and bundle verification compatibility.
- [ ] Implement local base64url Contact Card codec with `synergy://contact/v1/` prefix.
- [ ] Ensure export uses a bundle with zero one-time prekeys so QR/import does not depend on mutable OPK availability.
- [ ] Run tests.
- [ ] Commit `feat: add offline p2p contact cards`.

### Task 4: MessengerController and delivery/read state machine

**Files:**
- Create: `src/v3/ui/messenger-controller.js`
- Test: `tests/v3/ui/messenger-controller.test.js`

**Interfaces:**
- `start()/stop()`
- `addContact({name,bundle})`
- `listChats()`
- `getMessages(chatId)`
- `sendText(chatId,text,{reply,expiresAt})`
- `markRead(chatId)`
- `onUpdate(handler)`

- [ ] Write RED tests for contact->chat creation, outbound encrypted history, `sending->sent->delivered->read`, incoming encrypted persistence, automatic delivered receipt, read receipt on open, restart restore and unknown-sender quarantine/no crash.
- [ ] Implement the controller with buffered status events to handle SyncEngine's synchronous send-status race.
- [ ] Ensure state transitions are monotonic and duplicate receipts idempotent.
- [ ] Run controller tests and full suite.
- [ ] Commit `feat: connect secure core to persistent messenger model`.

### Task 5: Replace v2.1 demo UI with real V3 adapter

**Files:**
- Create: `js/v3-bootstrap.js`
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `css/app.css`
- Modify: `scripts/copy-www.js` only if needed by new static files
- Modify: `sw.js`
- Test: `tests/v3/ui/app-regression.test.js`

**Interfaces:**
- `createBrowserV3Runtime()` constructs DB + crypto + P2P + controller.
- DOM adapter reads controller snapshots and never seeds demo chats.

- [ ] Write RED source/regression tests asserting `DEMO_CHATS_SEED` and `simulateReply` are absent and Phase-3 runtime imports are present.
- [ ] Add browser runtime factory without hard-coded central endpoints.
- [ ] Replace init/send/create-chat paths with controller calls while retaining reply/forward/emoji rendering.
- [ ] Add settings Public ID / copy invite / QR modal and new-chat Contact Card import.
- [ ] Render `sending/sent/delivered/read/failed` checks from real history status.
- [ ] Update service worker and copy script so `www/` contains the complete Phase-3 runtime.
- [ ] Run `npm run build:www` and full tests.
- [ ] Commit `feat: wire v2 ui to v3 secure messenger core`.

### Task 6: Phase-3 verification and packaging

**Files:**
- Modify: `package.json`
- Create: `docs/V3-PHASE3-UI.md`

- [ ] Set version `3.0.0-alpha.3` and document exact Phase-3 security/product boundary.
- [ ] Run full tests from clean tree.
- [ ] Run `npm run build:www` then run full tests again.
- [ ] Audit `js/app.js` for demo chat/reply code and `src/v3` for central HTTP/WSS endpoints or plaintext logging.
- [ ] Verify raw test DB history rows contain no message text.
- [ ] Create release ZIP and SHA-256 checksum.
- [ ] Commit `build: finalize phase3 messenger ui alpha`.

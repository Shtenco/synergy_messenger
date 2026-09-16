# SYNERGY Messenger V3 Phase-4A Media Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add encrypted, resumable, direct-P2P file/image transfer and wire it into the existing messenger UI without a central media server.

**Architecture:** The Double Ratchet carries an encrypted media manifest while a dedicated reliable unordered WebRTC DataChannel carries independently encrypted chunks. IndexedDB v4 stores sealed metadata/transfer state and ciphertext chunks; a media manager coordinates preparation, requests, resume, integrity and progress.

**Tech Stack:** Browser WebCrypto, IndexedDB, WebRTC RTCDataChannel, ES modules, Node `node:test`, existing SYNERGY V3 crypto/P2P/UI layers.

**Spec:** `docs/superpowers/specs/2026-09-16-synergy-messenger-v3-phase4a-media-design.md`

## Global Constraints

- No mandatory central server/CDN or bulk Waku media transfer.
- Existing 99 Phase-3 tests must remain green.
- `mediaKey`, filename and MIME metadata must not be stored in clear IndexedDB rows.
- Chunks must be authenticated independently and idempotent/out-of-order safe.
- Default chunk plaintext target is 48 KiB.
- WebRTC media channel label is `synergy-media-v1`, reliable and unordered.
- UI must not auto-preview SVG/HTML/JS/unknown active content.
- Version after completion: `3.0.0-alpha.4`.

---

### Task 1: Media crypto, manifest and frame contracts

**Files:**
- Create: `src/v3/media/media-manifest.js`
- Create: `src/v3/media/media-crypto.js`
- Create: `src/v3/media/media-frame.js`
- Create: `src/v3/media/incremental-sha256.js`
- Test: `tests/v3/media/media-crypto.test.js`
- Test: `tests/v3/media/media-frame.test.js`

**Interfaces:**
- `createMediaManifest(input)` / `validateMediaManifest(manifest)`
- `MediaCrypto.encryptChunk({mediaKey, mediaId, chunkIndex, chunkCount, plaintext})`
- `MediaCrypto.decryptChunk(...)`
- `encodeMediaFrame(frame)` / `decodeMediaFrame(bytes)`

- [x] Write tests proving per-chunk round trip, AAD tamper rejection, key/index separation, incremental SHA-256 parity with WebCrypto, strict manifest validation and frame round-trip.
- [x] Run `npm test -- --test-name-pattern='media'` and verify RED because media modules do not exist.
- [x] Implement the smallest contracts satisfying the tests with `WebCryptoProvider` primitives and deterministic AAD `SYNERGY-MEDIA-V1|mediaId|index|count|length`.
- [x] Re-run the media tests and verify GREEN.
- [x] Run the full suite to ensure Phase-3 remains green.

### Task 2: Schema v4 and encrypted media repositories

**Files:**
- Modify: `src/v3/storage/db.js`
- Modify: `tests/v3/helpers/memory-db.js`
- Create: `src/v3/media/media-repository.js`
- Create: `src/v3/media/media-blob-store.js`
- Test: `tests/v3/media/media-repository.test.js`

**Interfaces:**
- `MediaRepository.putObject/getObject/putTransfer/getTransfer/updateTransfer`
- `MediaBlobStore.putChunk/getChunk/listChunkIndexes/deleteMedia`

- [x] Write failing tests that inspect raw stores and prove metadata is sealed while chunk rows contain ciphertext only; test duplicate chunk idempotence and schema version 4.
- [x] Run repository tests and verify RED.
- [x] Upgrade DB and implement repositories using the existing `Vault` with media-specific AAD.
- [x] Re-run tests and verify GREEN, then run existing storage/crypto tests.

### Task 3: Dedicated WebRTC media channel with backpressure

**Files:**
- Modify: `src/v3/transport/webrtc-transport.js`
- Create: `src/v3/transport/webrtc-media-transport.js`
- Test: `tests/v3/transport/webrtc-media-transport.test.js`

**Interfaces:**
- `WebRtcTransport.registerDataChannelProtocol(label, handler)`
- `WebRtcTransport.openDataChannel(peerMailbox, label, options)`
- `WebRtcMediaTransport.sendFrame(peerMailbox, bytes)` / `onFrame(handler)`

- [x] Write failing tests for `synergy-media-v1`, `{ordered:false}`, max-message guard, receive dispatch and high/low-water backpressure.
- [x] Verify RED.
- [x] Extend peer sessions with auxiliary channels and implement the media wrapper without changing ordinary `synergy-v3` packet semantics.
- [x] Verify GREEN and rerun all existing WebRTC/Hybrid tests.

### Task 4: Resumable MediaManager

**Files:**
- Create: `src/v3/media/media-manager.js`
- Create: `src/v3/media/media-replica-provider.js`
- Test: `tests/v3/media/media-manager.test.js`

**Interfaces:**
- `prepare({source,name,mime,expiresAt}) -> manifest`
- `registerIncoming({manifest,peerMailbox,peerDeviceId})`
- `request(mediaId)` / `cancel(mediaId)` / `readBlob(mediaId)`
- events: `progress`, `ready`, `failed`, `waiting`

- [x] Write failing tests for multi-chunk prepare, out-of-order/duplicate chunks, corrupted chunk rejection, disconnect/reopen resume, cancel, two concurrent transfers and final digest mismatch.
- [x] Verify RED.
- [x] Implement persistent transfer orchestration over media frames and the null replica-provider interface.
- [x] Verify GREEN and full regression.

### Task 5: Secure media manifest and controller integration

**Files:**
- Modify: `src/v3/core/secure-payload.js`
- Modify: `src/v3/secure-messenger-core.js`
- Modify: `src/v3/ui/messenger-controller.js`
- Modify: `src/v3/index.js`
- Modify: `js/v3-bootstrap.js`
- Test: `tests/v3/ui/secure-media.test.js`
- Test: `tests/v3/ui/messenger-media-controller.test.js`

**Interfaces:**
- `SecureMessengerCore.sendMedia(peerBundle, manifest, {messageId,expiresAt})`
- `SecureMessengerCore.onMedia(handler)`
- `MessengerController.sendFile(chatId,file)` / `downloadMedia(messageId)` / `cancelMedia(messageId)` / `readMedia(messageId)`

- [x] Write failing tests proving the wire packet contains no filename/media key plaintext, incoming manifests create encrypted history records, receipts remain monotonic and progress survives restart.
- [x] Verify RED.
- [x] Add media secure payload support and controller orchestration.
- [x] Verify GREEN plus all Phase-3 tests.

### Task 6: Attach/file/image UI and Capacitor build

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/app.css`
- Modify: `sw.js`
- Modify: `package.json`
- Modify: `scripts/copy-www.js` only if runtime copying needs adjustment
- Test: `tests/v3/ui/media-app-regression.test.js`
- Test: `tests/v3/build-regression.test.js`

**Interfaces:**
- hidden native file picker triggered by `#btnAttach`
- attachment bubble with state/progress/retry/cancel/open

- [x] Write failing DOM/source regression tests proving the Phase-4 placeholder is gone and safe media states are rendered.
- [x] Verify RED.
- [x] Wire the real file picker and controller calls; add safe image preview only for the allowlist.
- [x] Run `npm run build:www` and full tests.
- [x] Set package version to `3.0.0-alpha.4`, update Phase-4A docs, audit for central upload URLs/plaintext media metadata, and package the verified tree.

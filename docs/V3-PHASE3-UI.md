# SYNERGY Messenger V3 — Phase 3 UI (`3.0.0-alpha.3`)

## What Phase 3 changes

Phase 3 replaces the v2.1 demo chat model with the real V3 local/P2P stack while preserving the visual shell. `DEMO_CHATS_SEED` and `simulateReply()` are removed. The UI now talks to `MessengerController`, which persists encrypted local history and routes outbound content through `SecureMessengerCore` -> Double Ratchet -> Phase-1 P2P Core.

## Real message path

```text
UI text
  -> MessengerController (optimistic encrypted local record: sending)
  -> SecureMessengerCore
  -> versioned secure application payload
  -> CryptoEngine / Double Ratchet
  -> opaque SynergyPacket
  -> HybridTransport
       -> WebRTC direct first
       -> Waku fallback/store
```

Inbound traffic follows the reverse path. Plaintext is emitted to the DOM only after authenticated decrypt.

## Local data model

IndexedDB schema v3 adds:

- `contacts` — local display name + public signed peer bundle;
- `conversations` — chat metadata without plaintext preview;
- `uiHistory` — clear routing metadata plus an AES-GCM `sealed` display record.

The encrypted history record contains message text, reply metadata, UI state, expiry and read state. The raw `uiHistory` row never contains message text or status.

## Real delivery states

Outbound UI state is monotonic:

```text
sending -> sent -> delivered -> read
             \-> failed
```

- `sending`: encrypted local record exists before network handoff;
- `sent`: P2P Core accepted the ciphertext handoff;
- `delivered`: recipient decrypted/persisted and returned an E2E receipt;
- `read`: recipient opened the conversation and returned an E2E read receipt.

Receipts themselves are Double-Ratchet encrypted. Relay/store peers do not receive the target message ID or receipt state in plaintext.

## Contacts without a central directory

There is no global `users` table or mandatory SYNERGY account server.

- **Public ID** is the stable `SYN3-...` identity fingerprint used for human verification.
- **P2P Invite** is `synergy://contact/v1/...` and contains only public identity material + signed prekey. It is self-contained and supports the 3-DH bootstrap path without server lookup.
- **Public ID QR** is generated entirely on-device. It is a verification QR, not a centralized discovery lookup.

The full P2P Invite is copyable in Phase 3. A high-capacity QR containing the full Contact Card can be added later without changing the contact-card protocol.

## UI behavior

Implemented:

- persistent chat list from encrypted local repositories;
- real message history after restart;
- real send / receive / delivered / read states;
- reply metadata inside E2E payloads;
- real forwarding as a new encrypted send;
- disappearing-message expiry carried inside the E2E payload and expired records purged from encrypted local history;
- emoji picker retained;
- Contact creation from P2P Invite;
- Public ID / safety fingerprint / P2P Invite settings;
- local Public ID QR;
- honest LOCAL/OFFLINE state when the network SDK is unavailable;
- no demo peer replies, fake Finance balance or fake username;
- no Google Fonts/CDN requests from the app shell.

## Capacitor bundle hygiene

`scripts/copy-www.js` now copies an explicit runtime allowlist only:

- `index.html`
- `manifest.json`
- `sw.js`
- `css/`
- `icons/`
- `js/`
- `src/`

Tests, specifications, worktrees, package metadata and build documentation are not shipped inside `www/`.

## Security edge fixed during Phase 3

An established Double-Ratchet session continues to work after the peer's historical signed-prekey bundle expires. New sessions still require a valid unexpired signed prekey. Existing sessions still enforce the pinned identity fingerprint, so a changed identity remains fail-closed (`IDENTITY_CHANGED`).

## Current network limitation

This repository declares `@waku/sdk`, but the execution environment used to build this alpha could not reach the npm registry. Therefore the browser runtime accepts a locally bundled/injected SDK (`globalThis.SYNERGY_WAKU_SDK`) and otherwise starts in honest local/offline mode. No CDN fallback is introduced.

A production Android build must bundle the Waku SDK locally before claiming real network-online operation on devices.

## Phase 3 non-goals

Still deferred to later phases:

- media/file/voice transfer;
- groups and group-key epochs;
- Finance Bridge transactions;
- Android Keystore/native foreground P2P service;
- high-capacity full Contact-Card QR;
- multi-device Sesame-style session management;
- independent external security audit.

## Verification

The Phase-3 automated suite covers P2P Core, WebCrypto/X3DH-style bootstrap, Double Ratchet, persistence/restart, encrypted history, contact cards, receipts, controller/UI integration, build copying and regressions. See the release notes produced with the Phase-3 archive for the final fresh test count and archive SHA-256.

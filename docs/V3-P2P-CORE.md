# SYNERGY Messenger V3 — Phase 1 P2P Core

Phase 1 adds a local-first messaging engine under `src/v3/` without wiring it into the existing v2.1 UI.

## What is implemented

- canonical opaque `SynergyPacket` codec and validation;
- IndexedDB production database (`synergy-messenger-v3`, schema v1);
- durable outbox, inbox dedupe ledger, message records and advisory peer cache;
- exponential retry with ±20% jitter and 5 minute cap;
- restart recovery for stale `sending` rows;
- direct-first `HybridTransport`;
- Waku LightPush/Filter/Store adapter with replaceable bootstrap configuration;
- Waku-based opaque WebRTC signaling;
- ordered reliable WebRTC `RTCDataChannel` transport;
- restart-safe `SyncEngine` facade and delivery/status events.

No Phase-1 module needs a SYNERGY central API, account server, message database or authentication server.

## Instantiate the source stack

```js
import { createDefaultP2PCore, createPacket } from './src/v3/index.js';

const core = createDefaultP2PCore({
  localMailbox: 'opaque-mailbox-from-future-identity-layer',
  senderDeviceId: 'device-id-from-future-identity-layer'
});

core.onPacket(packet => {
  // packet.body is opaque bytes. Decryption belongs to Phase 2.
});

await core.start();
```

`localMailbox` and `senderDeviceId` are deliberately supplied by the caller because production identity/crypto belongs to Phase 2.

## Waku packaging note

The original v2.1 app is a static module application, not a Vite/Webpack build. `WakuTransport` therefore supports SDK injection for tests and uses `import('@waku/sdk')` for a future bundled build. Before V3 is connected to the Capacitor UI, `@waku/sdk` must be bundled or vendored into the app package; do not replace this with a mandatory runtime CDN dependency.

## Tests

The repository test command is intentionally network-independent:

```bash
npm test
```

The implementation session used Node's built-in test runner because the execution environment could not reach npm to install Vitest/fake-indexeddb. Tests use an in-memory repository driver for deterministic TDD. The approved design's `fake-indexeddb` browser-schema CI check should be added when package installation is available; the production storage implementation itself is real IndexedDB.

No automated test connects to public Waku peers.

## Current boundary

Phase 1 does **not** claim production E2E security and does not replace `js/crypto.js`. The current v2.1 UI remains unchanged. Phase 2 must supply identity, secure key storage and production message encryption before real user plaintext is allowed into V3.

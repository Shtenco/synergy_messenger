# SYNERGY Messenger V3 P2P Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase-1 local-first P2P messaging engine with durable IndexedDB queues, duplicate-safe inbox processing, direct-first hybrid routing, Waku fallback/history, and WebRTC direct transport while leaving the v2.1 UI unchanged.

**Architecture:** New code is isolated under `src/v3/` and exposed through a single `P2PCore` facade. Packets are opaque binary envelopes; storage is durable and transport-agnostic. `HybridTransport` attempts WebRTC first and Waku in the same attempt when direct delivery is unavailable or fails.

**Tech Stack:** Browser ES modules, IndexedDB, Web Crypto UUID, WebRTC DataChannel, `@waku/sdk`, Vitest, `fake-indexeddb`, Capacitor 6 existing shell.

**Spec:** `docs/superpowers/specs/2026-09-15-synergy-messenger-v3-p2p-core-design.md`

## Global Constraints

- No mandatory central SYNERGY API/auth/message server.
- Database name `synergy-messenger-v3`, schema version `1`.
- Packet envelope limit is `256 KiB`.
- Phase 1 treats `packet.body` as opaque bytes and never logs/interprets plaintext semantics.
- Waku infrastructure is replaceable; code must not assume one fixed peer.
- Existing v2.1 UI and demo behavior remain unchanged in Phase 1.
- Transport status `sent` means transport handoff only; delivered/read require future explicit receipts.

---

### Task 1: Packet contract and deterministic core utilities

**Files:**
- Create: `src/v3/core/packet.js`
- Create: `src/v3/core/events.js`
- Create: `src/v3/core/clock.js`
- Test: `tests/v3/core/packet.test.js`
- Test: `tests/v3/core/events.test.js`

**Interfaces:**
- Produces: `createPacket(input)`, `validatePacket(packet)`, `encodePacket(packet)`, `decodePacket(bytes)`, `PACKET_MAX_BYTES`, `CoreEventEmitter`, `SystemClock`.

- [ ] Write tests proving version/kind/body/expiry/size validation, byte-for-byte body preservation, deterministic codec round-trip, generated message IDs, and event unsubscribe behavior.
- [ ] Run tests and verify RED because modules do not exist.
- [ ] Implement minimal utilities and codec needed for GREEN.
- [ ] Run focused tests, then full test suite.
- [ ] Commit `feat(v3): add opaque packet contract`.

### Task 2: IndexedDB repositories, persistence, and dedupe

**Files:**
- Create: `src/v3/storage/db.js`
- Create: `src/v3/storage/message-repository.js`
- Create: `src/v3/storage/outbox-repository.js`
- Create: `src/v3/storage/inbox-repository.js`
- Create: `src/v3/storage/peer-repository.js`
- Test: `tests/v3/storage/repositories.test.js`

**Interfaces:**
- Produces: `openSynergyDb()`, `deleteSynergyDb()`, `MessageRepository`, `OutboxRepository`, `InboxRepository`, `PeerRepository`.
- `OutboxRepository.enqueue(packet, now)`, `listDue(now, limit)`, `markSending`, `markSent`, `scheduleRetry`, `markTerminal`, `repairStaleSending(now)`.
- `InboxRepository.claim(messageId, sourceTransport, now)` returns boolean and guarantees first-writer dedupe.

- [ ] Write failing tests using `fake-indexeddb` for schema/indexes, reopen persistence, due queue ordering, stale `sending` recovery, and duplicate inbox claim.
- [ ] Run focused tests and verify RED.
- [ ] Implement transaction helpers and repositories.
- [ ] Run focused tests and full suite.
- [ ] Commit `feat(v3): add durable message queues`.

### Task 3: Transport contract, retry policy, and HybridTransport

**Files:**
- Create: `src/v3/transport/transport.js`
- Create: `src/v3/transport/hybrid-transport.js`
- Create: `src/v3/sync/outbox-worker.js`
- Test: `tests/v3/transport/hybrid-transport.test.js`
- Test: `tests/v3/sync/outbox-worker.test.js`

**Interfaces:**
- Produces: `sentResult(transport)`, `retryableResult(code, transport?)`, `terminalResult(code)`, `HybridTransport`, `computeRetryAt({attempt, now, random})`, `OutboxWorker`.
- `HybridTransport.send(packet)` prefers direct, falls back to Waku in the same call, and returns normalized results only.

- [ ] Write failing tests for direct-first success, direct failure + Waku success, both failure normalization, expiry terminal behavior, exact retry formula/jitter bounds, successful outbox handoff, and retry scheduling.
- [ ] Verify RED.
- [ ] Implement minimal transport result helpers, router, and worker.
- [ ] Run focused tests and full suite.
- [ ] Commit `feat(v3): add hybrid routing and durable retries`.

### Task 4: Inbox pipeline and lifecycle engine

**Files:**
- Create: `src/v3/sync/inbox-worker.js`
- Create: `src/v3/sync/sync-engine.js`
- Create: `src/v3/index.js`
- Test: `tests/v3/sync/inbox-worker.test.js`
- Test: `tests/v3/sync/sync-engine.test.js`
- Test: `tests/v3/integration/restart-delivery.test.js`

**Interfaces:**
- Produces: `InboxWorker.process(packet, sourceTransport)`, `SyncEngine.start()`, `stop()`, `enqueue()`, `syncHistory()`, `onPacket()`, `onStatus()`, `createP2PCore(options)`.

- [ ] Write failing tests proving duplicate packets from multiple transports reach upper layer once, enqueue persists before send, pending rows survive reopen/restart, stale send recovery occurs on start, and start/stop are idempotent.
- [ ] Verify RED.
- [ ] Implement workers, engine, facade, and in-process fake transport integration fixture.
- [ ] Run focused integration tests and full suite.
- [ ] Commit `feat(v3): add restart-safe sync engine`.

### Task 5: Replaceable Waku adapter and history synchronization

**Files:**
- Create: `src/v3/config/network-config.js`
- Create: `src/v3/transport/waku-transport.js`
- Create: `src/v3/transport/signaling-bus.js`
- Create: `src/v3/transport/waku-signaling.js`
- Test: `tests/v3/config/network-config.test.js`
- Test: `tests/v3/transport/waku-transport.test.js`
- Test: `tests/v3/transport/waku-signaling.test.js`

**Interfaces:**
- Produces: `validateNetworkConfig`, `DEFAULT_NETWORK_CONFIG`, `WakuTransport`, `WakuSignalingBus`.
- `WakuTransport` accepts an injectable `sdk`/node factory for tests and uses official SDK shape in production: `createLightNode`, `createEncoder`, `createDecoder`, `lightPush.send`, Filter subscription, Store ordered callback.
- `WakuTransport.syncHistory()` feeds the same packet callback as live Filter messages.

- [ ] Write failing fake-node tests for bootstrap options, lifecycle, LightPush send, Filter receive, Store history, unsubscribe, malformed payload rejection, and signaling mailbox separation.
- [ ] Verify RED.
- [ ] Implement adapter against current browser SDK API with dynamic SDK import.
- [ ] Run focused tests and full suite.
- [ ] Commit `feat(v3): add decentralized Waku transport`.

### Task 6: WebRTC direct transport

**Files:**
- Create: `src/v3/transport/webrtc-transport.js`
- Test: `tests/v3/transport/webrtc-transport.test.js`

**Interfaces:**
- Produces: `WebRtcTransport` with `start`, `stop`, `canSend`, `send`, `connectPeer` and reusable ordered reliable data channels. Signaling is supplied only through the `SignalingBus` interface.

- [ ] Write failing tests with a fake `RTCPeerConnection` for channel reuse, direct availability, packet transmission, inbound delivery, malformed signaling isolation, timeout result, and idempotent stop.
- [ ] Verify RED.
- [ ] Implement the minimum peer/session state machine.
- [ ] Run focused tests and full suite.
- [ ] Commit `feat(v3): add direct WebRTC transport`.

### Task 7: Build integration and regression checks

**Files:**
- Modify: `package.json`
- Modify: `scripts/copy-www.js` only if needed to bundle/copy `src/v3/` into Capacitor `www/`.
- Modify: `sw.js` to cache the existing missing `ui-extras.js` and version cache without enabling V3 UI integration.
- Test: `tests/v3/build-regression.test.js`
- Create: `docs/V3-P2P-CORE.md`

**Interfaces:**
- Produces: `npm test`, `npm run test:v3`, and a Capacitor copy containing `www/src/v3/**` while existing `www/js/app.js` remains unchanged.

- [ ] Write failing regression test proving the build copy includes V3 modules and the service worker includes `ui-extras.js`.
- [ ] Verify RED.
- [ ] Update package/build/service-worker configuration and document how to instantiate the core without wiring it into v2.1 UI.
- [ ] Run `npm test`, `npm run build:www`, compare v2.1 UI source hash before/after, and verify no test depends on public Waku availability.
- [ ] Commit `build(v3): package p2p core without ui migration`.

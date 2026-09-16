# SYNERGY Messenger V3 — Phase 1 P2P Core Design

**Parent design:** `docs/superpowers/specs/2026-09-15-synergy-messenger-v3-architecture-design.md`  
**Scope:** Phase 1 only. No production cryptography and no UI migration in this phase.

## Goal

Build a durable, local-first P2P messaging engine that moves opaque packet bytes over direct WebRTC when possible and Waku when direct delivery is unavailable, without adding a mandatory central application server.

## Non-goals

Phase 1 does not:

- replace the current `js/crypto.js`;
- claim message content is production E2E-secure;
- remove demo UI/data;
- implement media upload, groups or Finance;
- generate/sign an Android release.

## Module map

New modules are isolated under `src/v3/`.

```text
src/v3/
  core/
    packet.js              packet validation + immutable helpers
    events.js              small typed event emitter
    clock.js               injectable clock for deterministic retries/tests
  storage/
    db.js                  IndexedDB open/upgrade transaction helpers
    message-repository.js  chats/messages persistence boundary
    outbox-repository.js   durable send queue
    inbox-repository.js    dedupe/processing ledger
    peer-repository.js     cached replaceable transport peer observations
  transport/
    transport.js           common transport contract/result types
    waku-transport.js      LightPush/Filter/Store adapter
    signaling-bus.js       opaque signaling contract
    waku-signaling.js      Waku-backed signaling packets
    webrtc-transport.js    RTCDataChannel direct peer transport
    hybrid-transport.js    direct-first + Waku fallback routing
  sync/
    outbox-worker.js       retry state machine and delivery attempts
    inbox-worker.js        validation/dedupe/dispatch
    sync-engine.js         lifecycle start/stop + transport subscriptions
  config/
    network-config.js      validated bootstrap/STUN/network settings
  index.js                 public Phase-1 API
```

Tests mirror the modules under `tests/v3/`.

## Public API

Phase 1 exposes one facade. The UI will depend only on this facade in Phase 3.

```ts
interface P2PCore {
  start(): Promise<void>;
  stop(): Promise<void>;
  enqueue(packet: SynergyPacket): Promise<{ messageId: string }>;
  onPacket(handler: (packet: SynergyPacket) => Promise<void> | void): () => void;
  onStatus(handler: (event: DeliveryStatusEvent) => void): () => void;
  syncHistory(): Promise<void>;
}
```

Transport contract:

```ts
interface Transport {
  readonly name: string;
  start(onPacket: (packet: SynergyPacket) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
  canSend(packet: SynergyPacket): Promise<boolean>;
  send(packet: SynergyPacket): Promise<TransportSendResult>;
}
```

`HybridTransport` is the only transport seen by `OutboxWorker`.

## Packet requirements

`messageId` is generated locally with `crypto.randomUUID()` when an upper layer does not already provide one.

Validation rejects:

- versions other than `3`;
- missing/empty IDs;
- body that is not bytes;
- `expiresAt <= createdAt` when expiry is present;
- packets over the Phase-1 envelope size limit of 256 KiB;
- unsupported `kind` values.

Large media is explicitly deferred to Phase 4 and will use chunk manifests rather than increasing this limit.

## IndexedDB schema

Database: `synergy-messenger-v3`, schema version `1`.

### `messages`

Key: `messageId`.

Fields: `messageId`, `chatId|null`, `direction`, `kind`, `createdAt`, `transportState`, `packet`, `updatedAt`.

`packet.body` remains opaque bytes.

### `outbox`

Key: `messageId`.

Fields: `messageId`, `packet`, `attempt`, `state`, `nextAttemptAt`, `lastTransport`, `lastErrorCode`, `createdAt`, `updatedAt`.

Index: `byNextAttemptAt`.

### `inbox`

Key: `messageId`.

Fields: `messageId`, `firstSeenAt`, `sourceTransport`, `processedAt`, `processingState`.

### `transportPeers`

Key: `peerKey`.

Fields: `peerKey`, `transport`, `address`, `capabilities`, `lastSeenAt`, `failureCount`.

This cache is advisory. Deleting it cannot destroy user identity/history.

## Outbox retry algorithm

Base delay: 2 seconds. Cap: 5 minutes.

```text
rawDelay = min(300000, 2000 * 2^attempt)
jitter = rawDelay * random(-0.20, +0.20)
nextAttemptAt = now + rawDelay + jitter
```

Attempts are durable. A reload resumes all `queued`, `sending`, and `retry_wait` rows; stale `sending` rows are converted to `retry_wait` during startup.

A successful handoff to Waku marks `sent`, not `delivered`. Delivery/read status requires an explicit receipt packet.

## Hybrid routing

For each send:

1. if the packet is expired, return terminal `expired`;
2. if a healthy direct WebRTC channel exists, attempt it;
3. if the direct attempt succeeds, return `sent` with transport `webrtc`;
4. otherwise immediately attempt Waku LightPush;
5. if Waku handoff succeeds, return `sent` with transport `waku`;
6. if both fail, return retryable failure with normalized error code.

Direct errors never prevent Waku fallback in the same attempt.

## Waku transport

Use the browser-oriented `@waku/sdk` Light Node.

Requirements:

- lifecycle is explicit (`start`/`stop`);
- node creation receives validated `NetworkConfig`;
- configuration supports default discovery and/or a list of static bootstrap peers;
- Filter receives new packets;
- Store query retrieves missed packets;
- LightPush publishes outgoing packets;
- duplicate packets from Filter and Store are expected;
- subscription health failures trigger re-subscription with bounded backoff;
- application code never assumes one fixed peer.

Content topics are derived from opaque mailbox IDs supplied by the future Crypto/Identity layer. Phase-1 tests use deterministic test mailbox IDs.

## Waku signaling bus

WebRTC signaling is transported as ordinary opaque `kind='signal'` packets over Waku.

The signaling adapter exposes:

```ts
interface SignalingBus {
  publish(peerMailbox: string, data: Uint8Array): Promise<void>;
  subscribe(localMailbox: string, handler: (data: Uint8Array) => void): Promise<() => void>;
}
```

The bus does not parse SDP and does not know contact identity secrets.

## WebRTC direct transport

`WebRtcTransport` manages `RTCPeerConnection` + ordered reliable `RTCDataChannel` connections.

Rules:

- signaling passes through `SignalingBus`;
- ICE servers come from `NetworkConfig`, never from hard-coded private credentials;
- one channel per peer device may be reused;
- malformed signaling input closes only that peer session;
- direct channel loss does not discard outbox packets;
- packet bytes use the same codec as Waku;
- no plaintext message semantics exist in this module.

## Network configuration

```ts
interface NetworkConfig {
  waku: {
    useDefaultBootstrap: boolean;
    bootstrapPeers: string[];
    contentTopicPrefix: '/synergy/3';
  };
  webrtc: {
    iceServers: RTCIceServer[];
    connectTimeoutMs: number;
  };
}
```

Defaults may include public replaceable infrastructure but must not include secrets. A later settings UI can override the peer and ICE lists.

Validation ensures at least one fallback connectivity path is configured before network start.

## Service lifecycle

`SyncEngine.start()`:

1. opens/migrates IndexedDB;
2. repairs stale outbox states;
3. starts HybridTransport;
4. subscribes inbox handler;
5. queries missed Waku Store packets;
6. starts the outbox worker;
7. emits ready state.

`stop()` reverses those steps and must be idempotent.

## Testing strategy

Use Vitest and `fake-indexeddb`.

Unit tests cover:

- packet validation and body preservation;
- repository persistence across reopen;
- inbox dedupe;
- retry timing/backoff;
- hybrid direct-first/fallback behavior;
- expiry terminal behavior;
- stale `sending` recovery;
- start/stop idempotence;
- direct transport signaling with mocked `RTCPeerConnection`;
- Waku adapter with a fake Waku node.

Integration tests use two in-process fake transports to prove restart-safe enqueue/delivery/dedupe before any live network test.

A manual network smoke script later uses two browser instances against Waku test/local peers. Tests must not depend on public Waku availability.

## Failure policy

Normalized retryable transport codes:

- `DIRECT_UNAVAILABLE`
- `DIRECT_TIMEOUT`
- `WAKU_NOT_READY`
- `WAKU_PUBLISH_FAILED`
- `NETWORK_OFFLINE`

Terminal core codes:

- `PACKET_INVALID`
- `PACKET_EXPIRED`
- `PACKET_TOO_LARGE`

Raw exceptions are logged only in development; packet bodies are never included in logs.

## Definition of done for Phase 1

Phase 1 is complete when:

1. existing v2.1 UI still opens unchanged;
2. automated tests pass from a clean npm install;
3. a packet is durably queued before transport send;
4. pending outbox rows survive a simulated restart;
5. HybridTransport prefers an available direct channel and falls back to Waku on the same send attempt;
6. duplicate copies from multiple transports are delivered upward once;
7. Store history synchronization can feed the same inbox pipeline;
8. no module requires a SYNERGY central API/auth/message server;
9. no Phase-1 module logs or interprets plaintext message content;
10. transport/bootstrap configuration can be replaced without database migration.

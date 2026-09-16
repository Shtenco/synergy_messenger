# SYNERGY Messenger V3 — Decentralized Architecture Design

**Status:** Approved architecture, formalized from the v2.1 review  
**Date:** 2026-09-15  
**Base:** `SYNERGY-MESSENGER-v2.1-FULL-CAPACITOR.zip`

## Product invariant

SYNERGY Messenger V3 MUST NOT depend on a mandatory central SYNERGY server for identity, authentication, contact discovery, message routing, message history, encryption keys, media storage, wallet state, or synchronization.

Replaceable public infrastructure may assist connectivity (for example STUN, Waku bootstrap peers, Waku Store/Filter/LightPush peers), but it is always treated as untrusted transport infrastructure. No such peer may be a source of truth, hold a user's plaintext history, or be required to belong to SYNERGY.

## V3 architecture

The product is split into five independently testable subprojects:

1. **P2P Core** — local database, transport abstraction, Waku transport, direct WebRTC transport, hybrid routing, inbox/outbox, delivery deduplication and recovery.
2. **Crypto** — device identity, signed pre-key handshake, one-to-one ratchet sessions, encrypted-at-rest secrets, fingerprints and verification.
3. **Messenger UI integration** — connect the existing v2.1 interface to the V3 repositories and transport; remove demo seeds and simulated replies.
4. **Media / Groups / Finance** — encrypted chunked media, group epochs/sender sessions, signed payment intents and Finance bridge.
5. **Android** — generated Capacitor Android project, Android Keystore backed secrets, foreground networking option, deep links, QR/share integrations, release APK/AAB.

The five subprojects are implemented in that order. Each has its own design/plan and must leave the app in a testable state.

## Transport model

V3 uses one canonical opaque packet format above multiple transports.

Delivery preference:

1. existing direct WebRTC DataChannel to the recipient;
2. attempt a direct connection using decentralized signaling;
3. Waku LightPush/Filter for online fallback;
4. Waku Store retrieval after the recipient returns online.

A relay/store peer receives only opaque packet bytes and routing metadata. It never receives plaintext message bodies or private keys.

### Waku role

Waku is the decentralized fallback and signaling bus, not an application backend. The implementation must:

- support multiple bootstrap peers/discovery sources;
- not hard-code a single SYNERGY-owned peer as mandatory;
- permit user/deployment supplied peer lists;
- query more than one Store-capable peer when practical;
- deduplicate results locally by `messageId`;
- tolerate duplicate, delayed and out-of-order packets;
- treat network delivery as at-least-once, never exactly-once.

### Direct WebRTC role

Direct WebRTC DataChannels are an optimization for online peers. Waku can carry opaque SDP/ICE signaling packets so a centralized signaling server is unnecessary. If direct establishment fails, message delivery remains functional through Waku.

No design may claim that direct WebRTC is guaranteed across all NAT/firewall/mobile networks.

## Local-first data model

Each device owns its local state in IndexedDB (and native secure storage for secrets after the Android phase).

The V3 application database is named `synergy-messenger-v3`.

Initial object stores:

- `meta` — schema version, migration markers, installation/device metadata that is not secret;
- `contacts` — public contact descriptors and verification state;
- `chats` — local chat metadata;
- `messages` — local message records;
- `outbox` — durable packets awaiting confirmed local handoff/delivery progress;
- `inbox` — received packet IDs and processing state;
- `receipts` — delivery/read receipts;
- `transportPeers` — replaceable cached peer/connectivity observations.

Later phases add crypto/session and attachment stores without changing the transport API.

## Canonical packet boundary

The P2P core never accepts a UI plaintext string as a transport payload. It transports opaque bytes supplied by the crypto layer.

Conceptual packet:

```ts
interface SynergyPacket {
  version: 3;
  messageId: string;
  kind: 'message' | 'receipt' | 'signal' | 'control';
  senderDeviceId: string;
  recipientMailbox: string;
  createdAt: number;
  expiresAt: number | null;
  body: Uint8Array; // opaque ciphertext/control bytes
}
```

The wire codec is hidden behind `PacketCodec`, so transport code is independent of the final serialization format.

## Delivery state machine

Outgoing local records use:

`queued -> sending -> sent -> delivered -> read`

Error states are recoverable:

`queued/sending -> retry_wait -> sending`

Permanent local rejection uses `failed` with a reason code. A transport timeout never deletes the packet.

Outbox requirements:

- durable before network send;
- idempotent by `messageId`;
- exponential retry with jitter;
- retry survives page/app restart;
- expiry stops retries but keeps an auditable local terminal state;
- direct failure automatically falls back to Waku.

Inbox requirements:

- validate outer packet structure before storage;
- deduplicate before dispatch;
- persist receipt of `messageId` before invoking upper layers;
- process duplicate Waku Store/Filter/direct copies only once;
- preserve ciphertext bytes exactly.

## Privacy boundaries

The P2P Core may know:

- local device ID;
- opaque mailbox identifiers;
- packet IDs, timestamps, TTL and transport state;
- ciphertext size;
- transient peer connectivity information.

It must not know or log:

- plaintext message text;
- wallet private keys or seed phrases;
- ratchet private keys;
- decrypted attachment contents beyond the explicit upper-layer handoff;
- contact secrets.

Logging must redact packet bodies by default.

## Existing v2.1 preservation

During P2P Core and Crypto work, the existing v2.1 UI remains usable and unchanged. New code is additive under `src/v3/` plus tests and build/test configuration.

The following v2.1 behavior is explicitly temporary and removed only in the UI integration phase:

- `DEMO_CHATS_SEED`;
- `simulateReply()`;
- hard-coded Finance balance;
- demo crypto sessions;
- in-memory message arrays.

This avoids coupling network debugging to a simultaneous UI rewrite.

## Build strategy

The current v2.1 project is static ESM plus Capacitor. V3 introduces npm-managed browser dependencies and automated tests.

For Phase 1:

- source lives under `src/v3/`;
- tests run in Node with browser API shims where required;
- production UI entry remains unchanged;
- no P2P dependency is loaded by the v2.1 UI until Phase 3.

At UI integration, the project will add a deterministic browser bundling step before copying assets to `www/`.

## Security stance

Transport encryption supplied by WebRTC/libp2p/Waku is not treated as message E2E encryption. Message confidentiality is provided only by the V3 Crypto layer.

Until the Crypto phase is complete, Phase 1 transports only test/opaque payload bytes and is not labelled production-secure.

No custom cryptographic primitive is invented in the P2P Core.

## Connectivity truth

A zero-central-server messenger still requires connectivity helpers on the public Internet. V3 distinguishes them from application servers:

- STUN: replaceable connectivity helper;
- Waku peers: replaceable decentralized routing/store helpers;
- optional community/user-run peers: supported;
- SYNERGY central account/message server: forbidden.

The app must remain architecturally capable of using non-SYNERGY peers.

## Acceptance criteria for the full V3 program

V3 is complete only when all of the following hold:

- two fresh devices can create local identities without registration;
- contacts can be exchanged out-of-band;
- two online devices can exchange E2E messages directly when networking permits;
- if direct connection fails, encrypted messages still travel over Waku;
- an offline recipient can later retrieve and deduplicate encrypted messages through Store peers;
- restarting either app does not lose local history or pending outbox items;
- no central SYNERGY backend is required for normal messaging;
- media and group messages follow the same E2E boundary;
- Finance transactions are signed outside Messenger private-key storage;
- Android build uses platform secure storage for secret key material.

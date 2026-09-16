# SYNERGY Messenger V3 Phase-4A Media Transport Design

## Goal

Add a serverless, end-to-end encrypted media plane for files and images without routing bulk bytes through Waku or a central CDN. The existing Double Ratchet carries only an authenticated encrypted media manifest; bulk ciphertext moves over a dedicated direct WebRTC data channel and persists locally for resumable transfer.

## Architectural invariants

- No mandatory central media server, CDN, account database, or upload API.
- Waku remains a small control/offline-message plane; bulk media chunks never enter Waku Store.
- The `mediaKey`, filename, MIME type, content hash and media metadata are carried only inside the existing E2E secure payload and encrypted local repositories.
- Media chunks are independently encrypted with AES-256-GCM using HKDF-derived per-chunk keys and media/chunk-bound AAD.
- Persisted chunk blobs are ciphertext only. Persisted media metadata is vault-sealed.
- Direct media channel label: `synergy-media-v1`, reliable and unordered.
- Default plaintext chunk target: 48 KiB. Runtime transport must refuse frames exceeding negotiated SCTP max message size.
- Sender and receiver persist transfer state so an interrupted transfer can request only missing chunks.
- Completion requires every chunk plus an end-to-end content digest match.
- Unsafe active content such as SVG/HTML/JS is download-only; browser auto-preview is restricted to a safe allowlist.
- Phase-4A is alpha: decentralized replica providers are represented by an interface but not enabled by default.

## Wire/control model

The Double Ratchet application payload adds a `media` message type with a versioned manifest:

- `mediaId`
- `name`
- `mime`
- `size`
- `chunkSize`
- `chunkCount`
- `contentHash`
- `mediaKey`
- `previewPolicy`
- optional `expiresAt`

Bulk WebRTC frames use `SYNERGY-MEDIA-FRAME-V1` and four frame kinds: `request`, `chunk`, `complete`, `cancel`. A request carries missing chunk indexes/ranges. A chunk frame carries `mediaId`, `chunkIndex`, IV, ciphertext and plaintext length. The frame decoder rejects unsupported versions, malformed indexes and oversized headers before writing to storage.

## Storage model

IndexedDB schema v4 adds:

- `mediaObjects` keyed by `mediaId`; public row contains only routing timestamps/state plus a vault-sealed metadata blob.
- `mediaChunks` keyed by `chunkId = mediaId:index`; row contains IV + ciphertext + plaintext length.
- `mediaTransfers` keyed by `transferId`; transfer details are vault-sealed while minimal scheduling fields remain queryable.

`MediaBlobStore` defines the chunk persistence interface. Phase-4A implements IndexedDB; the interface is intentionally compatible with a future Capacitor/native filesystem backend.

## Send flow

1. Controller accepts a `File`/`Blob` or bytes and creates an optimistic history row.
2. Media manager streams/slices the source into chunks, computes SHA-256 incrementally, encrypts each chunk, and persists ciphertext before announcement.
3. Secure core sends the manifest through Double Ratchet as the chat message.
4. Receiver stores the encrypted manifest/history row and asks the sender for missing chunks when a direct P2P media channel is available.
5. Sender applies DataChannel backpressure and sends requested chunks.
6. Receiver persists chunks idempotently, updates progress, decrypts only for final verification/read access, and marks `ready` only after digest verification.

## Resume and failure semantics

- Duplicate chunks are idempotent.
- Out-of-order chunks are accepted.
- Disconnect leaves persisted transfer state and ciphertext intact.
- Reconnect sends a request for missing indexes only.
- Cancel is local plus best-effort peer notification; it never deletes the sender's source automatically.
- Integrity/authentication failure marks transfer `failed` and does not expose a blob to UI.
- Storage quota/size policy is checked before preparation or acceptance.

## UI integration

The Phase-3 attach button becomes functional. The message bubble shows filename, human-readable size, progress, waiting/downloading/ready/failed states and retry/cancel/download actions. Safe images can obtain a local object URL only after authenticated completion. Existing text/reply/forward UI remains intact.

## Security boundary

Phase-4A protects media in transit and at rest within the app model, but does not claim protection after the user exports/downloads plaintext to another app or filesystem location. It also does not claim independent cryptographic audit. Media cache replicas, native Android filesystem hardening, voice recording and group key distribution are separate later phases.

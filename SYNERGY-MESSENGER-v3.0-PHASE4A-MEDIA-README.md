# SYNERGY Messenger V3 — Phase 4A Media Transport

Version: **3.0.0-alpha.4**

Phase 4A adds encrypted, resumable file and image transfer without a mandatory central media server or CDN.

## Data path

1. The selected file is read incrementally.
2. A random 256-bit `mediaKey` is created locally.
3. Plaintext is split into 48 KiB target chunks.
4. Every chunk derives an independent key with HKDF and is encrypted with AES-256-GCM.
5. Ciphertext chunks are persisted locally; raw filename, MIME and `mediaKey` are not stored in clear IndexedDB metadata rows.
6. A versioned media manifest containing the file metadata, content hash and media key is sent **inside the existing Double Ratchet E2E envelope**.
7. Bulk ciphertext uses a dedicated reliable unordered WebRTC DataChannel named `synergy-media-v1`.
8. The receiver authenticates each chunk before persisting it, accepts out-of-order/duplicate delivery, and verifies the final plaintext SHA-256 before exposing the file as ready.

Waku remains the messaging/signaling/store fallback for small E2E control packets. Phase 4A deliberately does **not** push large media blobs through Waku.

## Implemented

- encrypted media manifest through `SecureMessengerCore`;
- DB schema v4: `mediaObjects`, `mediaChunks`, `mediaTransfers`;
- sealed media object/transfer metadata via the existing non-extractable Vault key;
- independent chunk AEAD with media/index/count/length AAD binding;
- incremental SHA-256;
- dedicated WebRTC media channel;
- SCTP `maxMessageSize` guard;
- high/low-water `bufferedAmount` backpressure;
- resumable missing-range requests;
- 4096-chunk serving batches with automatic continuation;
- restart-safe transfer state;
- cancel and retry;
- best-effort `resumePending()` after the P2P core starts;
- storage-quota safety check;
- final full-file integrity verification;
- expiration enforcement at UI **and media transport/cache** layers;
- local cache purge for disappearing media;
- safe preview allowlist: JPEG/PNG/WebP/GIF only;
- SVG/HTML/JS/unknown active content stays download-only;
- real attachment picker and transfer UI with progress/retry/cancel/open;
- local image preview via revocable object URLs;
- `MediaReplicaProvider` abstraction reserved for future decentralized ciphertext replicas.

## Security properties

The Waku/relay/control transport sees only the already-encrypted Double Ratchet message body. Filename, MIME, content hash and `mediaKey` are inside that E2E payload. The direct WebRTC channel transports app-level AES-GCM ciphertext chunks (in addition to WebRTC DTLS encryption).

A received chunk is never committed before its AEAD authentication succeeds. A completed file is never exposed as ready until the reconstructed plaintext SHA-256 matches the E2E manifest.

## Deliberate limitations of alpha.4

This is a **security alpha**, not an independently audited secure-messenger release.

- Bulk media currently requires a direct WebRTC source to become available. The interface for decentralized encrypted replicas exists, but IPFS/Helia/volunteer replica nodes are not yet implemented.
- Real public Waku operation on two physical Android phones over different networks has not yet been verified in this environment.
- The browser runtime still needs a locally bundled Waku SDK for a production Android package; no CDN fallback is introduced.
- Media ciphertext is currently stored through the IndexedDB blob-store adapter. OPFS/native Android filesystem storage is a later hardening step for very large files.
- Opening/downloading a very large attachment in the current WebView path can require substantial memory; native streaming export belongs in Android hardening.
- Voice messages, group encryption/media fan-out and Finance Bridge are Phase 4B/4C/4D.

## Next phases

- **4B Voice** — MediaRecorder/Opus, waveform, pause/cancel/playback on top of this media plane.
- **4C Groups** — group session encryption, epochs/member changes and one encrypted media object fan-out.
- **4D Finance Bridge** — signed payment intents without exposing wallet private keys to Messenger.
- **5 Android hardening** — Keystore, foreground P2P service, native filesystem streaming, deep links/share target and physical-device network tests.

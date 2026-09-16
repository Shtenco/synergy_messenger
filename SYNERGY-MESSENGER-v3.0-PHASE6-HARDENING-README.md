# SYNERGY Messenger v3.0.0-alpha.9 — Phase 6 Final Hardening

Phase 6 completes the current alpha architecture without adding a mandatory central server.

## 6A — Encrypted decentralized replicas

- Direct WebRTC remains the first-choice media path.
- Optional replica providers receive ciphertext chunks only.
- Replica object IDs are keyed opaque identifiers, not media/chat IDs.
- A random 256-bit access capability plus HMAC proof protects replica retrieval/integrity.
- Write quorum, expiry and byte quotas fail closed.
- `ReplicaCapabilityRepository` seals local replica descriptors under Vault; raw IndexedDB does not expose `accessToken` or `mediaId`.
- Replica recovery still passes through MediaManager AEAD verification and final plaintext SHA-256 verification.
- No IPFS/HTTP/CDN provider is bundled; providers are injected capabilities only.

## 6B — Multi-device

- Account Root uses a non-extractable Ed25519 private key.
- New devices retain independent device identities and receive root-signed `DeviceCertificate` records.
- Certificates bind `deviceId`, fingerprint, signing public key and, when supplied, device mailbox.
- Root-signed revocations are monotonic and revoked generations cannot be reintroduced.
- Device certificate/bundle state is Vault-sealed at rest.
- `FanoutMessenger` encrypts independently for every active certified device while preserving one logical message ID and distinct transport IDs.
- UI history deduplicates repeated device deliveries by encrypted `logicalMessageId` while acknowledging each transport copy.
- No account-root private key export or automatic recovery mechanism is shipped.

## 6C — Abuse / replay / quota hardening

- Token-bucket ingress rate limiting is keyed by sender + recipient mailbox.
- Persistent replay ledger survives restart and has retention + maximum-row bounds.
- Ingress checks occur before inbox/message persistence.
- MLS future application/commit buffers are bounded by future-epoch gap, number of epochs, packets per epoch and commit count.
- Maintenance prunes expired replay/capability records and old terminal inbox/outbox/media records.
- Security diagnostics expose counts/states only, never plaintext, keys, replica capabilities or payment details.

## Runtime

`createPhase6Hardening()` produces local guards, maintenance, diagnostics and optional replica coordination. The browser bootstrap injects the ingress guard into the P2P core and the replica coordinator into the Media Plane. `globalThis.SYNERGY_REPLICA_PROVIDERS` is optional; with no providers, Messenger continues direct P2P operation without replica fallback.

There are no bundled central replica, multi-device or security endpoints.

## Security boundary

`alpha.9` remains an alpha security release. It does not claim independent cryptographic audit, a fully integrated OpenMLS WASM build, Android APK/AAB verification on physical devices, or automatic account recovery if all authorized root-holding devices are lost. Real cross-network Waku/WebRTC tests, OpenMLS production backend tests and Android device testing remain required before a production security claim.
